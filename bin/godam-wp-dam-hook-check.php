<?php
/**
 * Guards GoDAM's own `rtgodam_before_attachment_lookup` /
 * `rtgodam_after_attachment_lookup` hook pair against silent regression.
 *
 * These two hooks exist so that a plugin centralizing media on a multisite
 * network (wp-dam, or anything with a similar "all real attachments live on
 * one site" design) can switch site context immediately around a local
 * attachment read/write GoDAM performs, then switch back. GoDAM itself has
 * no listener for them — it only *fires* them, at every place its own code
 * touches attachment data directly (`get_post()`, `get_post_meta()`,
 * `wp_get_attachment_url()`, etc.). This script exists to keep that promise
 * true as the codebase changes: it can catch a hook being *removed*, or a
 * pair being *added wrong*, but it cannot prove a brand-new attachment-access
 * call site is safe on its own — a human still has to look at anything it
 * flags. A clean run means "nothing obviously regressed, and no new
 * attachment-touching code appeared unreviewed" — not "this change is
 * definitely centralization-safe."
 *
 * Uses PHP's own token_get_all() (no new dependency) rather than raw text
 * matching, specifically so a hook name mentioned in a comment or docblock
 * cross-reference can't inflate a count — PHP's tokenizer never emits a
 * T_STRING/T_CONSTANT_ENCAPSED_STRING for text inside a
 * T_COMMENT/T_DOC_COMMENT; the whole comment is one token. A raw
 * `grep`/`preg_match_all` equivalent would count both a real call and a
 * docblock mention as the same "occurrence," which silently hides a real
 * removal offset by an unrelated stray comment elsewhere in the same file.
 *
 * Three checks, all against a per-file token count or a structural walk —
 * see each one's own comment below for what it catches and why:
 *   1. Per-file `rtgodam_before_attachment_lookup` call count must never
 *      decrease from the last accepted baseline.
 *   2. Per-file attachment-access function call count increasing (or a new
 *      file appearing) is a review signal, not an automatic failure.
 *   3. Before/after balance: every `rtgodam_before_attachment_lookup` in a
 *      function (or in top-level file code) must reach a matching
 *      `rtgodam_after_attachment_lookup` before that scope ends, and no
 *      `rtgodam_after_attachment_lookup` may fire with nothing open. Unlike
 *      the first two, this needs no baseline — a pair is either balanced or
 *      it isn't, so it fails unconditionally in both modes.
 *
 * Two modes:
 *   php bin/godam-wp-dam-hook-check.php check            (default; used in CI)
 *   php bin/godam-wp-dam-hook-check.php update-baseline   (run locally after
 *     manually auditing new/changed code, to accept the new counts)
 *
 * @package GoDAM
 */

// phpcs:disable WordPress.WP.AlternativeFunctions, WordPress.Security.EscapeOutput, WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_file_put_contents, WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_fwrite -- CLI script, no WP bootstrap, no browser output, no VIP filesystem restrictions (reads/writes its own baseline file and STDERR only).

$root          = dirname( __DIR__ ); // Plugin root.
$baseline_path = __DIR__ . '/godam-wp-dam-hook-baseline.json';
$run_mode      = $argv[1] ?? 'check';

$scan_roots = array(
	$root . '/inc',
	$root . '/admin',
	$root . '/assets/src/blocks',
);

/**
 * Function names that fire a hook (used for the per-file wrap count, which
 * is specifically about GoDAM's own do_action() call sites).
 *
 * @var string[]
 */
const HOOK_FIRE_FUNCTIONS = array( 'do_action', 'apply_filters' );

/**
 * The hook whose per-file real-call count must never decrease — a drop means
 * a wrap was lost when the surrounding code changed.
 */
const WRAP_HOOK_NAME = 'rtgodam_before_attachment_lookup';

/**
 * WRAP_HOOK_NAME's closing counterpart — used only by the before/after
 * balance check below, not by the wrap-count-regression check above (which
 * deliberately only tracks the before side; see that check's own comment).
 */
const AFTER_HOOK_NAME = 'rtgodam_after_attachment_lookup';

/**
 * Attachment-access function names. A per-file count increase here doesn't
 * prove anything is broken — plenty of legitimate, already-wrapped code adds
 * more of these over time — but it's the closest this script can get to
 * "this file now touches attachment data in a place nobody has looked at
 * yet." Deliberately excludes generic term/taxonomy/option calls: scoped to
 * calls that read or write attachment post data specifically.
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
 * Recursively lists .php files under $dir, skipping compiled/vendor output
 * that can't be hand-hooked anyway.
 *
 * @param string $dir Directory to scan.
 * @return string[] Absolute file paths.
 */
function godam_check_list_php_files( $dir ) {
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
			continue; // Third-party libraries (e.g. Action Scheduler), not GoDAM's own code.
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
 * and bare strings (single-char tokens) into one consistent shape. Nearly
 * identical to bin/godam-attachment-access-coverage-check.php's own version —
 * duplicated deliberately so these two scripts stay independently readable.
 *
 * @param string $file Absolute file path.
 * @return array[]
 */
function godam_check_tokenize( $file ) {
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
 * Whether the token at $i is a real function call of one of $names — i.e. a
 * T_STRING matching (case-sensitively) one of them, immediately followed
 * (skipping whitespace/comments) by '('. Being a T_STRING at all already
 * excludes anything inside a T_COMMENT/T_DOC_COMMENT, since the tokenizer
 * never splits a comment's text into separate tokens.
 *
 * @param array[] $tokens Full token list for the file.
 * @param int     $i      Index to check.
 * @param array   $names  Function names to match.
 * @return bool
 */
function godam_check_is_call_to( $tokens, $i, $names ) {
	if ( T_STRING !== ( $tokens[ $i ]['id'] ?? null ) || ! in_array( $tokens[ $i ]['text'], $names, true ) ) {
		return false;
	}

	$count = count( $tokens );
	$n     = $i + 1;
	while ( $n < $count && in_array( $tokens[ $n ]['id'], array( T_WHITESPACE, T_COMMENT, T_DOC_COMMENT ), true ) ) {
		++$n;
	}

	return $n < $count && '(' === $tokens[ $n ]['text'];
}

/**
 * Counts real calls to any of $function_names in a token stream.
 *
 * @param array[] $tokens         Full token list for the file.
 * @param array   $function_names Function names to match.
 * @return int
 */
function godam_check_count_calls( $tokens, $function_names ) {
	$count = 0;

	foreach ( $tokens as $i => $token ) {
		if ( godam_check_is_call_to( $tokens, $i, $function_names ) ) {
			++$count;
		}
	}

	return $count;
}

/**
 * Whether the T_CONSTANT_ENCAPSED_STRING token at $i is $hook_name, passed as
 * the first argument to a real call to one of $outer_functions — e.g.
 * do_action( 'x' ) or add_filter( 'x', ... ). The per-index predicate
 * godam_check_count_hook_calls() and godam_check_hook_balance_in_range() both
 * build on.
 *
 * @param array[] $tokens          Full token list for the file.
 * @param int     $i               Index of the string token to check.
 * @param string  $hook_name       Hook name to match (unquoted).
 * @param array   $outer_functions Function names that count as firing this
 *                                  hook (e.g. HOOK_FIRE_FUNCTIONS).
 * @return bool
 */
function godam_check_is_hook_fire_at( $tokens, $i, $hook_name, $outer_functions ) {
	if ( T_CONSTANT_ENCAPSED_STRING !== ( $tokens[ $i ]['id'] ?? null ) ) {
		return false;
	}

	// Strip the token's own quote characters (single or double) to compare.
	if ( substr( $tokens[ $i ]['text'], 1, -1 ) !== $hook_name ) {
		return false;
	}

	// Walk backward: '(' then a T_STRING matching one of the outer functions.
	$p = $i - 1;
	while ( $p >= 0 && in_array( $tokens[ $p ]['id'], array( T_WHITESPACE, T_COMMENT, T_DOC_COMMENT ), true ) ) {
		--$p;
	}
	if ( $p < 0 || '(' !== $tokens[ $p ]['text'] ) {
		return false;
	}
	--$p;
	while ( $p >= 0 && in_array( $tokens[ $p ]['id'], array( T_WHITESPACE, T_COMMENT, T_DOC_COMMENT ), true ) ) {
		--$p;
	}

	return $p >= 0 && godam_check_is_call_to( $tokens, $p, $outer_functions );
}

/**
 * Counts real calls to one of $outer_functions whose first argument is the
 * string $hook_name — e.g. do_action( 'x' ).
 *
 * @param array[] $tokens          Full token list for the file.
 * @param string  $hook_name       Hook name to match (unquoted).
 * @param array   $outer_functions Function names that count as firing this hook.
 * @return int
 */
function godam_check_count_hook_calls( $tokens, $hook_name, $outer_functions = HOOK_FIRE_FUNCTIONS ) {
	$count = 0;

	foreach ( $tokens as $i => $token ) {
		if ( godam_check_is_hook_fire_at( $tokens, $i, $hook_name, $outer_functions ) ) {
			++$count;
		}
	}

	return $count;
}

/**
 * Finds named function/method declarations in a token stream: name and
 * body token range, by tracking brace depth rather than assuming a fixed
 * shape. A simpler cousin of bin/godam-attachment-access-coverage-check.php's
 * own function-finder — this check only needs body boundaries and a name
 * for error messages, not parameter names — kept separate rather than
 * shared, same reasoning as that script's own top-of-file comment.
 *
 * @param array[] $tokens Normalized tokens from godam_check_tokenize().
 * @return array[] Each: name, body_start, body_end (token indexes).
 */
function godam_check_find_functions( $tokens ) {
	$functions = array();
	$count     = count( $tokens );

	for ( $i = 0; $i < $count; $i++ ) {
		if ( T_FUNCTION !== ( $tokens[ $i ]['id'] ?? null ) ) {
			continue;
		}

		$j = $i + 1;
		while ( $j < $count && in_array( $tokens[ $j ]['id'], array( T_WHITESPACE, T_COMMENT, T_DOC_COMMENT ), true ) ) {
			++$j;
		}

		if ( $j < $count && '&' === $tokens[ $j ]['text'] ) { // Return-by-reference.
			++$j;
			while ( $j < $count && in_array( $tokens[ $j ]['id'], array( T_WHITESPACE, T_COMMENT, T_DOC_COMMENT ), true ) ) {
				++$j;
			}
		}

		if ( $j >= $count || T_STRING !== ( $tokens[ $j ]['id'] ?? null ) ) {
			continue; // Anonymous function/closure — its tokens stay part of whichever named function or top-level range encloses it.
		}

		$name = $tokens[ $j ]['text'];

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
			'body_start' => $body_start,
			'body_end'   => $body_end,
		);

		$i = $body_end; // Resume after this function — nested closures are already consumed.
	}

	return $functions;
}

/**
 * Walks a token range in file order, treating a real before-hook fire as an
 * opened bracket and a real after-hook fire as its close — same idea as
 * matching parentheses, applied to the two hook names instead of '(' / ')'.
 *
 * Branch-aware specifically around return/throw: a guard clause like
 *   before(); if ( $bad ) { after(); return; } ...more work...; after();
 * is a normal, correct pattern — exactly one of the two after() calls runs
 * on any given call, and whichever one does correctly closes the same
 * before(). A plain linear counter can't tell that apart from a real bug,
 * because lexically both after() calls look like they happen in sequence.
 *
 * The fix: track a stack of snapshots, one pushed per '{' (what
 * $open_before_lines looked like at that exact point) and discarded per
 * '}'. At a return/throw, compare the current snapshot against the
 * innermost one still on the stack (i.e. the state when the block
 * containing this return was entered) — if this path closed something
 * opened *before* that block started (the guard-clause shape above), that's
 * fine: code physically after the block is only reachable by NOT taking
 * this path, so it needs to see the pre-block state, not whatever this
 * specific path did — rewind to it and keep scanning. If this path instead
 * leaves something open that it itself opened after the block started,
 * that's a real bug, reported immediately rather than rewound past.
 *
 * @param array[] $tokens      Full token list for the file.
 * @param int     $range_start Token index to start at (inclusive).
 * @param int     $range_end   Token index to end at (inclusive).
 * @return array|null ['type' => 'unclosed_before'|'stray_after', 'line' => int, 'open_count' => int] or null if balanced.
 */
function godam_check_hook_balance_in_range( $tokens, $range_start, $range_end ) {
	$open_before_lines = array();
	$checkpoints       = array(); // Stack of $open_before_lines snapshots, pushed on '{', popped on '}'.

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
			$checkpoint = empty( $checkpoints ) ? array() : end( $checkpoints );

			if ( count( $open_before_lines ) > count( $checkpoint ) ) {
				return array(
					'type'       => 'unclosed_before',
					'line'       => end( $open_before_lines ),
					'open_count' => count( $open_before_lines ) - count( $checkpoint ),
				);
			}

			$open_before_lines = $checkpoint; // Rewind — see docblock.
			continue;
		}

		if ( godam_check_is_hook_fire_at( $tokens, $i, WRAP_HOOK_NAME, HOOK_FIRE_FUNCTIONS ) ) {
			$open_before_lines[] = $tokens[ $i ]['line'];
			continue;
		}

		if ( godam_check_is_hook_fire_at( $tokens, $i, AFTER_HOOK_NAME, HOOK_FIRE_FUNCTIONS ) ) {
			if ( empty( $open_before_lines ) ) {
				return array(
					'type' => 'stray_after',
					'line' => $tokens[ $i ]['line'],
				);
			}
			array_pop( $open_before_lines );
		}
	}

	if ( ! empty( $open_before_lines ) ) {
		return array(
			'type'       => 'unclosed_before',
			'line'       => end( $open_before_lines ),
			'open_count' => count( $open_before_lines ),
		);
	}

	return null;
}

/**
 * Runs godam_check_hook_balance_in_range() across an entire file: once per
 * named function body, plus once more across whatever top-level code (file
 * scope, outside any function) remains — concatenated in file order, since
 * top-level statements all run sequentially at include-time regardless of
 * function declarations interspersed between them.
 *
 * @param array[] $tokens    Full token list for the file.
 * @param array[] $functions This file's own godam_check_find_functions() result.
 * @return array[] Each finding: scope ('top-level code' or a function name), plus
 *                  the 'type'/'line'/'open_count' from godam_check_hook_balance_in_range().
 */
function godam_check_hook_balance_findings( $tokens, $functions ) {
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
		$result = godam_check_hook_balance_in_range( $tokens, $function['body_start'], $function['body_end'] );

		if ( null !== $result ) {
			$result['scope'] = "{$function['name']}()";
			$findings[]      = $result;
		}
	}

	if ( ! empty( $top_level_indexes ) ) {
		// Reindex to a contiguous array so godam_check_hook_balance_in_range()'s
		// own start/end range walk still works — it isn't aware of the gaps
		// this leaves where function bodies were skipped.
		$top_level_tokens = array_values( array_intersect_key( $tokens, array_flip( $top_level_indexes ) ) );
		$result           = godam_check_hook_balance_in_range( $top_level_tokens, 0, count( $top_level_tokens ) - 1 );

		if ( null !== $result ) {
			$result['scope'] = 'top-level code';
			$findings[]      = $result;
		}
	}

	return $findings;
}

/**
 * Builds { relative_path => count } for every file under the scan roots
 * where $counter( $tokens ) returns > 0.
 *
 * @param string[] $scan_roots Absolute directories to scan.
 * @param string   $root       Repo root, for making paths relative/portable.
 * @param callable $counter    function( array $tokens ): int.
 * @return array<string, int>
 */
function godam_check_build_counts( $scan_roots, $root, $counter ) {
	$counts = array();

	foreach ( $scan_roots as $scan_root ) {
		foreach ( godam_check_list_php_files( $scan_root ) as $file ) {
			$count = $counter( godam_check_tokenize( $file ) );

			if ( $count > 0 ) {
				$relative            = ltrim( str_replace( $root, '', $file ), DIRECTORY_SEPARATOR );
				$counts[ $relative ] = $count;
			}
		}
	}

	ksort( $counts );

	return $counts;
}

$wrap_counts   = godam_check_build_counts(
	$scan_roots,
	$root,
	function ( $tokens ) {
		return godam_check_count_hook_calls( $tokens, WRAP_HOOK_NAME, HOOK_FIRE_FUNCTIONS );
	}
);
$access_counts = godam_check_build_counts(
	$scan_roots,
	$root,
	function ( $tokens ) {
		return godam_check_count_calls( $tokens, ACCESS_FUNCTIONS );
	}
);

// 3. Before/after hook balance — needs no baseline, since a wrap is always
// supposed to net to zero regardless of how many legitimate wraps exist.
// Computed in both modes; only used for reporting in 'check' mode below.
$balance_failures = array();
foreach ( $scan_roots as $scan_root ) {
	foreach ( godam_check_list_php_files( $scan_root ) as $file ) {
		$tokens    = godam_check_tokenize( $file );
		$functions = godam_check_find_functions( $tokens );

		foreach ( godam_check_hook_balance_findings( $tokens, $functions ) as $finding ) {
			$relative = ltrim( str_replace( $root, '', $file ), DIRECTORY_SEPARATOR );

			if ( 'stray_after' === $finding['type'] ) {
				$balance_failures[] = "{$relative}:{$finding['line']} — {$finding['scope']}: rtgodam_after_attachment_lookup fires with no matching rtgodam_before_attachment_lookup open at that point. A hook may have been added without its pairing before, or the before was removed while the after stayed.";
			} else {
				$plural             = 1 === $finding['open_count'] ? 'call' : 'calls';
				$balance_failures[] = "{$relative}:{$finding['line']} — {$finding['scope']}: {$finding['open_count']} rtgodam_before_attachment_lookup {$plural} never reach a matching rtgodam_after_attachment_lookup before the end of this scope. The site context would stay switched to whatever site the before() call switched to for the rest of this request.";
			}
		}
	}
}

/**
 * Wraps json_encode() with the flags this file wants, under one name so both
 * modes go through one place.
 *
 * @param mixed $data Data to encode.
 * @return string
 */
function godam_check_json_encode( $data ) {
	return json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
}

if ( 'update-baseline' === $run_mode ) {
	$baseline = array(
		'generated_note' => 'Generated by bin/godam-wp-dam-hook-check.php update-baseline. Only run this after manually auditing what changed — it is the thing this check compares against, not a substitute for the audit.',
		'wrap_counts'    => $wrap_counts,
		'access_counts'  => $access_counts,
	);

	file_put_contents( $baseline_path, godam_check_json_encode( $baseline ) . "\n" );
	echo "Baseline written to {$baseline_path}.\n";
	echo 'Wrap-tracked files: ' . count( $wrap_counts ) . ', access-pattern files: ' . count( $access_counts ) . "\n";
	exit( 0 );
}

if ( ! file_exists( $baseline_path ) ) {
	fwrite( STDERR, "No baseline found at {$baseline_path}.\nRun: php bin/godam-wp-dam-hook-check.php update-baseline\n" );
	exit( 1 );
}

$baseline = json_decode( file_get_contents( $baseline_path ), true );

if ( ! is_array( $baseline ) ) {
	fwrite( STDERR, "Baseline at {$baseline_path} is not valid JSON.\n" );
	exit( 1 );
}

$baseline_wrap_counts   = $baseline['wrap_counts'] ?? array();
$baseline_access_counts = $baseline['access_counts'] ?? array();

$failures = array();
$warnings = array();

// 1. Per-file wrap count must never decrease from baseline.
foreach ( $baseline_wrap_counts as $file => $expected_count ) {
	$actual_count = $wrap_counts[ $file ] ?? 0;

	if ( $actual_count < $expected_count ) {
		$failures[] = "{$file}: rtgodam_before_attachment_lookup call count dropped from {$expected_count} to {$actual_count} — a wrap may have been lost.";
	}
}

// 2. Per-file attachment-access-pattern count increasing, or a new file
// appearing, is a *review* signal, not an automatic failure — surfaced as
// a warning that's still printed and still fails the job (see below), but
// phrased as "go look at this" rather than "this is definitely broken."
foreach ( $access_counts as $file => $actual_count ) {
	$expected_count = $baseline_access_counts[ $file ] ?? 0;

	if ( $actual_count > $expected_count ) {
		$warnings[] = "{$file}: attachment-access call count went from {$expected_count} to {$actual_count} — new or moved code touching attachment data; verify it fires rtgodam_before_attachment_lookup/rtgodam_after_attachment_lookup around it, then run 'php bin/godam-wp-dam-hook-check.php update-baseline' to accept.";
	}
}

echo 'Checked ' . ( count( $wrap_counts ) + count( $access_counts ) ) . " files with attachment-related patterns.\n\n";

if ( ! empty( $failures ) ) {
	echo "FAILURES (hook removed or wrap count regressed):\n";
	foreach ( $failures as $failure ) {
		echo " - {$failure}\n";
	}
	echo "\n";
}

if ( ! empty( $balance_failures ) ) {
	echo "MALFORMED HOOK PAIRS (before/after don't balance — not just missing, wrong):\n";
	foreach ( $balance_failures as $balance_failure ) {
		echo " - {$balance_failure}\n";
	}
	echo "\n";
}

if ( ! empty( $warnings ) ) {
	echo "NEEDS REVIEW (new attachment-access code, not yet audited):\n";
	foreach ( $warnings as $warning ) {
		echo " - {$warning}\n";
	}
	echo "\n";
}

if ( ! empty( $failures ) || ! empty( $balance_failures ) || ! empty( $warnings ) ) {
	echo "This check cannot prove centralization-compatibility on its own — see\n";
	echo "this file's own top-of-file comment for what it can and can't catch.\n";
	echo "A human still needs to look at the above.\n";
	exit( 1 );
}

echo "No regressions or unreviewed new attachment-access code detected.\n";
exit( 0 );
