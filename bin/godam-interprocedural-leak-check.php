<?php
/**
 * Detects an interprocedural-leak shape in the
 * rtgodam_before_attachment_lookup / rtgodam_after_attachment_lookup pair: a
 * function whose own body opens and closes a complete before/after bracket
 * ("self-wrapped"), called from elsewhere, where the immediate follow-up
 * code at the call site also touches attachment data without its own
 * bracket.
 *
 * This is the one shape godam-wp-dam-hook-check.php's per-file wrap COUNT
 * can't see: neither file's count changes when this happens — the callee's
 * wrap is intact, and the bug lives entirely in unwrapped code the count
 * check never inspects. Example shape:
 *
 *   function create_thing() {
 *       do_action( 'rtgodam_before_attachment_lookup' );
 *       $id = wp_insert_attachment( ... );
 *       do_action( 'rtgodam_after_attachment_lookup' );
 *       return $id;
 *   }
 *
 *   function caller() {
 *       $id = create_thing();
 *       update_post_meta( $id, 'some_key', $value ); // <-- unwrapped, but
 *                                                     //     $id may live on
 *                                                     //     a different site
 *   }
 *
 * Uses PHP's own token_get_all() (no new dependency) to find real function
 * boundaries, parameter lists, and brace-depth-bounded blocks rather than
 * grepping for brace-adjacent text — but this is still a heuristic, not a
 * full control-flow analysis. This is a hardened port of the same tool used
 * in the wp-dam integration this hook pair was originally built for; four
 * false-positive modes were found there by testing against a real codebase
 * (not just planted cases) before trusting it, and are already fixed here
 * rather than left to be rediscovered:
 *
 *  - An ENCLOSING wrap that started before the call site. Fixed by scanning
 *    backward from the call site to its enclosing function's start, counting
 *    before/after occurrences; if a before is currently open, the call site
 *    is skipped entirely (see godam_leak_is_already_wrapped()).
 *  - ID-type confusion: get_post_meta($post_id, ...) (a regular post's own
 *    bookkeeping meta) looks identical to get_post_meta($attachment_id, ...)
 *    (needs centralizing) to a bare function-name match. Fixed by capturing
 *    each function's parameter names and excluding a followup match whose
 *    first argument is one of them — a parameter necessarily predates the
 *    self-wrapped call within this function, so it can't be derived from
 *    that call's return value (see godam_leak_extract_params()).
 *  - Branch-blindness: a line in a sibling, mutually-exclusive else branch
 *    looked identical to one that runs sequentially after the call. Fixed by
 *    tracking brace depth from the call site forward and stopping the scan
 *    the moment it would exit the block the call site is directly inside
 *    (see godam_leak_check_followup()), instead of a plain fixed-line
 *    window.
 *  - Switch/case branch-blindness: the same mutually-exclusive-branch problem
 *    as above, but brace-depth tracking alone doesn't catch it — unlike
 *    if/else, a switch's cases normally share one flat brace block with no
 *    per-case scoping, so a call in `case 'a':` and an unwrapped read in a
 *    sibling `case 'b':` looks sequential. Fixed by treating a `case`/
 *    `default` label encountered at the call site's own depth as an
 *    additional scan-stop condition, alongside the existing brace-depth one
 *    (see godam_leak_check_followup()).
 *
 * Remaining known imprecision, not yet fixed:
 *
 *  - Call-site resolution is by bare function/method name only, with no
 *    class/namespace resolution. Two unrelated methods sharing a name (one
 *    self-wrapped, one not) will both surface as candidates — a source of
 *    false positives, not false negatives, so this errs toward flagging
 *    rather than staying silent.
 *  - Parameter exclusion only recognizes the *exact* parameter variable used
 *    directly as an argument. A caller that copies a parameter into a new
 *    variable first ($id = $post_id;) or accesses it through a property
 *    (->post_id) will still be flagged even though it's the same
 *    non-attachment-derived data — a false positive this doesn't catch.
 *    The inverse is a false NEGATIVE, not just a missed flag: a function that
 *    *reassigns* one of its own parameters to hold the self-wrapped call's
 *    return value ($attachment_id = $this->create_virtual_attachment(...);
 *    where $attachment_id was already a parameter name) would have that
 *    variable wrongly excluded, since this script has no reassignment
 *    tracking — it only knows the name was a parameter, not whether it still
 *    holds the parameter's original value.
 *  - No return-statement awareness: code physically after an unconditional
 *    `return` at the same depth (genuinely unreachable dead code) can still
 *    be scanned as if reachable. False-positive risk only — the code can't
 *    run, so there's no real leak to miss. Sequential conditional returns
 *    (`if (...) { return; }` followed by more code) are NOT affected by
 *    this — that code is genuinely reachable and brace-depth tracking
 *    already scans it correctly.
 *  - Only catches a self-wrapped function whose OWN body contains a complete
 *    before/after pair. A leak between two functions that are BOTH partially
 *    wrapped, or a leak spanning three or more call levels, is out of scope.
 *  - A caller that reads the self-wrapped call's return value after the
 *    block-depth boundary (or far past WINDOW_LINES) stops the scan is
 *    invisible to this script entirely.
 *
 * A clean run means "no new candidates since the last accepted baseline,"
 * not "no interprocedural leaks exist." Every candidate this script prints
 * needs a human to actually read the surrounding code.
 *
 * Two modes, same convention as godam-wp-dam-hook-check.php:
 *   php bin/godam-interprocedural-leak-check.php check
 *   php bin/godam-interprocedural-leak-check.php update-baseline
 *
 * @package GoDAM
 */

// phpcs:disable WordPress.WP.AlternativeFunctions, WordPress.Security.EscapeOutput, WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_file_put_contents, WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_fwrite -- CLI script, no WP bootstrap, no browser output, no VIP filesystem restrictions (reads/writes its own baseline file and STDERR only).

const WINDOW_LINES        = 15;
const BEFORE_HOOK         = 'rtgodam_before_attachment_lookup';
const AFTER_HOOK          = 'rtgodam_after_attachment_lookup';
const HOOK_FIRE_FUNCTIONS = array( 'do_action', 'add_action' );

$root          = dirname( __DIR__ ); // Plugin root.
$baseline_path = __DIR__ . '/godam-interprocedural-leak-baseline.json';
$run_mode      = $argv[1] ?? 'check';

$scan_roots = array(
	$root . '/inc',
	$root . '/admin',
	$root . '/assets/src/blocks',
);

/**
 * Same attachment-access function names godam-wp-dam-hook-check.php tracks.
 * Duplicated deliberately — these two scripts check different things and
 * should stay independently readable rather than sharing a require.
 *
 * @var string[]
 */
const ACCESS_FUNCTIONS = array(
	'get_post_meta',
	'update_post_meta',
	'delete_post_meta',
	'wp_get_attachment_url',
	'wp_get_attachment_image_url',
	'wp_get_attachment_metadata',
	'wp_get_attachment_caption',
	'get_attached_file',
	'wp_prepare_attachment_for_js',
	'wp_insert_attachment',
	'wp_update_attachment_metadata',
	'get_post',
);

/**
 * Recursively lists .php files under $dir, skipping compiled/vendor output.
 *
 * @param string $dir Directory to scan.
 * @return string[] Absolute file paths.
 */
function godam_leak_list_php_files( $dir ) {
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
			continue;
		}

		if ( strpos( $path, DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR ) !== false ) {
			continue;
		}

		if ( 'php' === strtolower( pathinfo( $path, PATHINFO_EXTENSION ) ) ) {
			$files[] = $path;
		}
	}

	return $files;
}

$skippable_tokens = array( T_WHITESPACE, T_COMMENT, T_DOC_COMMENT );

/**
 * Tokenizes a file into a flat list of ['id' => int|null, 'text' => string,
 * 'line' => int], normalizing token_get_all()'s mix of arrays (named tokens)
 * and bare strings (single-char tokens) into one consistent shape.
 *
 * @param string $file Absolute file path.
 * @return array[]
 */
function godam_leak_tokenize( $file ) {
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
 * @param int     $count  Token count (avoids recomputing per call).
 * @return int
 */
function godam_leak_skip_forward( $tokens, $i, $count ) {
	global $skippable_tokens;
	while ( $i < $count && in_array( $tokens[ $i ]['id'], $skippable_tokens, true ) ) {
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
function godam_leak_skip_backward( $tokens, $i ) {
	global $skippable_tokens;
	while ( $i >= 0 && in_array( $tokens[ $i ]['id'], $skippable_tokens, true ) ) {
		--$i;
	}
	return $i;
}

/**
 * Whether the token at $i is a real call to one of $names — a T_STRING
 * matching one of them, immediately followed by '('. Being a T_STRING at all
 * already excludes anything inside a comment, since the tokenizer never
 * splits a comment's text into separate tokens.
 *
 * @param array[] $tokens Token list.
 * @param int     $i      Index to check.
 * @param array   $names  Function names to match.
 * @param int     $count  Token count.
 * @return bool
 */
function godam_leak_is_call_to( $tokens, $i, $names, $count ) {
	if ( T_STRING !== ( $tokens[ $i ]['id'] ?? null ) || ! in_array( $tokens[ $i ]['text'], $names, true ) ) {
		return false;
	}

	$n = godam_leak_skip_forward( $tokens, $i + 1, $count );
	return $n < $count && '(' === $tokens[ $n ]['text'];
}

/**
 * Whether the T_CONSTANT_ENCAPSED_STRING token at $i equals $hook_name
 * (quotes stripped) AND is a real argument to one of HOOK_FIRE_FUNCTIONS.
 *
 * @param array[] $tokens    Token list.
 * @param int     $i         Index of the string token.
 * @param string  $hook_name Hook name to match (unquoted).
 * @return bool
 */
function godam_leak_is_hook_fire( $tokens, $i, $hook_name ) {
	if ( T_CONSTANT_ENCAPSED_STRING !== ( $tokens[ $i ]['id'] ?? null ) ) {
		return false;
	}
	if ( substr( $tokens[ $i ]['text'], 1, -1 ) !== $hook_name ) {
		return false;
	}

	$p = godam_leak_skip_backward( $tokens, $i - 1 );
	if ( $p < 0 || '(' !== $tokens[ $p ]['text'] ) {
		return false;
	}
	$p = godam_leak_skip_backward( $tokens, $p - 1 );

	return $p >= 0 && T_STRING === ( $tokens[ $p ]['id'] ?? null ) && in_array( $tokens[ $p ]['text'], HOOK_FIRE_FUNCTIONS, true );
}

/**
 * Finds named function/method declarations in a token stream: name,
 * parameter names, and body/parameter-list token ranges — by tracking paren
 * depth (parameter list) and brace depth (body) rather than assuming a fixed
 * shape.
 *
 * @param array[] $tokens Normalized tokens from godam_leak_tokenize().
 * @return array[] Each: name, params (string[] of variable names, unprefixed
 *                  by $), body_start, body_end (token indexes).
 */
function godam_leak_find_functions( $tokens ) {
	$functions = array();
	$count     = count( $tokens );

	for ( $i = 0; $i < $count; $i++ ) {
		if ( T_FUNCTION !== ( $tokens[ $i ]['id'] ?? null ) ) {
			continue;
		}

		$j = godam_leak_skip_forward( $tokens, $i + 1, $count );

		if ( $j < $count && '&' === $tokens[ $j ]['text'] ) { // Return-by-reference.
			$j = godam_leak_skip_forward( $tokens, $j + 1, $count );
		}

		if ( $j >= $count || T_STRING !== ( $tokens[ $j ]['id'] ?? null ) ) {
			continue; // Anonymous function/closure — not callable by name.
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
		// A parameter's own T_VARIABLE only counts at paren_depth === 1 (the
		// top level of the parameter list) — a nested '(' could only occur in
		// a default-value expression, where a T_VARIABLE wouldn't be a
		// parameter name anyway (default values must be constant expressions).
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
			continue; // Interface/abstract declaration — no body to check.
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

		$functions[] = array(
			'name'       => $name,
			'params'     => $params,
			'body_start' => $body_start,
			'body_end'   => $body_end,
		);

		$i = $body_end; // Resume after this function — its nested closures are already consumed.
	}

	return $functions;
}

/**
 * Whether a function's own body contains a complete before/after pair.
 *
 * @param array[] $tokens        Full token list for the file.
 * @param array   $function_info One entry from godam_leak_find_functions().
 * @return bool
 */
function godam_leak_is_self_wrapped( $tokens, $function_info ) {
	$slice_text = '';

	for ( $k = $function_info['body_start']; $k <= $function_info['body_end']; $k++ ) {
		$slice_text .= $tokens[ $k ]['text'];
	}

	return ( false !== strpos( $slice_text, BEFORE_HOOK ) )
		&& ( false !== strpos( $slice_text, AFTER_HOOK ) );
}

/**
 * Finds the function (from a file's own godam_leak_find_functions() result)
 * whose body contains token index $index, or null if none does. Functions
 * never overlap in this script's own bookkeeping (nested closures are
 * consumed, not separately recorded), so there's at most one match.
 *
 * @param array[] $functions Functions found in this file.
 * @param int     $index     Token index to locate.
 * @return array|null
 */
function godam_leak_find_enclosing_function( $functions, $index ) {
	foreach ( $functions as $function ) {
		if ( $index >= $function['body_start'] && $index <= $function['body_end'] ) {
			return $function;
		}
	}
	return null;
}

/**
 * Whether, at token index $call_index (inside $enclosing), a
 * rtgodam_before_attachment_lookup bracket is already open — i.e. more real
 * "before" fires than "after" fires have occurred between the function's
 * start and this point. If so, the call site is already protected by an
 * outer wrap and doesn't need its own.
 *
 * @param array[] $tokens     Full token list for the file.
 * @param array   $enclosing  The enclosing function (from find_enclosing_function()).
 * @param int     $call_index Token index of the call site.
 * @return bool
 */
function godam_leak_is_already_wrapped( $tokens, $enclosing, $call_index ) {
	$before_count = 0;
	$after_count  = 0;

	for ( $k = $enclosing['body_start']; $k < $call_index; $k++ ) {
		if ( godam_leak_is_hook_fire( $tokens, $k, BEFORE_HOOK ) ) {
			++$before_count;
		} elseif ( godam_leak_is_hook_fire( $tokens, $k, AFTER_HOOK ) ) {
			++$after_count;
		}
	}

	return $before_count > $after_count;
}

/**
 * Finds real call sites (not declarations) of $function_name across every
 * tokenized file, excluding call sites that fall within that same function's
 * own declaring body (its legitimate recursive self-calls, if any).
 *
 * @param array<string, array[]> $file_tokens    Path => tokens.
 * @param string                 $function_name  Name to search for.
 * @param array                  $exclude_range  ['file' => path, 'body_start' => int, 'body_end' => int].
 * @return array[] Each: file, line, index (token index of the call's name).
 */
function godam_leak_find_call_sites( $file_tokens, $function_name, $exclude_range ) {
	$call_sites = array();

	foreach ( $file_tokens as $path => $tokens ) {
		$count = count( $tokens );

		for ( $i = 0; $i < $count; $i++ ) {
			if ( T_STRING !== ( $tokens[ $i ]['id'] ?? null ) || $function_name !== $tokens[ $i ]['text'] ) {
				continue;
			}

			if ( $path === $exclude_range['file'] && $i >= $exclude_range['body_start'] && $i <= $exclude_range['body_end'] ) {
				continue; // Recursive self-call from within its own body.
			}

			$p = godam_leak_skip_backward( $tokens, $i - 1 );
			if ( $p >= 0 && T_FUNCTION === $tokens[ $p ]['id'] ) {
				continue; // The declaration itself.
			}
			if ( $p >= 0 && '&' === $tokens[ $p ]['text'] ) {
				$p2 = godam_leak_skip_backward( $tokens, $p - 1 );
				if ( $p2 >= 0 && T_FUNCTION === $tokens[ $p2 ]['id'] ) {
					continue; // Return-by-reference declaration.
				}
			}

			$n = godam_leak_skip_forward( $tokens, $i + 1, $count );
			if ( $n >= $count || '(' !== $tokens[ $n ]['text'] ) {
				continue; // Not actually being called.
			}

			$call_sites[] = array(
				'file'  => $path,
				'line'  => $tokens[ $i ]['line'],
				'index' => $i,
			);
		}
	}

	return $call_sites;
}

/**
 * If the token at $i starts a real call to one of ACCESS_FUNCTIONS, returns
 * the unprefixed variable name of its first argument (if the first argument
 * is a plain T_VARIABLE), or '' if the first argument isn't a plain
 * variable, or null if $i isn't an access-function call at all.
 *
 * @param array[] $tokens Token list.
 * @param int     $i      Index to check.
 * @param int     $count  Token count.
 * @return string|null
 */
function godam_leak_access_call_first_arg( $tokens, $i, $count ) {
	if ( ! godam_leak_is_call_to( $tokens, $i, ACCESS_FUNCTIONS, $count ) ) {
		return null;
	}

	$open = godam_leak_skip_forward( $tokens, $i + 1, $count );  // The '(' itself.
	$arg  = godam_leak_skip_forward( $tokens, $open + 1, $count );

	if ( $arg < $count && T_VARIABLE === ( $tokens[ $arg ]['id'] ?? null ) ) {
		return ltrim( $tokens[ $arg ]['text'], '$' );
	}

	return '';
}

/**
 * Scans forward from a call site for an attachment-access pattern whose
 * first argument isn't one of the enclosing function's own parameters,
 * stopping early if: the caller re-wraps first, the scan would exit the
 * block the call site is directly inside (so a sibling if/else branch can't
 * be mistaken for sequential code), a sibling case/default label is entered
 * (switch doesn't brace-scope each case), or WINDOW_LINES is exceeded.
 *
 * @param array[] $tokens      Full token list for the file.
 * @param array   $enclosing   The enclosing function.
 * @param int     $call_index  Token index of the call site's name.
 * @param int     $call_line   1-indexed line the call itself is on.
 * @return int|null 1-indexed line of the leak, or null if none found.
 */
function godam_leak_check_followup( $tokens, $enclosing, $call_index, $call_line ) {
	$count = count( $tokens );

	// Reference depth: how many braces are open at the call site, relative to
	// the enclosing function's own body_start.
	$reference_depth = 0;
	for ( $k = $enclosing['body_start']; $k < $call_index; $k++ ) {
		if ( '{' === $tokens[ $k ]['text'] ) {
			++$reference_depth;
		} elseif ( '}' === $tokens[ $k ]['text'] ) {
			--$reference_depth;
		}
	}

	$depth    = $reference_depth;
	$max_line = $call_line + WINDOW_LINES;

	for ( $i = $call_index; $i < $count && $i <= $enclosing['body_end']; $i++ ) {
		if ( ( $tokens[ $i ]['line'] ?? 0 ) > $max_line ) {
			break;
		}

		if ( '{' === $tokens[ $i ]['text'] ) {
			++$depth;
			continue;
		}
		if ( '}' === $tokens[ $i ]['text'] ) {
			--$depth;
			if ( $depth < $reference_depth ) {
				break; // Exited the block the call site was directly inside.
			}
			continue;
		}

		if ( $depth === $reference_depth && in_array( $tokens[ $i ]['id'] ?? null, array( T_CASE, T_DEFAULT ), true ) ) {
			break; // Entered a sibling, mutually-exclusive case/default branch — switch doesn't brace-scope each case.
		}

		if ( godam_leak_is_hook_fire( $tokens, $i, BEFORE_HOOK ) ) {
			return null; // Caller re-wraps before touching anything else.
		}

		$arg = godam_leak_access_call_first_arg( $tokens, $i, $count );
		if ( null !== $arg && '' !== $arg && ! in_array( $arg, $enclosing['params'], true ) ) {
			return $tokens[ $i ]['line'];
		}
		if ( '' === $arg ) {
			// Access call found, but its first argument isn't a plain
			// variable (e.g. a literal, a property access, an expression) —
			// can't compare against parameter names, so err toward flagging.
			return $tokens[ $i ]['line'];
		}
	}

	return null;
}

/**
 * Human-reviewed reasons for findings accepted into the baseline, keyed the
 * same way as $findings. Merged into the baseline on every
 * `update-baseline` run so the *why* survives regeneration instead of living
 * only in a hand-edited JSON file that the next regeneration would silently
 * overwrite. Add an entry here — not directly in the baseline JSON — when
 * accepting a new false positive.
 *
 * @return array<string, string>
 */
function godam_leak_known_reasons() {
	return array();
}

// --- Build the token index and function list for every scanned file, once. ---

$file_tokens    = array();
$file_functions = array();
foreach ( $scan_roots as $scan_root ) {
	foreach ( godam_leak_list_php_files( $scan_root ) as $file ) {
		$tokens                  = godam_leak_tokenize( $file );
		$file_tokens[ $file ]    = $tokens;
		$file_functions[ $file ] = godam_leak_find_functions( $tokens );
	}
}

// --- Pass 1: find every self-wrapped function across all scanned files. ---

$self_wrapped = array(); // Maps function name => details: file path, body_start index, body_end index.
foreach ( $file_functions as $file_path => $functions ) {
	$tokens = $file_tokens[ $file_path ];
	foreach ( $functions as $function ) {
		if ( godam_leak_is_self_wrapped( $tokens, $function ) ) {
			$self_wrapped[ $function['name'] ] = array(
				'file'       => $file_path,
				'body_start' => $function['body_start'],
				'body_end'   => $function['body_end'],
			);
		}
	}
}

// --- Pass 2: for each, find call sites elsewhere and check the follow-up. ---

$findings = array();
foreach ( $self_wrapped as $function_name => $declared_in ) {
	$call_sites = godam_leak_find_call_sites( $file_tokens, $function_name, $declared_in );

	foreach ( $call_sites as $site ) {
		$tokens    = $file_tokens[ $site['file'] ];
		$enclosing = godam_leak_find_enclosing_function( $file_functions[ $site['file'] ], $site['index'] );

		if ( null === $enclosing ) {
			continue; // Call site isn't inside any named function this script tracks — nothing to check it against.
		}

		if ( godam_leak_is_already_wrapped( $tokens, $enclosing, $site['index'] ) ) {
			continue; // Already protected by an outer bracket.
		}

		$leak_line = godam_leak_check_followup( $tokens, $enclosing, $site['index'], $site['line'] );

		if ( null !== $leak_line ) {
			$relative_call_file = ltrim( str_replace( $root, '', $site['file'] ), DIRECTORY_SEPARATOR );
			$key                = "{$function_name}@{$relative_call_file}:{$site['line']}";

			$findings[ $key ] = array(
				'function'    => $function_name,
				'declared_in' => ltrim( str_replace( $root, '', $declared_in['file'] ), DIRECTORY_SEPARATOR ),
				'call_file'   => $relative_call_file,
				'call_line'   => $site['line'],
				'leak_line'   => $leak_line,
			);
		}
	}
}

ksort( $findings );

if ( 'update-baseline' === $run_mode ) {
	// Only a finding with an ACTUAL reviewed reason on file gets accepted —
	// a finding with none must NOT appear in 'accepted', so 'check' keeps
	// failing on it until a human reviews it. (An earlier version of this
	// and the sibling coverage-check script wrote every finding into
	// 'accepted' regardless, only printing a warning for unreviewed ones —
	// a warning that's easy to miss is not a gate, so update-baseline could
	// silently mark a real, unreviewed leak as accepted. Fixed here too).
	$reasons     = godam_leak_known_reasons();
	$accepted    = array();
	$unexplained = array();

	foreach ( $findings as $key => $finding ) {
		if ( isset( $reasons[ $key ] ) ) {
			$finding['reason'] = $reasons[ $key ];
			$accepted[ $key ]  = $finding;
		} else {
			$unexplained[] = $key;
		}
	}

	$baseline = array(
		'generated_note' => 'Generated by bin/godam-interprocedural-leak-check.php update-baseline. A finding only enters "accepted" if godam_leak_known_reasons() already has a reason for it — this command does not review anything on its own. Findings with no reason stay failing in "check" mode.',
		'accepted'       => $accepted,
	);

	file_put_contents( $baseline_path, json_encode( $baseline, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n" );
	echo "Baseline written to {$baseline_path}.\n";
	echo 'Self-wrapped functions found: ' . count( $self_wrapped ) . ', accepted findings: ' . count( $accepted ) . "\n";

	if ( ! empty( $unexplained ) ) {
		echo "\n" . count( $unexplained ) . " finding(s) have NO reason on file, so they were NOT accepted —\n";
		echo "'check' will still report every one of them until you either fix the code or add a real\n";
		echo "reason to godam_leak_known_reasons() and re-run update-baseline:\n";
		foreach ( $unexplained as $key ) {
			echo " - {$key}\n";
		}
	}

	exit( 0 );
}

if ( ! file_exists( $baseline_path ) ) {
	fwrite( STDERR, "No baseline found at {$baseline_path}.\nRun: php bin/godam-interprocedural-leak-check.php update-baseline\n" );
	exit( 1 );
}

$baseline          = json_decode( file_get_contents( $baseline_path ), true );
$accepted_findings = is_array( $baseline ) ? ( $baseline['accepted'] ?? array() ) : array();

$new_findings = array_diff_key( $findings, $accepted_findings );

echo 'Self-wrapped functions tracked: ' . count( $self_wrapped ) . "\n";
echo 'Total candidate call sites flagged: ' . count( $findings ) . ' (' . count( $accepted_findings ) . " previously accepted)\n\n";

if ( ! empty( $new_findings ) ) {
	echo "NEW CANDIDATES (not in the accepted baseline):\n";
	foreach ( $new_findings as $finding ) {
		echo " - {$finding['function']}() is self-wrapped in {$finding['declared_in']}.\n";
		echo "   Called from {$finding['call_file']}:{$finding['call_line']}, with an attachment-access call\n";
		echo "   at {$finding['call_file']}:{$finding['leak_line']} in the same block, no enclosing wrap, and\n";
		echo "   no re-wrap in between. Read that code — this may be an interprocedural leak or a false\n";
		echo "   positive (see this script's own top-of-file comment for its known remaining imprecision).\n";
		echo "   If it's fine, run 'update-baseline' to accept it.\n\n";
	}

	echo "This script cannot tell a real leak from a false positive — see its own\n";
	echo "top-of-file comment for exactly what it can and can't detect. A human\n";
	echo "still needs to read each finding above.\n";
	exit( 1 );
}

echo "No new interprocedural-leak candidates since the last accepted baseline.\n";
exit( 0 );
