<?php
/**
 * Coverage audit: finds every real call to one of the 12 tracked
 * attachment-access functions (get_post_meta, wp_get_attachment_url, etc.)
 * that has no rtgodam_before_attachment_lookup bracket open at that exact
 * point — one candidate per call site, not per file.
 *
 * The other two scripts in this directory only catch a wrap *regressing*
 * (godam-wp-dam-hook-check.php) or a wrap that exists but doesn't cover a
 * follow-up read at the call site (godam-interprocedural-leak-check.php).
 * Neither answers "does every attachment-touching call site have a wrap at
 * all" — which matters because wp-dam (or any similar multisite media
 * centralization plugin) has no way to know GoDAM is about to read/write
 * attachment data unless GoDAM fires this hook pair around it; a single
 * missed spot is a live bug on a site using it, not just a lint nit.
 *
 * Reuses the same token-walking approach as the other two scripts:
 *
 *  - Function/top-level-scope boundaries and parameter names: same
 *    approach as godam-interprocedural-leak-check.php's
 *    godam_leak_find_functions() (a parameter is needed here for the same
 *    reason it's needed there — see the exclusion note below).
 *  - The branch-aware before/after balance walk (checkpoint-per-'{',
 *    rewind-on-return/throw): identical algorithm to
 *    godam-wp-dam-hook-check.php's godam_check_hook_balance_in_range(),
 *    because "is a before open right here" needs the exact same guard-clause
 *    handling that check already solved — a before opened at the top of a
 *    function, closed early in one guard clause and again at the normal
 *    exit, must still read as "open" for an access call that sits between
 *    the guard clauses and the final close, on the path where neither guard
 *    fired.
 *
 * On top of that walk, this script also watches every real access-function
 * call: if nothing is open at that point, it's a candidate — unless the
 * call's first argument is one of the enclosing function's own parameters.
 * That exclusion is deliberately permissive, same reasoning
 * godam-interprocedural-leak-check.php already uses for its own
 * parameter-based exclusion: a parameter's value predates anything this
 * function itself did, so it might already have been centralized by
 * whichever caller passed it in, or it might genuinely not be an attachment
 * ID at all — this script can't tell locally, so it excludes rather than
 * over-flags. That's a real false-negative source (a caller that does NOT
 * wrap the call, passing a genuine attachment ID straight through, would be
 * wrongly excluded here) — the same tradeoff already accepted for the leak
 * checker, not a new one introduced by this script.
 *
 * A clean run means "no new uncovered call sites since the last accepted
 * baseline" — not "every access here is correctly centralized." Every
 * candidate needs a human to read the surrounding code and either add the
 * hook or record why it's fine as-is.
 *
 * Two modes, same convention as the other two scripts:
 *   php bin/godam-attachment-access-coverage-check.php check
 *   php bin/godam-attachment-access-coverage-check.php update-baseline
 *
 * @package GoDAM
 */

// phpcs:disable WordPress.WP.AlternativeFunctions, WordPress.Security.EscapeOutput, WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_file_put_contents, WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_fwrite -- CLI script, no WP bootstrap, no browser output, no VIP filesystem restrictions (reads/writes its own baseline file and STDERR only).

const BEFORE_HOOK         = 'rtgodam_before_attachment_lookup';
const AFTER_HOOK          = 'rtgodam_after_attachment_lookup';
const HOOK_FIRE_FUNCTIONS = array( 'do_action', 'add_action' );

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

$root          = dirname( __DIR__ ); // Plugin root.
$baseline_path = __DIR__ . '/godam-attachment-access-coverage-baseline.json';
$run_mode      = $argv[1] ?? 'check';

$scan_roots = array(
	$root . '/inc',
	$root . '/admin',
	$root . '/assets/src/blocks',
);

$skippable_tokens = array( T_WHITESPACE, T_COMMENT, T_DOC_COMMENT );

/**
 * Recursively lists .php files under $dir, skipping compiled/vendor output.
 *
 * @param string $dir Directory to scan.
 * @return string[] Absolute file paths.
 */
function godam_coverage_list_php_files( $dir ) {
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

/**
 * Tokenizes a file into a flat list of ['id' => int|null, 'text' => string,
 * 'line' => int].
 *
 * @param string $file Absolute file path.
 * @return array[]
 */
function godam_coverage_tokenize( $file ) {
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
function godam_coverage_skip_forward( $tokens, $i, $count ) {
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
function godam_coverage_skip_backward( $tokens, $i ) {
	global $skippable_tokens;
	while ( $i >= 0 && in_array( $tokens[ $i ]['id'], $skippable_tokens, true ) ) {
		--$i;
	}
	return $i;
}

/**
 * Whether the token at $i is a real call to one of $names.
 *
 * @param array[] $tokens Token list.
 * @param int     $i      Index to check.
 * @param array   $names  Function names to match.
 * @param int     $count  Token count.
 * @return bool
 */
function godam_coverage_is_call_to( $tokens, $i, $names, $count ) {
	if ( T_STRING !== ( $tokens[ $i ]['id'] ?? null ) || ! in_array( $tokens[ $i ]['text'], $names, true ) ) {
		return false;
	}

	$n = godam_coverage_skip_forward( $tokens, $i + 1, $count );
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
function godam_coverage_is_hook_fire( $tokens, $i, $hook_name ) {
	if ( T_CONSTANT_ENCAPSED_STRING !== ( $tokens[ $i ]['id'] ?? null ) ) {
		return false;
	}
	if ( substr( $tokens[ $i ]['text'], 1, -1 ) !== $hook_name ) {
		return false;
	}

	$p = godam_coverage_skip_backward( $tokens, $i - 1 );
	if ( $p < 0 || '(' !== $tokens[ $p ]['text'] ) {
		return false;
	}
	$p = godam_coverage_skip_backward( $tokens, $p - 1 );

	return $p >= 0 && T_STRING === ( $tokens[ $p ]['id'] ?? null ) && in_array( $tokens[ $p ]['text'], HOOK_FIRE_FUNCTIONS, true );
}

/**
 * If the token at $i starts a real call to one of ACCESS_FUNCTIONS, returns
 * ['name' => function name, 'arg' => unprefixed first-argument variable
 * name, or '' if the first argument isn't a plain variable]. Returns null if
 * $i isn't an access-function call at all.
 *
 * @param array[] $tokens Token list.
 * @param int     $i      Index to check.
 * @param int     $count  Token count.
 * @return array|null
 */
function godam_coverage_access_call_at( $tokens, $i, $count ) {
	if ( ! godam_coverage_is_call_to( $tokens, $i, ACCESS_FUNCTIONS, $count ) ) {
		return null;
	}

	$name = $tokens[ $i ]['text'];
	$open = godam_coverage_skip_forward( $tokens, $i + 1, $count ); // The '(' itself.
	$arg  = godam_coverage_skip_forward( $tokens, $open + 1, $count );

	if ( $arg < $count && T_VARIABLE === ( $tokens[ $arg ]['id'] ?? null ) ) {
		return array(
			'name' => $name,
			'arg'  => ltrim( $tokens[ $arg ]['text'], '$' ),
		);
	}

	return array(
		'name' => $name,
		'arg'  => '',
	);
}

/**
 * Finds named function/method declarations in a token stream: name,
 * parameter names, and body token range. Identical approach to
 * godam-interprocedural-leak-check.php's godam_leak_find_functions() —
 * params are needed here for the same reason they're needed there.
 *
 * @param array[] $tokens Normalized tokens from godam_coverage_tokenize().
 * @return array[] Each: name, params (string[]), body_start, body_end.
 */
function godam_coverage_find_functions( $tokens ) {
	$functions = array();
	$count     = count( $tokens );

	for ( $i = 0; $i < $count; $i++ ) {
		if ( T_FUNCTION !== ( $tokens[ $i ]['id'] ?? null ) ) {
			continue;
		}

		$j = godam_coverage_skip_forward( $tokens, $i + 1, $count );

		if ( $j < $count && '&' === $tokens[ $j ]['text'] ) { // Return-by-reference.
			$j = godam_coverage_skip_forward( $tokens, $j + 1, $count );
		}

		if ( $j >= $count || T_STRING !== ( $tokens[ $j ]['id'] ?? null ) ) {
			continue; // Anonymous function/closure — stays part of whichever enclosing scope this walk already covers.
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

		$functions[] = array(
			'name'       => $name,
			'params'     => $params,
			'body_start' => $body_start,
			'body_end'   => $body_end,
		);

		$i = $body_end; // Resume after this function — nested closures already consumed.
	}

	return $functions;
}

/**
 * Walks a token range tracking before/after balance exactly like
 * godam-wp-dam-hook-check.php's godam_check_hook_balance_in_range() (same
 * checkpoint-per-'{', rewind-on-return/throw algorithm — see this file's own
 * top-of-file comment for why that's required here too), and additionally
 * records every access-function call found with nothing open at that point.
 *
 * @param array[] $tokens      Full token list for the file.
 * @param int     $range_start Token index to start at (inclusive).
 * @param int     $range_end   Token index to end at (inclusive).
 * @param array   $params      Enclosing function's own parameter names (empty for top-level code).
 * @return array[] Each: line, call (function name).
 */
function godam_coverage_check_range( $tokens, $range_start, $range_end, $params ) {
	$open_before_lines = array();
	$checkpoints       = array();
	$count             = count( $tokens );
	$uncovered         = array();

	for ( $i = $range_start; $i <= $range_end; $i++ ) {
		$text = $tokens[ $i ]['text'];

		if ( '{' === $text ) {
			$checkpoints[] = $open_before_lines;
			continue;
		}

		if ( '}' === $text ) {
			array_pop( $checkpoints );
			continue;
		}

		if ( in_array( $tokens[ $i ]['id'] ?? null, array( T_RETURN, T_THROW ), true ) ) {
			// Rewind to the state when the innermost enclosing block was
			// entered — see godam_check_hook_balance_in_range()'s docblock
			// for the full reasoning (guard clauses closing an outer before()
			// early). That script is the one responsible for flagging an
			// actual imbalance; this one only cares whether access calls are
			// covered, so it always rewinds unconditionally rather than also
			// checking for the over-open case.
			$open_before_lines = empty( $checkpoints ) ? array() : end( $checkpoints );
			continue;
		}

		if ( godam_coverage_is_hook_fire( $tokens, $i, BEFORE_HOOK ) ) {
			$open_before_lines[] = $tokens[ $i ]['line'];
			continue;
		}

		if ( godam_coverage_is_hook_fire( $tokens, $i, AFTER_HOOK ) ) {
			if ( ! empty( $open_before_lines ) ) {
				array_pop( $open_before_lines );
			}
			continue;
		}

		$access = godam_coverage_access_call_at( $tokens, $i, $count );
		if ( null === $access ) {
			continue;
		}

		if ( ! empty( $open_before_lines ) ) {
			continue; // Covered.
		}

		if ( '' !== $access['arg'] && in_array( $access['arg'], $params, true ) ) {
			continue; // First argument is one of this scope's own parameters — see top-of-file comment for why this is excluded.
		}

		$uncovered[] = array(
			'line' => $tokens[ $i ]['line'],
			'call' => $access['name'],
		);
	}

	return $uncovered;
}

/**
 * Runs godam_coverage_check_range() across an entire file: once per named
 * function body (with its own parameters), plus once more across whatever
 * top-level code (file scope, outside any function) remains — concatenated
 * in file order, same reasoning as
 * godam-wp-dam-hook-check.php's godam_check_hook_balance_findings().
 *
 * @param array[] $tokens    Full token list for the file.
 * @param array[] $functions This file's own godam_coverage_find_functions() result.
 * @return array[] Each: line, call, scope ('top-level code' or a function name).
 */
function godam_coverage_file_findings( $tokens, $functions ) {
	$findings          = array();
	$count             = count( $tokens );
	$top_level_indexes = array();

	for ( $i = 0; $i < $count; $i++ ) {
		$inside_a_function = false;

		foreach ( $functions as $function ) {
			if ( $i >= $function['body_start'] && $i <= $function['body_end'] ) {
				$inside_a_function = true;
				break;
			}
		}

		if ( ! $inside_a_function ) {
			$top_level_indexes[] = $i;
		}
	}

	foreach ( $functions as $function ) {
		foreach ( godam_coverage_check_range( $tokens, $function['body_start'], $function['body_end'], $function['params'] ) as $finding ) {
			$finding['scope'] = "{$function['name']}()";
			$findings[]       = $finding;
		}
	}

	if ( ! empty( $top_level_indexes ) ) {
		$top_level_tokens = array_values( array_intersect_key( $tokens, array_flip( $top_level_indexes ) ) );

		foreach ( godam_coverage_check_range( $top_level_tokens, 0, count( $top_level_tokens ) - 1, array() ) as $finding ) {
			$finding['scope'] = 'top-level code';
			$findings[]       = $finding;
		}
	}

	return $findings;
}

/**
 * Human-reviewed reasons for findings accepted into the baseline, keyed the
 * same way as $findings. Merged into the baseline on every
 * `update-baseline` run so the *why* survives regeneration. Add an entry
 * here — not directly in the baseline JSON — when accepting a new finding
 * as reviewed-and-fine.
 *
 * @return array<string, string>
 */
function godam_coverage_known_reasons() {
	return array();
}

// --- Scan every file once, build the full findings list. ---

$findings = array();
foreach ( $scan_roots as $scan_root ) {
	foreach ( godam_coverage_list_php_files( $scan_root ) as $file ) {
		$tokens    = godam_coverage_tokenize( $file );
		$functions = godam_coverage_find_functions( $tokens );
		$relative  = ltrim( str_replace( $root, '', $file ), DIRECTORY_SEPARATOR );

		foreach ( godam_coverage_file_findings( $tokens, $functions ) as $finding ) {
			$key = "{$relative}:{$finding['line']}";

			$findings[ $key ] = array(
				'file'  => $relative,
				'line'  => $finding['line'],
				'call'  => $finding['call'],
				'scope' => $finding['scope'],
			);
		}
	}
}

ksort( $findings );

if ( 'update-baseline' === $run_mode ) {
	// Only a finding with an ACTUAL reviewed reason on file gets accepted —
	// this is the whole point of the baseline, and it was broken until this
	// fix: an earlier version wrote every finding into 'accepted' regardless
	// of whether godam_coverage_known_reasons() had an entry for it, only
	// printing a warning for the unreviewed ones. Printing a warning that's
	// easy to miss is not the same as actually gating anything — running
	// update-baseline on a fresh, hook-less codebase silently accepted all
	// 192 real gaps as if they'd been reviewed and found fine, so 'check'
	// reported a clean run despite nothing having been fixed or looked at.
	// A finding with no reason must NOT appear in 'accepted' at all, so
	// 'check' keeps failing on it until a human either fixes the code or
	// adds a real reason here.
	$reasons     = godam_coverage_known_reasons();
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
		'generated_note' => 'Generated by bin/godam-attachment-access-coverage-check.php update-baseline. A finding only enters "accepted" if godam_coverage_known_reasons() already has a reason for it — this command does not review anything on its own. Findings with no reason stay failing in "check" mode.',
		'accepted'       => $accepted,
	);

	file_put_contents( $baseline_path, json_encode( $baseline, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n" );
	echo "Baseline written to {$baseline_path}.\n";
	echo 'Uncovered access call sites found: ' . count( $findings ) . ', accepted (reviewed, with a reason on file): ' . count( $accepted ) . "\n";

	if ( ! empty( $unexplained ) ) {
		echo "\n" . count( $unexplained ) . " finding(s) have NO reason on file, so they were NOT accepted —\n";
		echo "'check' will still report every one of them until you either fix the code or add a real\n";
		echo "reason to godam_coverage_known_reasons() and re-run update-baseline.\n";
	}

	exit( 0 );
}

if ( ! file_exists( $baseline_path ) ) {
	fwrite( STDERR, "No baseline found at {$baseline_path}.\nRun: php bin/godam-attachment-access-coverage-check.php update-baseline\n" );
	exit( 1 );
}

$baseline          = json_decode( file_get_contents( $baseline_path ), true );
$accepted_findings = is_array( $baseline ) ? ( $baseline['accepted'] ?? array() ) : array();

$new_findings = array_diff_key( $findings, $accepted_findings );

echo 'Uncovered access call sites tracked: ' . count( $findings ) . ' (' . count( $accepted_findings ) . " previously accepted)\n\n";

if ( ! empty( $new_findings ) ) {
	echo "NEW UNCOVERED ACCESS CALLS (not in the accepted baseline):\n";
	foreach ( $new_findings as $key => $finding ) {
		echo " - {$finding['file']}:{$finding['line']} in {$finding['scope']}: {$finding['call']}() runs with no\n";
		echo "   rtgodam_before_attachment_lookup open. Add the hook pair around it, or if this call\n";
		echo "   genuinely isn't attachment data needing centralization, run 'update-baseline' after\n";
		echo "   confirming why (see this script's own top-of-file comment for the exclusion rules).\n\n";
	}

	echo "This script cannot prove a call site needs centralizing — see its own\n";
	echo "top-of-file comment for what it can and can't detect. A human still needs\n";
	echo "to read each finding above.\n";
	exit( 1 );
}

echo "No new uncovered attachment-access call sites since the last accepted baseline.\n";
exit( 0 );
