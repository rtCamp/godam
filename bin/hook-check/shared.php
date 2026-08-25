<?php
/**
 * Token-walking primitives shared by balance.php and coverage.php, so the
 * two scripts can't drift to
 * different definitions of "what counts as firing a hook."
 *
 * Shared: file listing, tokenizing, token navigation, call/hook-fire/
 * scope-terminator detection, function-boundary finding. NOT shared: each
 * script's own balance/coverage walk — their control flow genuinely
 * diverges there.
 *
 * @package GoDAM
 */

// phpcs:disable WordPress.WP.AlternativeFunctions -- CLI script, no WP bootstrap.

/**
 * Function names that actually fire a hook. Just `do_action` — these are
 * notification hooks with no return value to filter, so never
 * `apply_filters()`; `add_action()` registers a listener, it fires nothing.
 *
 * @var string[]
 */
const GODAM_HOOK_FIRE_FUNCTIONS = array( 'do_action' );

/**
 * Function names that end the current request/callback like `return`/
 * `throw` would, for balance-tracking. wp_send_json*() are included because
 * core calls wp_die() internally after echoing — the pattern this plugin's
 * REST handlers use for early exits.
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
 * Top-level directories (root only, not matched deeper) that never hold
 * hand-hookable plugin code — a deny-list, not an include-list, so a new
 * top-level directory is scanned by default rather than staying invisible.
 * `build`/`vendor` are already excluded at any depth; these are root-only
 * since they're not expected to recur as nested directory names.
 *
 * @var string[]
 */
const GODAM_EXCLUDED_ROOT_DIRS = array(
	'.git',
	'.github',
	'.husky',
	'.idea',
	'node_modules',
	'tests',
	'bin', // This tooling's own scripts — not plugin runtime code.
	'languages',
);

/**
 * Recursively lists every .php file under the plugin root, excluding
 * GODAM_EXCLUDED_ROOT_DIRS (root level only) plus the build/vendor
 * exclusions godam_shared_list_php_files() applies at any depth.
 *
 * @param string $plugin_root Absolute path to the plugin root.
 * @return string[] Absolute file paths.
 */
function godam_shared_list_all_php_files( $plugin_root ) {
	$files = array();

	foreach ( scandir( $plugin_root ) as $entry ) {
		if ( '.' === $entry || '..' === $entry ) {
			continue;
		}

		$path = $plugin_root . DIRECTORY_SEPARATOR . $entry;

		if ( is_dir( $path ) ) {
			if ( in_array( $entry, GODAM_EXCLUDED_ROOT_DIRS, true ) ) {
				continue;
			}
			$files = array_merge( $files, godam_shared_list_php_files( $path ) );
			continue;
		}

		if ( 'php' === strtolower( pathinfo( $path, PATHINFO_EXTENSION ) ) ) {
			$files[] = $path; // Root-level file, e.g. godam.php.
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
 * Recognizes one of the four godam-coverage-* directive comments — mirrors
 * phpcs:ignore/disable/enable/ignoreFile, minus a rule-code argument (each
 * checker here only ever checks one thing). Checked in this order so
 * "godam-coverage-ignore-file" is never misidentified as a plain "ignore".
 *
 * @param array[] $tokens Full token list for the file.
 * @param int     $i      Index to check.
 * @return array{directive: string, reason: string}|null One of
 *         'ignore-file'/'disable'/'enable'/'ignore', or null if this token
 *         isn't a comment or doesn't contain a directive.
 */
function godam_shared_coverage_directive_at( $tokens, $i ) {
	$id = $tokens[ $i ]['id'] ?? null;
	if ( T_COMMENT !== $id && T_DOC_COMMENT !== $id ) {
		return null;
	}

	$text = $tokens[ $i ]['text'];

	$patterns = array(
		'ignore-file' => '/godam-coverage-ignore-file\b\s*(?:--\s*(.*))?/',
		'disable'     => '/godam-coverage-disable\b\s*(?:--\s*(.*))?/',
		'enable'      => '/godam-coverage-enable\b\s*(?:--\s*(.*))?/',
		'ignore'      => '/godam-coverage-ignore\b\s*(?:--\s*(.*))?/',
	);

	foreach ( $patterns as $directive => $pattern ) {
		if ( preg_match( $pattern, $text, $m ) ) {
			$reason = trim( $m[1] ?? '' );
			return array(
				'directive' => $directive,
				'reason'    => '' !== $reason ? $reason : '(no reason given)',
			);
		}
	}

	return null;
}

/**
 * Scans a file's tokens for godam-coverage-ignore/disable/enable/ignore-file
 * comments and returns what they cover. Shared by both checker scripts so
 * one comment suppresses both.
 *
 * `godam-coverage-ignore` follows phpcs:ignore's own placement rule: as a
 * trailing comment it covers that same line; alone on its own line, it
 * covers the line after. `godam-coverage-disable`/`-enable` bracket a
 * range exclusive of both endpoints; multiple pairs per file are tracked.
 *
 * A disable with no matching enable before end of file is a hard error
 * (see 'dangling_disable') rather than silently suppressing the rest of
 * the file — the same footgun a forgotten phpcs:enable has in real phpcs.
 *
 * @param array[] $tokens Full token list for the file.
 * @return array{
 *     ignore_file: string|null,
 *     ignore_lines: array<int, string>,
 *     disabled_ranges: array<int, array{start:int, end:int, reason:string}>,
 *     dangling_disable: array{line:int, reason:string}|null,
 * }
 */
function godam_shared_coverage_directives( $tokens ) {
	$ignore_file     = null;
	$ignore_lines    = array();
	$disabled_ranges = array();
	$open_disable    = null;

	$count = count( $tokens );

	for ( $i = 0; $i < $count; $i++ ) {
		$directive = godam_shared_coverage_directive_at( $tokens, $i );
		if ( null === $directive ) {
			continue;
		}

		$line = $tokens[ $i ]['line'];

		switch ( $directive['directive'] ) {
			case 'ignore-file':
				$ignore_file = $directive['reason'];
				break;

			case 'disable':
				// A later, still-unclosed disable simply replaces the
				// tracked start — only the last one can end up dangling.
				$open_disable = array(
					'line'   => $line,
					'reason' => $directive['reason'],
				);
				break;

			case 'enable':
				if ( null !== $open_disable ) {
					$disabled_ranges[] = array(
						'start'  => $open_disable['line'],
						'end'    => $line,
						'reason' => $open_disable['reason'],
					);
					$open_disable      = null;
				}
				break;

			case 'ignore':
				$prev        = godam_shared_skip_backward( $tokens, $i - 1 );
				$same_line   = $prev >= 0 && $tokens[ $prev ]['line'] === $line;
				$target_line = $same_line ? $line : $line + 1;

				$ignore_lines[ $target_line ] = $directive['reason'];
				break;
		}
	}

	return array(
		'ignore_file'      => $ignore_file,
		'ignore_lines'     => $ignore_lines,
		'disabled_ranges'  => $disabled_ranges,
		'dangling_disable' => $open_disable,
	);
}

/**
 * Whether $line is covered by an ignore/disable directive already parsed
 * into $directives (see godam_shared_coverage_directives()) — checks
 * ignore_lines and disabled_ranges, NOT ignore_file (a whole-file ignore is
 * cheaper to check once per file than once per line; callers already do).
 *
 * @param array $directives Result of godam_shared_coverage_directives().
 * @param int   $line       Line to check.
 * @return string|null The reason text if covered, null otherwise.
 */
function godam_shared_coverage_directive_covers( $directives, $line ) {
	if ( isset( $directives['ignore_lines'][ $line ] ) ) {
		return $directives['ignore_lines'][ $line ];
	}

	foreach ( $directives['disabled_ranges'] as $range ) {
		if ( $line > $range['start'] && $line < $range['end'] ) {
			return $range['reason'];
		}
	}

	return null;
}

/**
 * Strips namespace qualification from $text, returning its final segment —
 * "get_post_meta" from "\get_post_meta" or "Foo\Bar\get_post_meta" alike.
 *
 * PHP 8 tokenizes an entire qualified name as one T_NAME_FULLY_QUALIFIED/
 * T_NAME_QUALIFIED token, so a plain `ltrim( $text, '\\' )` only strips a
 * leading backslash and still gets "Foo\get_post_meta" wrong.
 *
 * @param string $text Token text (already namespace-qualified or not).
 * @return string
 */
function godam_shared_unqualified_name( $text ) {
	return substr( strrchr( '\\' . ltrim( $text, '\\' ), '\\' ), 1 );
}

/**
 * Whether the token at $i is a real call to one of $names: a T_STRING or
 * qualified-name token (T_NAME_FULLY_QUALIFIED/T_NAME_QUALIFIED — see
 * godam_shared_unqualified_name()) matching one of $names, immediately
 * followed by '(', and NOT preceded by `new`.
 *
 * Qualified names matter so a leading-backslash call like
 * `\get_post_meta(...)` (forcing global-namespace resolution from inside a
 * namespaced file) isn't invisible to every check built on this. The `new`
 * exclusion matters because a class and a free function can share a bare
 * name — without it, `new Helper()` is indistinguishable from a call to a
 * function also named Helper (e.g. `new do_action(...)` would otherwise
 * fool hook-fire detection).
 *
 * @param array[] $tokens Full token list for the file.
 * @param int     $i      Index to check.
 * @param array   $names  Function names to match.
 * @param int     $count  Token count.
 * @return bool
 */
function godam_shared_is_call_to( $tokens, $i, $names, $count ) {
	$id = $tokens[ $i ]['id'] ?? null;
	if ( ! in_array( $id, array( T_STRING, T_NAME_FULLY_QUALIFIED, T_NAME_QUALIFIED ), true ) ) {
		return false;
	}

	$name = T_STRING === $id ? $tokens[ $i ]['text'] : godam_shared_unqualified_name( $tokens[ $i ]['text'] );
	if ( ! in_array( $name, $names, true ) ) {
		return false;
	}

	$n = godam_shared_skip_forward( $tokens, $i + 1, $count );
	if ( $n >= $count || '(' !== $tokens[ $n ]['text'] ) {
		return false;
	}

	$p = godam_shared_skip_backward( $tokens, $i - 1 );
	return ! ( $p >= 0 && T_NEW === ( $tokens[ $p ]['id'] ?? null ) );
}

/**
 * Whether the token at $i is the NAME in a function/method declaration
 * ("function name(" or "function &name(" for return-by-reference) rather
 * than a call — both tokenize identically (T_STRING followed by '('), so
 * anything matching by name+"(" needs this check wherever the matched set
 * could include a real, user-defined function/method name.
 *
 * Needed by godam_shared_is_bare_call_to(): without it, a user-defined
 * method named get_children() or get_posts() would have its own
 * declaration misread as a call to the global function of the same name.
 *
 * @param array[] $tokens Full token list for the file.
 * @param int     $i      Index to check.
 * @return bool
 */
function godam_shared_is_function_declaration_at( $tokens, $i ) {
	$p = godam_shared_skip_backward( $tokens, $i - 1 );

	if ( $p >= 0 && T_FUNCTION === ( $tokens[ $p ]['id'] ?? null ) ) {
		return true;
	}

	if ( $p >= 0 && '&' === $tokens[ $p ]['text'] ) {
		$before_amp = godam_shared_skip_backward( $tokens, $p - 1 );
		return $before_amp >= 0 && T_FUNCTION === ( $tokens[ $before_amp ]['id'] ?? null );
	}

	return false;
}

/**
 * Whether the token at $i is a real call to one of $names (per
 * godam_shared_is_call_to()) that's neither method-style (preceded by ->
 * or ::) nor a same-named function/method declaration
 * (godam_shared_is_function_declaration_at()).
 *
 * Needed because a name match alone can't tell a global call apart from an
 * unrelated class's own same-named method — e.g. $query->get_posts() reads
 * an already-run WP_Query's cached results, not a fresh query, but
 * tokenizes identically to the global get_posts() call. Used for
 * get_posts()/get_children(); not needed for $wpdb calls (already gated on
 * `$wpdb->`) or ACCESS_FUNCTIONS (no confirmed collision today).
 *
 * @param array[] $tokens Full token list for the file.
 * @param int     $i      Index to check.
 * @param array   $names  Function names to match.
 * @param int     $count  Token count.
 * @return bool
 */
function godam_shared_is_bare_call_to( $tokens, $i, $names, $count ) {
	if ( ! godam_shared_is_call_to( $tokens, $i, $names, $count ) ) {
		return false;
	}

	if ( godam_shared_is_function_declaration_at( $tokens, $i ) ) {
		return false;
	}

	$p = godam_shared_skip_backward( $tokens, $i - 1 );
	return ! ( $p >= 0 && in_array( $tokens[ $p ]['text'], array( '->', '::' ), true ) );
}

/**
 * Whether the T_CONSTANT_ENCAPSED_STRING token at $i is $hook_name, passed
 * as the first argument to a real, bare call to one of $outer_functions —
 * e.g. do_action( 'x' ).
 *
 * Uses godam_shared_is_bare_call_to() so a class with its own do_action()
 * method can't fake a hook fire (e.g. $logger->do_action(...), an unrelated
 * logging call). Safe: do_action()/wp_die()/wp_send_json*() are core
 * globals, never legitimately called via ->/::.
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

	return $p >= 0 && godam_shared_is_bare_call_to( $tokens, $p, $outer_functions, $count );
}

/**
 * $wpdb methods that execute a real, potentially attachment-touching query.
 * Tracked separately from ACCESS_FUNCTIONS since these are only ever
 * invoked as a method on the $wpdb global.
 *
 * @var string[]
 */
const GODAM_WPDB_QUERY_METHODS = array( 'get_results', 'get_row', 'get_col', 'get_var', 'query', 'update', 'delete', 'insert', 'replace' );

/**
 * Whether the token at $i is a real call to one of $methods specifically on
 * the $wpdb global — T_STRING matching one of $methods, immediately
 * preceded by '->' and, before that, the T_VARIABLE $wpdb (skipping
 * whitespace/comments), and immediately followed by '('.
 *
 * @param array[] $tokens  Full token list for the file.
 * @param int     $i       Index to check.
 * @param array   $methods Method names to match.
 * @param int     $count   Token count.
 * @return bool
 */
function godam_shared_is_wpdb_call_to( $tokens, $i, $methods, $count ) {
	if ( T_STRING !== ( $tokens[ $i ]['id'] ?? null ) || ! in_array( $tokens[ $i ]['text'], $methods, true ) ) {
		return false;
	}

	$n = godam_shared_skip_forward( $tokens, $i + 1, $count );
	if ( $n >= $count || '(' !== $tokens[ $n ]['text'] ) {
		return false;
	}

	$p = godam_shared_skip_backward( $tokens, $i - 1 );
	if ( $p < 0 || T_OBJECT_OPERATOR !== ( $tokens[ $p ]['id'] ?? null ) ) {
		return false;
	}

	$p = godam_shared_skip_backward( $tokens, $p - 1 );
	return $p >= 0 && T_VARIABLE === ( $tokens[ $p ]['id'] ?? null ) && '$wpdb' === $tokens[ $p ]['text'];
}

/**
 * Whether the token at $i starts a `new WP_Query(` expression — bare
 * (T_STRING) or namespace-qualified (T_NAME_FULLY_QUALIFIED/
 * T_NAME_QUALIFIED). This codebase uses both forms in different files, so a
 * T_STRING-only check would silently miss the qualified ones.
 *
 * @param array[] $tokens Full token list for the file.
 * @param int     $i      Index to check.
 * @param int     $count  Token count.
 * @return bool
 */
function godam_shared_is_new_wp_query_at( $tokens, $i, $count ) {
	if ( T_NEW !== ( $tokens[ $i ]['id'] ?? null ) ) {
		return false;
	}

	$j = godam_shared_skip_forward( $tokens, $i + 1, $count );
	if ( $j >= $count ) {
		return false;
	}

	$is_class_name_token = in_array( $tokens[ $j ]['id'] ?? null, array( T_STRING, T_NAME_FULLY_QUALIFIED, T_NAME_QUALIFIED ), true );
	if ( ! $is_class_name_token || 'WP_Query' !== godam_shared_unqualified_name( $tokens[ $j ]['text'] ) ) {
		return false;
	}

	$n = godam_shared_skip_forward( $tokens, $j + 1, $count );
	return $n < $count && '(' === $tokens[ $n ]['text'];
}

/**
 * Given the index of an opening '(' or '[', returns its matching closer by
 * tracking depth for that bracket type. Returns $count if unbalanced.
 *
 * General form of godam_shared_find_matching_paren() (kept as a thin
 * '('-only wrapper since most callers only bound a call's own argument
 * list); this version also bounds an array-literal `[ ... ]` post_type
 * value.
 *
 * @param array[] $tokens     Full token list for the file.
 * @param int     $open_index Index of the opening '(' or '['.
 * @param int     $count      Token count.
 * @return int
 */
function godam_shared_find_matching_bracket( $tokens, $open_index, $count ) {
	$open_char  = $tokens[ $open_index ]['text'];
	$close_char = '(' === $open_char ? ')' : ']';
	$depth      = 1;
	$j          = $open_index + 1;

	while ( $j < $count && $depth > 0 ) {
		if ( $open_char === $tokens[ $j ]['text'] ) {
			++$depth;
		} elseif ( $close_char === $tokens[ $j ]['text'] ) {
			--$depth;
		}
		++$j;
	}

	return $depth > 0 ? $count : $j - 1;
}

/**
 * Given the index of a call's opening '(', returns the index of its
 * matching ')' by tracking paren depth. Returns $count (out of range) if
 * unbalanced.
 *
 * @param array[] $tokens     Full token list for the file.
 * @param int     $open_index Index of the opening '('.
 * @param int     $count      Token count.
 * @return int
 */
function godam_shared_find_matching_paren( $tokens, $open_index, $count ) {
	return godam_shared_find_matching_bracket( $tokens, $open_index, $count );
}

/**
 * Given a target range and a list of candidate ranges (each with
 * 'body_start'/'body_end' keys), returns every candidate STRICTLY NESTED
 * inside the target range, as [start, end] pairs for a $skip_ranges
 * argument.
 *
 * Excludes an exact self-match: when the candidate list is the same list a
 * range came from (e.g. "what's nested inside function F" using the full
 * $functions list F is itself in), F would otherwise match itself and the
 * walk would jump straight past its own body on the first iteration — the
 * same bug shape found and fixed for deferred closures earlier, now guarded
 * here generically.
 *
 * @param int     $range_start Token index to start at (inclusive).
 * @param int     $range_end   Token index to end at (inclusive).
 * @param array[] $candidates  Each with 'body_start'/'body_end' keys.
 * @return array[] Each [start, end] (inclusive token indexes).
 */
function godam_shared_ranges_nested_in( $range_start, $range_end, $candidates ) {
	$nested = array();
	foreach ( $candidates as $candidate ) {
		$is_self = $candidate['body_start'] === $range_start && $candidate['body_end'] === $range_end;
		if ( ! $is_self && $candidate['body_start'] >= $range_start && $candidate['body_end'] <= $range_end ) {
			$nested[] = array( $candidate['body_start'], $candidate['body_end'] );
		}
	}
	return $nested;
}

/**
 * Whether [$range_start, $range_end] contains a `'post_type' =>
 * 'attachment'/'any'` pair, or a `post_type => array(...)`/`[...]` value
 * mentioning either string anywhere inside it (a common way to query more
 * than one post type).
 *
 * The bare-string branch deliberately scans the WHOLE range rather than
 * tracing the query's own $args variable — real query args in this
 * codebase are built incrementally across several statements. This is a
 * permissive heuristic: a false positive here just means one more finding
 * for a human to dismiss, not a missed real gap.
 *
 * @param array[] $tokens      Full token list for the file.
 * @param int     $range_start Token index to start at (inclusive).
 * @param int     $range_end   Token index to end at (inclusive).
 * @param int     $count       Token count.
 * @return bool
 */
function godam_shared_range_targets_attachment_post_type( $tokens, $range_start, $range_end, $count ) {
	for ( $i = $range_start; $i <= $range_end; $i++ ) {
		if ( T_CONSTANT_ENCAPSED_STRING !== ( $tokens[ $i ]['id'] ?? null ) ) {
			continue;
		}

		if ( "'post_type'" !== $tokens[ $i ]['text'] && '"post_type"' !== $tokens[ $i ]['text'] ) {
			continue;
		}

		$arrow = godam_shared_skip_forward( $tokens, $i + 1, $count );
		if ( $arrow >= $count || T_DOUBLE_ARROW !== ( $tokens[ $arrow ]['id'] ?? null ) ) {
			continue;
		}

		$value = godam_shared_skip_forward( $tokens, $arrow + 1, $count );
		if ( $value >= $count ) {
			continue;
		}

		if ( T_CONSTANT_ENCAPSED_STRING === ( $tokens[ $value ]['id'] ?? null ) ) {
			if ( in_array( substr( $tokens[ $value ]['text'], 1, -1 ), array( 'attachment', 'any' ), true ) ) {
				return true;
			}
			continue;
		}

		$is_array_call    = T_ARRAY === ( $tokens[ $value ]['id'] ?? null );
		$is_array_literal = null === ( $tokens[ $value ]['id'] ?? null ) && '[' === $tokens[ $value ]['text'];

		if ( ! $is_array_call && ! $is_array_literal ) {
			continue; // A variable, constant, or function call — not statically readable either way.
		}

		$open = $is_array_call ? godam_shared_skip_forward( $tokens, $value + 1, $count ) : $value;
		if ( $open >= $count || ( '(' !== $tokens[ $open ]['text'] && '[' !== $tokens[ $open ]['text'] ) ) {
			continue;
		}

		$close = godam_shared_find_matching_bracket( $tokens, $open, $count );

		for ( $j = $open; $j <= $close && $j < $count; $j++ ) {
			if ( T_CONSTANT_ENCAPSED_STRING === ( $tokens[ $j ]['id'] ?? null ) && in_array( substr( $tokens[ $j ]['text'], 1, -1 ), array( 'attachment', 'any' ), true ) ) {
				return true;
			}
		}
	}

	return false;
}

/**
 * Whether [$range_start, $range_end] (typically a $wpdb query's own
 * argument list) mentions postmeta or wp_posts — used to flag a raw $wpdb
 * query as attachment-shaped. Over-includes non-attachment queries too
 * (both tables hold every post type) — the same permissive tradeoff as
 * godam_shared_range_targets_attachment_post_type().
 *
 * Also catches `$wpdb->posts`/`$wpdb->postmeta` referenced via string
 * interpolation (braced or not) — PHP's tokenizer parses both exactly like
 * code outside a string, landing $wpdb/->/posts as three separate tokens
 * that never contain "wp_posts" as their own text, so the plain substring
 * check above would otherwise miss e.g. `FROM {$wpdb->posts} p`.
 *
 * @param array[] $tokens      Full token list for the file.
 * @param int     $range_start Token index to start at (inclusive).
 * @param int     $range_end   Token index to end at (inclusive).
 * @return bool
 */
function godam_shared_range_mentions_post_tables( $tokens, $range_start, $range_end ) {
	$count = count( $tokens );

	for ( $i = $range_start; $i <= $range_end; $i++ ) {
		$text = strtolower( $tokens[ $i ]['text'] );
		if ( false !== strpos( $text, 'postmeta' ) || false !== strpos( $text, 'wp_posts' ) ) {
			return true;
		}

		if ( '$wpdb' !== $tokens[ $i ]['text'] ) {
			continue;
		}

		$arrow = godam_shared_skip_forward( $tokens, $i + 1, $count );
		if ( $arrow >= $count || '->' !== $tokens[ $arrow ]['text'] ) {
			continue;
		}

		$prop = godam_shared_skip_forward( $tokens, $arrow + 1, $count );
		if ( $prop < $count && in_array( strtolower( $tokens[ $prop ]['text'] ), array( 'posts', 'postmeta' ), true ) ) {
			return true;
		}
	}

	return false;
}

/**
 * Whether the argument starting at the call's own opening '(' (index
 * $open_index) is itself a bare call to another named function — e.g. the
 * `helper()` in `new WP_Query( helper() )` — rather than an inline
 * array/array literal or a variable built in the same scope.
 *
 * Used to widen godam_shared_query_pattern_at()'s attachment-shaped default
 * for exactly this shape: godam_shared_range_targets_attachment_post_type()
 * scans the calling scope's own tokens, so it can't see a 'post_type'
 * literal that genuinely lives inside a callee it never looks into. A real
 * gap this caught: a gallery template's query-mode WP_Query took its args
 * from a helper that sets post_type => 'attachment' internally — the scan
 * found nothing in the caller's own scope and the query was never flagged
 * at all, despite running fully unwrapped.
 *
 * @param array[] $tokens     Full token list for the file.
 * @param int     $open_index Index of the call's own opening '('.
 * @param int     $count      Token count.
 * @return bool
 */
function godam_shared_first_arg_is_function_call( $tokens, $open_index, $count ) {
	$first = godam_shared_skip_forward( $tokens, $open_index + 1, $count );
	if ( $first >= $count || ! in_array( $tokens[ $first ]['id'] ?? null, array( T_STRING, T_NAME_FULLY_QUALIFIED, T_NAME_QUALIFIED ), true ) ) {
		return false;
	}

	$next = godam_shared_skip_forward( $tokens, $first + 1, $count );
	return $next < $count && '(' === $tokens[ $next ]['text'];
}

/**
 * If the token at $i starts a WP_Query/get_posts()/get_children()/$wpdb
 * query-method call, returns ['kind' => ..., 'name' => ...,
 * 'is_attachment_shaped' => bool]. Returns null otherwise.
 *
 * These read/write the same postmeta/posts data ACCESS_FUNCTIONS does, but
 * aren't a plain `name(` call it can detect (see GODAM_WPDB_QUERY_METHODS).
 *
 * get_children()'s attachment-shaped check only catches an explicit
 * post_type — a bare `get_children( $post_id )` also returns attachments by
 * WP's own default, but that has no 'post_type' string to find, so it's an
 * accepted gap rather than modeling core's default-argument behavior.
 *
 * get_posts()/get_children() use godam_shared_is_bare_call_to() to exclude
 * method-style calls like `$query->get_posts()` (cached results, not a
 * fresh query — see that function's own comment).
 *
 * Always a "direct" finding, never parameter-sourced: unlike
 * get_post_meta( $id, ... ), none of these take a single attachment-ID
 * argument to check against a safe-parameter set.
 *
 * @param array[] $tokens      Full token list for the file.
 * @param int     $i           Index to check.
 * @param int     $range_start Enclosing scope's start (for the post_type scan).
 * @param int     $range_end   Enclosing scope's end.
 * @param int     $count       Token count.
 * @return array|null
 */
function godam_shared_query_pattern_at( $tokens, $i, $range_start, $range_end, $count ) {
	if ( godam_shared_is_new_wp_query_at( $tokens, $i, $count ) ) {
		$class_name_index = godam_shared_skip_forward( $tokens, $i + 1, $count );
		$open             = godam_shared_skip_forward( $tokens, $class_name_index + 1, $count );

		return array(
			'kind'                 => 'wp_query',
			'name'                 => 'new WP_Query',
			'is_attachment_shaped' => godam_shared_range_targets_attachment_post_type( $tokens, $range_start, $range_end, $count )
				|| godam_shared_first_arg_is_function_call( $tokens, $open, $count ),
		);
	}

	if ( godam_shared_is_bare_call_to( $tokens, $i, array( 'get_posts' ), $count ) ) {
		$open = godam_shared_skip_forward( $tokens, $i + 1, $count );

		return array(
			'kind'                 => 'get_posts',
			'name'                 => 'get_posts',
			'is_attachment_shaped' => godam_shared_range_targets_attachment_post_type( $tokens, $range_start, $range_end, $count )
				|| godam_shared_first_arg_is_function_call( $tokens, $open, $count ),
		);
	}

	if ( godam_shared_is_bare_call_to( $tokens, $i, array( 'get_children' ), $count ) ) {
		$open = godam_shared_skip_forward( $tokens, $i + 1, $count );

		return array(
			'kind'                 => 'get_children',
			'name'                 => 'get_children',
			'is_attachment_shaped' => godam_shared_range_targets_attachment_post_type( $tokens, $range_start, $range_end, $count )
				|| godam_shared_first_arg_is_function_call( $tokens, $open, $count ),
		);
	}

	if ( godam_shared_is_wpdb_call_to( $tokens, $i, GODAM_WPDB_QUERY_METHODS, $count ) ) {
		$open  = godam_shared_skip_forward( $tokens, $i + 1, $count );
		$close = godam_shared_find_matching_paren( $tokens, $open, $count );

		return array(
			'kind'                 => 'wpdb',
			'name'                 => '$wpdb->' . $tokens[ $i ]['text'],
			'is_attachment_shaped' => godam_shared_range_mentions_post_tables( $tokens, $open, $close ),
		);
	}

	return null;
}

/**
 * Whether the token at $i unconditionally ends the current function/request:
 * `return`/`throw`/`exit`/`die` (T_EXIT covers both spellings), or a real,
 * bare call to one of GODAM_TERMINATOR_FUNCTIONS.
 *
 * Uses godam_shared_is_bare_call_to() for the same reason
 * godam_shared_is_hook_fire_at() does — a class with its own wp_die()-named
 * method would otherwise wrongly end a scope early. Safe: all four names
 * are core globals, never called via ->/::.
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

	return godam_shared_is_bare_call_to( $tokens, $i, GODAM_TERMINATOR_FUNCTIONS, $count );
}

/**
 * Finds named class/interface/trait declarations: name, whether it's a
 * trait (T_TRAIT), and body token range, by tracking brace depth.
 *
 * The trait flag lets godam_shared_find_trait_uses() and the
 * coverage-checker's caller trace widen a private trait method's search to
 * every file that `use`s the trait. The name lets godam_shared_find_functions()
 * class-qualify each method (`Foo::render()`, not a bare `render()`).
 *
 * @param array[] $tokens Normalized tokens from godam_shared_tokenize().
 * @return array[] Each: name, is_trait (bool), body_start, body_end (token indexes).
 */
function godam_shared_find_classes( $tokens ) {
	$classes = array();
	$count   = count( $tokens );

	for ( $i = 0; $i < $count; $i++ ) {
		if ( ! in_array( $tokens[ $i ]['id'] ?? null, array( T_CLASS, T_INTERFACE, T_TRAIT ), true ) ) {
			continue;
		}

		$is_trait = T_TRAIT === $tokens[ $i ]['id'];

		$j = godam_shared_skip_forward( $tokens, $i + 1, $count );
		if ( $j >= $count ) {
			continue;
		}

		if ( T_STRING === ( $tokens[ $j ]['id'] ?? null ) ) {
			$name = $tokens[ $j ]['text'];
		} else {
			// Anonymous class — a synthetic name keyed by token index lets
			// godam_shared_find_functions() still class-qualify its methods,
			// instead of leaving class = null and matching a bare `name(`
			// call site by mistake.
			$name = "class@anonymous:{$i}";
		}

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
			'is_trait'   => $is_trait,
			'body_start' => $body_start,
			'body_end'   => $body_end,
		);

		// Deliberately NOT jumping past this class's own body: an anonymous
		// class can appear inside a method of an already-recorded outer
		// class, and jumping past it would skip the anonymous class's own
		// T_CLASS token, wrongly class-qualifying every method inside it as
		// the OUTER class. The outer class's own token index has already
		// been passed by the time its body is scanned, so it's never re-found.
	}

	return $classes;
}

/**
 * Finds every `use TraitName[, ...];` statement inside a class body,
 * returning which trait names each class imports. Scoped strictly between
 * a class's own body_start/body_end — a class body can't have a
 * namespace-import `use`, so this can't be confused with that.
 *
 * Excludes any OTHER class nested inside the one being scanned
 * (godam_shared_ranges_nested_in()) — otherwise a `use` statement really
 * only inside an inner (often anonymous) class would also be recorded as
 * the outer class's own import.
 *
 * Trait names are normalized via godam_shared_unqualified_name() so a
 * qualified `use \Foo\Bar\SomeTrait;` still matches a plain `trait
 * SomeTrait` declaration found elsewhere.
 *
 * @param array[] $tokens  Normalized tokens from godam_shared_tokenize().
 * @param array[] $classes This file's own godam_shared_find_classes() result.
 * @return array<string, string[]> Trait short name => list of (this file's) class names that `use` it.
 */
function godam_shared_find_trait_uses( $tokens, $classes ) {
	$uses  = array();
	$count = count( $tokens );

	foreach ( $classes as $class ) {
		$skip_ranges = godam_shared_ranges_nested_in( $class['body_start'], $class['body_end'], $classes );

		for ( $i = $class['body_start']; $i <= $class['body_end']; $i++ ) {
			$jumped = false;
			foreach ( $skip_ranges as $skip ) {
				if ( $i === $skip[0] ) {
					$i      = $skip[1];
					$jumped = true;
					break;
				}
			}
			if ( $jumped ) {
				continue;
			}

			if ( T_USE !== ( $tokens[ $i ]['id'] ?? null ) ) {
				continue;
			}

			$j = godam_shared_skip_forward( $tokens, $i + 1, $count );

			while ( $j <= $class['body_end'] && in_array( $tokens[ $j ]['id'] ?? null, array( T_STRING, T_NAME_FULLY_QUALIFIED, T_NAME_QUALIFIED ), true ) ) {
				$short_name            = godam_shared_unqualified_name( $tokens[ $j ]['text'] );
				$uses[ $short_name ][] = $class['name'];

				$j = godam_shared_skip_forward( $tokens, $j + 1, $count );
				if ( $j <= $class['body_end'] && ',' === $tokens[ $j ]['text'] ) {
					$j = godam_shared_skip_forward( $tokens, $j + 1, $count );
					continue;
				}
				break;
			}
		}
	}

	return $uses;
}

/**
 * Function names whose typical call shape passes a callback (directly, or
 * nested in an args array) that WordPress stores and invokes later,
 * potentially on a different request than the one that registered it.
 *
 * Two of these, register_activation_hook()/register_deactivation_hook(),
 * take __FILE__ (not a string) as their first argument, so hook_name comes
 * back null for those. register_rest_route()'s callback, nested in its
 * 'callback' => ... entry, is already handled since the search scans every
 * token in the call's parens regardless of argument position.
 *
 * @var string[]
 */
const GODAM_DEFERRED_CALLBACK_FUNCTIONS = array(
	'add_action',
	'add_filter',
	'add_shortcode',
	'register_activation_hook',
	'register_deactivation_hook',
	'register_rest_route',
);

/**
 * Given a T_FUNCTION token confirmed to start an anonymous closure,
 * extracts its parameter names and body token range by tracking
 * paren/brace depth. Returns null if $j isn't an anonymous closure, or if
 * $count is reached before a body is found (unbalanced — bail rather than
 * guess). Shared by both ways godam_shared_find_deferred_closures() finds a
 * deferred closure: passed inline, or assigned to a variable first.
 *
 * @param array[] $tokens Full token list for the file.
 * @param int     $j      Index of the T_FUNCTION token.
 * @param int     $count  Token count.
 * @return array{params: string[], body_start: int, body_end: int}|null
 */
function godam_shared_extract_closure_at( $tokens, $j, $count ) {
	$k = godam_shared_skip_forward( $tokens, $j + 1, $count );
	if ( $k < $count && '&' === $tokens[ $k ]['text'] ) { // Return-by-reference closure.
		$k = godam_shared_skip_forward( $tokens, $k + 1, $count );
	}
	if ( $k < $count && T_STRING === ( $tokens[ $k ]['id'] ?? null ) ) {
		return null; // Named, not anonymous.
	}

	while ( $k < $count && '(' !== $tokens[ $k ]['text'] ) {
		++$k;
	}
	if ( $k >= $count ) {
		return null;
	}

	// Parameter list, extracted the same way godam_shared_find_functions()
	// does, so it can be walked as its own scope with its own params.
	$params      = array();
	$paren_depth = 1;
	++$k;
	while ( $k < $count && $paren_depth > 0 ) {
		if ( '(' === $tokens[ $k ]['text'] ) {
			++$paren_depth;
		} elseif ( ')' === $tokens[ $k ]['text'] ) {
			--$paren_depth;
		} elseif ( 1 === $paren_depth && T_VARIABLE === ( $tokens[ $k ]['id'] ?? null ) ) {
			$params[] = ltrim( $tokens[ $k ]['text'], '$' );
		}
		++$k;
	}

	$body_start = $k;
	while ( $body_start < $count && '{' !== $tokens[ $body_start ]['text'] ) {
		++$body_start;
	}
	if ( $body_start >= $count ) {
		return null;
	}

	$brace_depth = 1;
	$body_end    = $body_start + 1;
	while ( $body_end < $count && $brace_depth > 0 ) {
		if ( '{' === $tokens[ $body_end ]['text'] ) {
			++$brace_depth;
		} elseif ( '}' === $tokens[ $body_end ]['text'] ) {
			--$brace_depth;
		}
		++$body_end;
	}
	--$body_end;

	if ( $body_end >= $count ) {
		return null;
	}

	return array(
		'params'     => $params,
		'body_start' => $body_start,
		'body_end'   => $body_end,
	);
}

/**
 * Finds every `$var = function(...) {...};` assignment anywhere in the
 * token stream — a closure assigned to a variable first, rather than
 * passed inline. Used so godam_shared_find_deferred_closures() can also
 * recognize the "assign, then register by variable" shape.
 *
 * @param array[] $tokens Full token list for the file.
 * @return array[] Each: var_name (unprefixed), params, body_start, body_end.
 */
function godam_shared_find_closure_assignments( $tokens ) {
	$assignments = array();
	$count       = count( $tokens );

	for ( $i = 0; $i < $count; $i++ ) {
		if ( T_VARIABLE !== ( $tokens[ $i ]['id'] ?? null ) ) {
			continue;
		}

		$eq = godam_shared_skip_forward( $tokens, $i + 1, $count );
		if ( $eq >= $count || '=' !== $tokens[ $eq ]['text'] ) {
			continue;
		}

		$fn = godam_shared_skip_forward( $tokens, $eq + 1, $count );
		if ( $fn >= $count || T_FUNCTION !== ( $tokens[ $fn ]['id'] ?? null ) ) {
			continue;
		}

		$closure = godam_shared_extract_closure_at( $tokens, $fn, $count );
		if ( null === $closure ) {
			continue;
		}

		$assignments[] = array_merge(
			array( 'var_name' => ltrim( $tokens[ $i ]['text'], '$' ) ),
			$closure
		);

		$i = $closure['body_end']; // Resume after this closure.
	}

	return $assignments;
}

/**
 * Finds every anonymous closure effectively DEFERRED to one of
 * GODAM_DEFERRED_CALLBACK_FUNCTIONS: passed directly (or nested in an args
 * array) to a call to one of them, or assigned to a variable first and that
 * variable passed later. Returns each closure's hook name (when the
 * registration call's first argument is a plain string) and body range.
 *
 * A deferred callback does NOT inherit whatever before/after bracket
 * happens to be open where it's merely DEFINED — it runs later, whenever
 * the hook fires, possibly on a different request. Scoped to
 * GODAM_DEFERRED_CALLBACK_FUNCTIONS specifically, not every closure —
 * array_map()/usort()/an IIFE all run their closure synchronously inline,
 * genuinely inheriting the surrounding bracket correctly.
 *
 * Only matches T_FUNCTION, not T_FN (arrow functions) — unused by any
 * registration call in this codebase today, a narrow accepted gap.
 *
 * The variable-mediated shape requires the assignment and the registration
 * call to share the same enclosing function
 * (godam_shared_same_enclosing_function()) before matching by variable
 * name, so two unrelated functions each using a same-named local (e.g.
 * `$cb`) can't cross-match.
 *
 * Both registration-call scans use plain godam_shared_is_call_to(), not
 * godam_shared_is_bare_call_to(): unlike do_action()/wp_die(), add_action()/
 * add_filter() have a genuine OOP equivalent (e.g. a Loader's
 * `$this->loader->add_action(...)`) that must still be recognized here. A
 * class with an unrelated, non-wrapper add_action()-named method produces a
 * false positive instead — the safe direction to be wrong in.
 *
 * @param array[] $tokens    Full token list for the file.
 * @param array[] $functions This file's own godam_shared_find_functions() result — used only to scope the variable-mediated shape above.
 * @return array[] Each: hook_name (string|null — null if the hook name
 *                  isn't a plain string literal), params (string[] of the
 *                  closure's own parameter names, unprefixed by $),
 *                  body_start, body_end (token indexes of the closure's own
 *                  '{'/'}').
 */
function godam_shared_find_deferred_closures( $tokens, $functions ) {
	$closures = array();
	$count    = count( $tokens );

	// Phase 1: an inline closure passed directly as (or nested inside an
	// args array for) an argument to a registration call.
	for ( $i = 0; $i < $count; $i++ ) {
		if ( ! godam_shared_is_call_to( $tokens, $i, GODAM_DEFERRED_CALLBACK_FUNCTIONS, $count ) ) {
			continue;
		}

		$open  = godam_shared_skip_forward( $tokens, $i + 1, $count );
		$close = godam_shared_find_matching_paren( $tokens, $open, $count );

		if ( $close >= $count ) {
			continue; // Unbalanced — bail rather than guess.
		}

		$hook_name = null;
		$first_arg = godam_shared_skip_forward( $tokens, $open + 1, $count );
		if ( $first_arg < $close && T_CONSTANT_ENCAPSED_STRING === ( $tokens[ $first_arg ]['id'] ?? null ) ) {
			$hook_name = substr( $tokens[ $first_arg ]['text'], 1, -1 );
		}

		for ( $j = $open + 1; $j < $close; $j++ ) {
			if ( T_FUNCTION !== ( $tokens[ $j ]['id'] ?? null ) ) {
				continue;
			}

			$closure = godam_shared_extract_closure_at( $tokens, $j, $count );
			if ( null === $closure ) {
				continue;
			}

			$closures[] = array_merge( array( 'hook_name' => $hook_name ), $closure );

			$j = $closure['body_end']; // Resume after this closure.
		}
	}

	// Phase 2: a closure assigned to a variable first, then the variable
	// passed to a registration call — e.g. `$cb = function(){}; add_action(
	// 'init', $cb );`. Phase 1 can't see this: the call's args contain a
	// T_VARIABLE, not a T_FUNCTION.
	$assignments = godam_shared_find_closure_assignments( $tokens );
	if ( empty( $assignments ) ) {
		return $closures;
	}

	$assignments_by_var = array();
	foreach ( $assignments as $assignment ) {
		// Uses the closure's own body_start as a stand-in for the assignment's position.
		$assignment['enclosing']                         = godam_shared_enclosing_function_at( $assignment['body_start'], $functions );
		$assignments_by_var[ $assignment['var_name'] ][] = $assignment;
	}

	$already_deferred = array();
	foreach ( $closures as $closure ) {
		$already_deferred[ $closure['body_start'] ] = true;
	}

	for ( $i = 0; $i < $count; $i++ ) {
		if ( ! godam_shared_is_call_to( $tokens, $i, GODAM_DEFERRED_CALLBACK_FUNCTIONS, $count ) ) {
			continue;
		}

		$open  = godam_shared_skip_forward( $tokens, $i + 1, $count );
		$close = godam_shared_find_matching_paren( $tokens, $open, $count );

		if ( $close >= $count ) {
			continue;
		}

		$hook_name = null;
		$first_arg = godam_shared_skip_forward( $tokens, $open + 1, $count );
		if ( $first_arg < $close && T_CONSTANT_ENCAPSED_STRING === ( $tokens[ $first_arg ]['id'] ?? null ) ) {
			$hook_name = substr( $tokens[ $first_arg ]['text'], 1, -1 );
		}

		$call_enclosing = godam_shared_enclosing_function_at( $i, $functions );

		for ( $j = $open + 1; $j < $close; $j++ ) {
			if ( T_VARIABLE !== ( $tokens[ $j ]['id'] ?? null ) ) {
				continue;
			}

			$var_name = ltrim( $tokens[ $j ]['text'], '$' );

			foreach ( $assignments_by_var[ $var_name ] ?? array() as $assignment ) {
				if ( isset( $already_deferred[ $assignment['body_start'] ] ) ) {
					continue; // Already recorded via another registration call referencing the same variable.
				}

				if ( ! godam_shared_same_enclosing_function( $assignment['enclosing'], $call_enclosing ) ) {
					continue; // A different function's own local of the same name — not this assignment's value.
				}

				$closures[] = array(
					'hook_name'  => $hook_name,
					'params'     => $assignment['params'],
					'body_start' => $assignment['body_start'],
					'body_end'   => $assignment['body_end'],
				);

				$already_deferred[ $assignment['body_start'] ] = true;
			}
		}
	}

	return $closures;
}

/**
 * Determines the visibility modifier on the method declaration whose
 * `function` keyword is at $i, scanning backward over visibility/static/
 * abstract/final modifiers in any order.
 *
 * Used to scope the coverage-checker's call-site search: a `private`
 * method can only be called from within its own class, so a same-file-only
 * search suffices and sidesteps a same-name-in-a-different-class collision
 * a codebase-wide search can't rule out without real type resolution.
 *
 * @param array[] $tokens Full token list.
 * @param int     $i      Index of the T_FUNCTION token.
 * @return string|null 'private', 'protected', 'public', or null (a free
 *                      function, or a method with no explicit modifier —
 *                      implicitly public in PHP).
 */
function godam_shared_function_visibility_at( $tokens, $i ) {
	$modifier_tokens = array( T_PRIVATE, T_PROTECTED, T_PUBLIC, T_STATIC, T_ABSTRACT, T_FINAL );
	$visibility      = null;

	$j = godam_shared_skip_backward( $tokens, $i - 1 );
	while ( $j >= 0 && in_array( $tokens[ $j ]['id'] ?? null, $modifier_tokens, true ) ) {
		if ( in_array( $tokens[ $j ]['id'], array( T_PRIVATE, T_PROTECTED, T_PUBLIC ), true ) ) {
			$visibility = strtolower( $tokens[ $j ]['text'] );
		}
		$j = godam_shared_skip_backward( $tokens, $j - 1 );
	}

	return $visibility;
}

/**
 * Finds named function/method declarations: name, enclosing class, param
 * names, parameter-list range, and body range, by tracking paren/brace
 * depth.
 *
 * `params_open`/`params_close` are recorded separately from body_start/
 * body_end so a PHP 8.1+ "new in initializers" default (`function search(
 * $query = new WP_Query(...) )`) can be attributed to this function without
 * being walked as part of the body range — see godam_coverage_file_findings()
 * for why they're walked independently rather than merged.
 *
 * An interface/abstract declaration can have this same shape in its
 * parameter list, but is deliberately NOT added to $functions — doing so
 * would give a name a second "definition," breaking
 * godam_coverage_resolve_coverage()'s codebase-wide-uniqueness check. Its
 * parameter-list range is still tracked, via the optional
 * $bodyless_declarations output parameter.
 *
 * @param array[] $tokens                 Normalized tokens from godam_shared_tokenize().
 * @param array[] &$bodyless_declarations Output: each interface/abstract method
 *                  declaration found, as {name, class, params_open, params_close}
 *                  — never merged into the main return value, see above.
 * @return array[] Each: name, class (string|null — enclosing class/interface/
 *                  trait name, null for a plain function), visibility
 *                  (string|null — see godam_shared_function_visibility_at()),
 *                  params (string[] of variable names, unprefixed by $),
 *                  params_open, params_close, body_start, body_end (token
 *                  indexes).
 */
function godam_shared_find_functions( $tokens, &$bodyless_declarations = array() ) {
	$functions             = array();
	$bodyless_declarations = array();
	$classes               = godam_shared_find_classes( $tokens );
	$count                 = count( $tokens );

	for ( $i = 0; $i < $count; $i++ ) {
		if ( T_FUNCTION !== ( $tokens[ $i ]['id'] ?? null ) ) {
			continue;
		}

		$visibility = godam_shared_function_visibility_at( $tokens, $i );
		$j          = godam_shared_skip_forward( $tokens, $i + 1, $count );

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

		$params_open = $j;
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
		$params_close = $j - 1;

		while ( $j < $count && '{' !== $tokens[ $j ]['text'] && ';' !== $tokens[ $j ]['text'] ) {
			++$j;
		}
		if ( $j >= $count ) {
			continue; // Unbalanced — bail rather than guess.
		}
		if ( ';' === $tokens[ $j ]['text'] ) {
			// Interface/abstract declaration — no body (see docblock). Uses
			// $i in place of body_start to find the smallest-span enclosing
			// class, same as a bodied function does below.
			$class_name      = null;
			$class_name_span = null;
			foreach ( $classes as $class ) {
				if ( $i < $class['body_start'] || $i > $class['body_end'] ) {
					continue;
				}
				$span = $class['body_end'] - $class['body_start'];
				if ( null === $class_name_span || $span < $class_name_span ) {
					$class_name      = $class['name'];
					$class_name_span = $span;
				}
			}

			$bodyless_declarations[] = array(
				'name'         => $name,
				'class'        => $class_name,
				'params_open'  => $params_open,
				'params_close' => $params_close,
			);
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

		// Picks the SMALLEST (innermost) containing class, not the first
		// match — class ranges can nest (an anonymous class inside an outer
		// class's method), so body_start can fall within both at once, and
		// the first match would wrongly class-qualify a method that's
		// really on the inner class.
		$class_name      = null;
		$class_name_span = null;
		foreach ( $classes as $class ) {
			if ( $body_start < $class['body_start'] || $body_start > $class['body_end'] ) {
				continue;
			}
			$span = $class['body_end'] - $class['body_start'];
			if ( null === $class_name_span || $span < $class_name_span ) {
				$class_name      = $class['name'];
				$class_name_span = $span;
			}
		}

		$functions[] = array(
			'name'         => $name,
			'class'        => $class_name,
			'visibility'   => $visibility,
			'params'       => $params,
			'params_open'  => $params_open,
			'params_close' => $params_close,
			'body_start'   => $body_start,
			'body_end'     => $body_end,
		);

		// Deliberately NOT jumping past body_end: this function's body can
		// contain another named function/method (e.g. inside a `new class
		// {...}` expression), and jumping past it would skip that T_FUNCTION
		// token entirely. A genuinely anonymous closure is already excluded
		// above without advancing $i, so scanning through linearly can't
		// re-record anything.
	}

	return $functions;
}

/**
 * Returns the INNERMOST (smallest-range) entry in $functions whose
 * [body_start, body_end] contains $index, or null if none do.
 *
 * "Innermost" matters because function ranges can nest — a method inside a
 * function-scoped anonymous class sits inside its enclosing function's
 * range too, and is the more specific, correct answer.
 *
 * @param int     $index     Token index to check.
 * @param array[] $functions godam_shared_find_functions() result.
 * @return array|null
 */
function godam_shared_enclosing_function_at( $index, $functions ) {
	$best = null;
	foreach ( $functions as $function ) {
		if ( $index < $function['body_start'] || $index > $function['body_end'] ) {
			continue;
		}
		if ( null === $best || ( $function['body_end'] - $function['body_start'] ) < ( $best['body_end'] - $best['body_start'] ) ) {
			$best = $function;
		}
	}
	return $best;
}

/**
 * Whether $a and $b (each a godam_shared_enclosing_function_at() result or
 * null) refer to the same scope: both null (top-level), or the same
 * body_start/body_end. Compared by range, not identity — two independent
 * calls never return the same array instance for the same function.
 *
 * @param array|null $a First enclosing-function result (or null for top-level).
 * @param array|null $b Second enclosing-function result (or null for top-level).
 * @return bool
 */
function godam_shared_same_enclosing_function( $a, $b ) {
	if ( null === $a && null === $b ) {
		return true;
	}
	if ( null === $a || null === $b ) {
		return false;
	}
	return $a['body_start'] === $b['body_start'] && $a['body_end'] === $b['body_end'];
}
