<?php
/**
 * Token-walking primitives shared by godam-wp-dam-hook-check.php and
 * godam-attachment-access-coverage-check.php.
 *
 * Extracted after a real bug (not a style nit) traced directly back to
 * keeping two copies: the two scripts had drifted to two different, both
 * wrong, definitions of "what counts as firing a hook"
 * (`array( 'do_action', 'apply_filters' )` in one, `array( 'do_action',
 * 'add_action' )` in the other — `add_action()` registers a listener, it
 * never fires anything). One shared, correct definition here
 * (GODAM_HOOK_FIRE_FUNCTIONS) makes that specific class of drift structurally
 * impossible going forward, not just fixed once.
 *
 * What's shared: file listing, tokenizing, token navigation
 * (skip-forward/backward), real-call detection, hook-fire detection,
 * scope-terminator detection, and function-boundary finding — the parts
 * that are either byte-identical or a strict superset between the two
 * scripts. What's deliberately NOT shared: the balance-walk in
 * godam-wp-dam-hook-check.php and the coverage-walk in
 * godam-attachment-access-coverage-check.php stay separate, because their
 * control flow genuinely diverges (one returns immediately on the first
 * imbalance found; the other accumulates every uncovered call site) —
 * forcing those into one shared function would trade a real drift risk
 * (this file's whole reason for existing) for reduced readability in both
 * callers, which isn't a trade worth making.
 *
 * @package GoDAM
 */

// phpcs:disable WordPress.WP.AlternativeFunctions -- CLI script, no WP bootstrap.

/**
 * Function names that actually fire a hook. Deliberately just `do_action` —
 * `rtgodam_before_attachment_lookup` / `rtgodam_after_attachment_lookup` are
 * pure notification hooks with no return value to filter, so they're never
 * fired via `apply_filters()`, and `add_action()` *registers* a listener, it
 * doesn't fire anything, so it was never correct in either script's own
 * earlier definition.
 *
 * @var string[]
 */
const GODAM_HOOK_FIRE_FUNCTIONS = array( 'do_action' );

/**
 * Function names that behave like a `return`/`throw` for balance-tracking
 * purposes: calling one unconditionally ends the current request/callback,
 * so anything physically after it, at the same depth, never executes.
 * `wp_die()` is the direct case; `wp_send_json()` and the
 * `wp_send_json_error()`/`wp_send_json_success()` wrappers around it are
 * included because WordPress core's own implementation calls `wp_die()`
 * once it's echoed the JSON response — exactly the pattern
 * `inc/classes/rest-api/**` handlers use throughout this plugin for early
 * exits, which a check that only recognized `return`/`throw` would
 * misread as a genuinely open scope.
 *
 * @var string[]
 */
const GODAM_TERMINATOR_FUNCTIONS = array( 'wp_die', 'wp_send_json', 'wp_send_json_error', 'wp_send_json_success' );

const GODAM_SKIPPABLE_TOKENS = array( T_WHITESPACE, T_COMMENT, T_DOC_COMMENT );

/**
 * Recursively lists .php files under $dir, skipping compiled/vendor output
 * that can't be hand-hooked anyway.
 *
 * @param string $dir Directory to scan.
 * @return string[] Absolute file paths.
 */
function godam_shared_list_php_files( $dir ) {
	$files = array();

	if ( ! is_dir( $dir ) ) {
		return $files;
	}

	$iterator = new RecursiveIteratorIterator(
		new RecursiveDirectoryIterator( $dir, FilesystemIterator::SKIP_DOTS )
	);

	foreach ( $iterator as $file ) {
		$path = $file->getPathname();

		if ( strpos( $path, DIRECTORY_SEPARATOR . 'build' . DIRECTORY_SEPARATOR ) !== false ) {
			continue; // Compiled block output — not hand-hookable, out of scope.
		}

		if ( strpos( $path, DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR ) !== false ) {
			continue; // Third-party libraries, not GoDAM's own code.
		}

		if ( 'php' === strtolower( pathinfo( $path, PATHINFO_EXTENSION ) ) ) {
			$files[] = $path;
		}
	}

	return $files;
}

/**
 * Tokenizes a file into a flat list of ['id' => int|null, 'text' => string,
 * 'line' => int], normalizing token_get_all()'s mix of arrays (named tokens)
 * and bare strings (single-char tokens) into one consistent shape.
 *
 * @param string $file Absolute file path.
 * @return array[]
 */
function godam_shared_tokenize( $file ) {
	$contents = file_get_contents( $file );

	if ( false === $contents ) {
		return array();
	}

	$raw_tokens = token_get_all( $contents );
	$normalized = array();
	$line       = 1;

	foreach ( $raw_tokens as $token ) {
		if ( is_array( $token ) ) {
			list( $id, $text, $token_line ) = $token;
			$normalized[]                   = array(
				'id'   => $id,
				'text' => $text,
				'line' => $token_line,
			);
			$line                           = $token_line + substr_count( $text, "\n" );
		} else {
			$normalized[] = array(
				'id'   => null,
				'text' => $token,
				'line' => $line,
			);
			$line        += substr_count( $token, "\n" );
		}
	}

	return $normalized;
}

/**
 * Skips whitespace/comment tokens forward from $i, returning the next
 * meaningful index (or $count if none remain).
 *
 * @param array[] $tokens Token list.
 * @param int     $i      Start index (checked first).
 * @param int     $count  Token count.
 * @return int
 */
function godam_shared_skip_forward( $tokens, $i, $count ) {
	while ( $i < $count && in_array( $tokens[ $i ]['id'], GODAM_SKIPPABLE_TOKENS, true ) ) {
		++$i;
	}
	return $i;
}

/**
 * Skips whitespace/comment tokens backward from $i, returning the previous
 * meaningful index (or -1 if none remain).
 *
 * @param array[] $tokens Token list.
 * @param int     $i      Start index (checked first).
 * @return int
 */
function godam_shared_skip_backward( $tokens, $i ) {
	while ( $i >= 0 && in_array( $tokens[ $i ]['id'], GODAM_SKIPPABLE_TOKENS, true ) ) {
		--$i;
	}
	return $i;
}

/**
 * Whether the token at $i is a real function call of one of $names — i.e. a
 * T_STRING matching (case-sensitively) one of them, immediately followed
 * (skipping whitespace/comments) by '('. Being a T_STRING at all already
 * excludes anything inside a T_COMMENT/T_DOC_COMMENT, since the tokenizer
 * never splits a comment's text into separate tokens.
 *
 * @param array[] $tokens Full token list for the file.
 * @param int     $i      Index to check.
 * @param array   $names  Function names to match.
 * @param int     $count  Token count.
 * @return bool
 */
function godam_shared_is_call_to( $tokens, $i, $names, $count ) {
	if ( T_STRING !== ( $tokens[ $i ]['id'] ?? null ) || ! in_array( $tokens[ $i ]['text'], $names, true ) ) {
		return false;
	}

	$n = godam_shared_skip_forward( $tokens, $i + 1, $count );
	return $n < $count && '(' === $tokens[ $n ]['text'];
}

/**
 * Whether the T_CONSTANT_ENCAPSED_STRING token at $i is $hook_name, passed as
 * the first argument to a real call to one of $outer_functions — e.g.
 * do_action( 'x' ).
 *
 * @param array[] $tokens          Full token list for the file.
 * @param int     $i               Index of the string token to check.
 * @param string  $hook_name       Hook name to match (unquoted).
 * @param array   $outer_functions Function names that count as firing this hook.
 * @return bool
 */
function godam_shared_is_hook_fire_at( $tokens, $i, $hook_name, $outer_functions = GODAM_HOOK_FIRE_FUNCTIONS ) {
	if ( T_CONSTANT_ENCAPSED_STRING !== ( $tokens[ $i ]['id'] ?? null ) ) {
		return false;
	}

	// Strip the token's own quote characters (single or double) to compare.
	if ( substr( $tokens[ $i ]['text'], 1, -1 ) !== $hook_name ) {
		return false;
	}

	$count = count( $tokens );

	// Walk backward: '(' then a T_STRING matching one of the outer functions.
	$p = godam_shared_skip_backward( $tokens, $i - 1 );
	if ( $p < 0 || '(' !== $tokens[ $p ]['text'] ) {
		return false;
	}
	$p = godam_shared_skip_backward( $tokens, $p - 1 );

	return $p >= 0 && godam_shared_is_call_to( $tokens, $p, $outer_functions, $count );
}

/**
 * Whether the token at $i unconditionally ends the current function/request:
 * a real `return`/`throw`/`exit`/`die` (T_EXIT covers both keyword spellings
 * — they're language-level aliases, tokenized identically), or a real call
 * to one of GODAM_TERMINATOR_FUNCTIONS.
 *
 * @param array[] $tokens Full token list for the file.
 * @param int     $i      Index to check.
 * @param int     $count  Token count.
 * @return bool
 */
function godam_shared_is_scope_terminator( $tokens, $i, $count ) {
	if ( in_array( $tokens[ $i ]['id'] ?? null, array( T_RETURN, T_THROW, T_EXIT ), true ) ) {
		return true;
	}

	return godam_shared_is_call_to( $tokens, $i, GODAM_TERMINATOR_FUNCTIONS, $count );
}

/**
 * Finds named class/interface/trait declarations in a token stream: name and
 * body token range, by tracking brace depth. The only thing this is used
 * for is letting godam_shared_find_functions() class-qualify each method's
 * own name (`Foo::render()` instead of a bare `render()` that reads
 * identically for any other class with a same-named method) — callers doing
 * their own reporting want that qualified form so a finding's scope label
 * alone tells a reader which class it's in, without needing to also cross-
 * reference the file.
 *
 * @param array[] $tokens Normalized tokens from godam_shared_tokenize().
 * @return array[] Each: name, body_start, body_end (token indexes).
 */
function godam_shared_find_classes( $tokens ) {
	$classes = array();
	$count   = count( $tokens );

	for ( $i = 0; $i < $count; $i++ ) {
		if ( ! in_array( $tokens[ $i ]['id'] ?? null, array( T_CLASS, T_INTERFACE, T_TRAIT ), true ) ) {
			continue;
		}

		$j = godam_shared_skip_forward( $tokens, $i + 1, $count );
		if ( $j >= $count || T_STRING !== ( $tokens[ $j ]['id'] ?? null ) ) {
			continue; // Anonymous class (`new class { ... }`) — no name to qualify with.
		}

		$name = $tokens[ $j ]['text'];

		while ( $j < $count && '{' !== $tokens[ $j ]['text'] ) {
			++$j;
		}
		if ( $j >= $count ) {
			continue;
		}

		$body_start  = $j;
		$brace_depth = 1;
		++$j;
		while ( $j < $count && $brace_depth > 0 ) {
			if ( '{' === $tokens[ $j ]['text'] ) {
				++$brace_depth;
			} elseif ( '}' === $tokens[ $j ]['text'] ) {
				--$brace_depth;
			}
			++$j;
		}
		$body_end = $j - 1;

		$classes[] = array(
			'name'       => $name,
			'body_start' => $body_start,
			'body_end'   => $body_end,
		);

		$i = $body_end; // Resume after this class.
	}

	return $classes;
}

/**
 * Finds named function/method declarations in a token stream: name,
 * enclosing class name, parameter names, and body token range, by tracking
 * paren depth (parameter list) and brace depth (body) rather than assuming a
 * fixed shape.
 *
 * @param array[] $tokens Normalized tokens from godam_shared_tokenize().
 * @return array[] Each: name, class (string|null — enclosing class/interface/
 *                  trait name, null for a plain function), params (string[]
 *                  of variable names, unprefixed by $), body_start, body_end
 *                  (token indexes).
 */
function godam_shared_find_functions( $tokens ) {
	$functions = array();
	$classes   = godam_shared_find_classes( $tokens );
	$count     = count( $tokens );

	for ( $i = 0; $i < $count; $i++ ) {
		if ( T_FUNCTION !== ( $tokens[ $i ]['id'] ?? null ) ) {
			continue;
		}

		$j = godam_shared_skip_forward( $tokens, $i + 1, $count );

		if ( $j < $count && '&' === $tokens[ $j ]['text'] ) { // Return-by-reference.
			$j = godam_shared_skip_forward( $tokens, $j + 1, $count );
		}

		if ( $j >= $count || T_STRING !== ( $tokens[ $j ]['id'] ?? null ) ) {
			continue; // Anonymous function/closure — its tokens stay part of whichever named function or top-level range encloses it.
		}

		$name = $tokens[ $j ]['text'];
		++$j;

		while ( $j < $count && '(' !== $tokens[ $j ]['text'] ) {
			++$j;
		}
		if ( $j >= $count ) {
			continue;
		}

		$params      = array();
		$paren_depth = 1;
		++$j;
		while ( $j < $count && $paren_depth > 0 ) {
			if ( '(' === $tokens[ $j ]['text'] ) {
				++$paren_depth;
			} elseif ( ')' === $tokens[ $j ]['text'] ) {
				--$paren_depth;
			} elseif ( 1 === $paren_depth && T_VARIABLE === ( $tokens[ $j ]['id'] ?? null ) ) {
				$params[] = ltrim( $tokens[ $j ]['text'], '$' );
			}
			++$j;
		}

		while ( $j < $count && '{' !== $tokens[ $j ]['text'] && ';' !== $tokens[ $j ]['text'] ) {
			++$j;
		}
		if ( $j >= $count || ';' === $tokens[ $j ]['text'] ) {
			continue; // Interface/abstract declaration — no body.
		}

		$body_start  = $j;
		$brace_depth = 1;
		++$j;
		while ( $j < $count && $brace_depth > 0 ) {
			if ( '{' === $tokens[ $j ]['text'] ) {
				++$brace_depth;
			} elseif ( '}' === $tokens[ $j ]['text'] ) {
				--$brace_depth;
			}
			++$j;
		}
		$body_end = $j - 1;

		$class_name = null;
		foreach ( $classes as $class ) {
			if ( $body_start >= $class['body_start'] && $body_start <= $class['body_end'] ) {
				$class_name = $class['name'];
				break;
			}
		}

		$functions[] = array(
			'name'       => $name,
			'class'      => $class_name,
			'params'     => $params,
			'body_start' => $body_start,
			'body_end'   => $body_end,
		);

		$i = $body_end; // Resume after this function — nested closures already consumed.
	}

	return $functions;
}
