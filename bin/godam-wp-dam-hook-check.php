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
 * Three checks, all against a per-function token count or a structural walk
 * — see each one's own comment below for what it catches and why:
 *   1. Per-function (not per-file — see godam_check_build_counts()'s own
 *      comment for why that distinction matters) `rtgodam_before_attachment_lookup`
 *      call count must never decrease from the last accepted baseline.
 *   2. Per-function attachment-access-pattern count increasing (or a new
 *      function/file appearing) is a review signal, not an automatic
 *      failure. "Attachment-access-pattern" now covers more than a plain
 *      ACCESS_FUNCTIONS name match: a `new WP_Query()`/`get_posts()`/$wpdb
 *      query-method call that's attachment-shaped counts too — see
 *      godam_shared_query_pattern_at() in the shared file for why those
 *      needed their own detection (two real, previously-invisible gaps in
 *      this exact codebase, 2026-08, were exactly this shape).
 *   3. Before/after balance: every `rtgodam_before_attachment_lookup` in a
 *      function (or in top-level file code, or inside a deferred
 *      add_action()/add_filter() closure — see godam_shared_find_deferred_closures()
 *      for why a closure like that needs its own independent check rather
 *      than being folded into whichever function merely defines it) must
 *      reach a matching `rtgodam_after_attachment_lookup` before that scope
 *      ends, and no `rtgodam_after_attachment_lookup` may fire with nothing
 *      open. Branch-aware around `return`/`throw`/`exit`/`die`/`wp_die()`-style
 *      early exits (see godam_check_hook_balance_in_range()'s own comment)
 *      — a guard clause that closes the wrap early and returns is a normal,
 *      correct pattern, not a bug. Fails unconditionally *unless* a specific
 *      finding already has a reason on file in
 *      godam_check_known_balance_exceptions() — reserved for pairings this
 *      script genuinely can't trace (e.g. a before() whose matching after()
 *      fires from a different function or callback entirely), not for
 *      working around a real bug or a godam_shared_is_scope_terminator()
 *      gap, which belong fixed in the code or the tool, not excepted here.
 *
 * Shares its tokenizer, function-boundary finder, hook-fire detection,
 * query-pattern detection, and deferred-closure detection with the sibling
 * godam-attachment-access-coverage-check.php via godam-hook-check-shared.php
 * — see that file's own top-of-file comment for why (a real
 * HOOK_FIRE_FUNCTIONS drift bug between the two scripts, found during
 * review, is what prompted extracting it).
 *
 * Two modes:
 *   php bin/godam-wp-dam-hook-check.php check            (default; used in CI)
 *   php bin/godam-wp-dam-hook-check.php update-baseline   (run locally after
 *     manually auditing new/changed code, to accept the new counts, or a
 *     specific balance exception already given a reason)
 *
 * @package GoDAM
 */

// phpcs:disable WordPress.WP.AlternativeFunctions, WordPress.Security.EscapeOutput, WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_file_put_contents, WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_fwrite -- CLI script, no WP bootstrap, no browser output, no VIP filesystem restrictions (reads/writes its own baseline file and STDERR only).

require_once __DIR__ . '/godam-hook-check-shared.php';

$root          = dirname( __DIR__ ); // Plugin root.
$baseline_path = __DIR__ . '/godam-wp-dam-hook-baseline.json';
$run_mode      = $argv[1] ?? 'check';

// Whole-plugin-root scan (deny-list, not an explicit directory allow-list) —
// see GODAM_EXCLUDED_ROOT_DIRS's own comment in godam-hook-check-shared.php
// for why: the sibling godam-attachment-access-coverage-check.php used to
// scan the same 3-directory allow-list this script did, and a full manual
// recursive audit (2026-08) found real, unreviewed attachment-access code in
// directories neither script's allow-list ever named (lib/, the plugin-root
// files). Fixed identically here so both scripts stay in sync — a file
// visible to one hook-coverage check but not the other would be a confusing,
// silent inconsistency.
$files = godam_shared_list_all_php_files( $root );

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
 * Counts real, BARE (not method-style, not a same-named declaration —
 * godam_shared_is_bare_call_to()) calls to any of $function_names, plus any
 * attachment-shaped query-pattern call (new WP_Query()/get_posts()/$wpdb
 * query method — see godam_shared_query_pattern_at() in the shared file for
 * why these need their own detection, not just a name match), within
 * [$range_start, $range_end]. The only caller passes ACCESS_FUNCTIONS —
 * bare-call matching here for the same reason
 * godam_shared_is_hook_fire_at()/godam_shared_is_scope_terminator() switched
 * to it: every one of those names is a WordPress core global, never
 * legitimately called via ->/::, so this only excludes the pathological case
 * of a same-named user-defined method or declaration.
 *
 * @param array[] $tokens         Full token list for the file (or a range
 *                                 within it — $range_start/$range_end bound
 *                                 the scan, $count is still this array's own
 *                                 total length, for the shared helpers' own
 *                                 forward/backward-skip bounds-checking).
 * @param int     $range_start    Token index to start at (inclusive).
 * @param int     $range_end      Token index to end at (inclusive).
 * @param array   $function_names Function names to match.
 * @param array[] $skip_ranges    Each [start, end] (inclusive) to jump straight past — a
 *                                 deferred closure nested directly inside this range, counted
 *                                 separately under its own scope by godam_check_build_counts()
 *                                 instead. Without this, a closure's own calls would be counted
 *                                 twice: once here, folded into the enclosing function's total,
 *                                 and again under the closure's own separate entry — confirmed as
 *                                 a real double-count via a synthetic fixture (an enclosing
 *                                 function's own wrap count came back inflated by exactly the
 *                                 closure's own wrap) before this parameter was added.
 * @return int
 */
function godam_check_count_calls( $tokens, $range_start, $range_end, $function_names, $skip_ranges = array() ) {
	$count = count( $tokens );
	$total = 0;

	for ( $i = $range_start; $i <= $range_end; $i++ ) {
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

		if ( godam_shared_is_bare_call_to( $tokens, $i, $function_names, $count ) ) {
			++$total;
			continue;
		}

		$query_pattern = godam_shared_query_pattern_at( $tokens, $i, $range_start, $range_end, $count );
		if ( null !== $query_pattern && $query_pattern['is_attachment_shaped'] ) {
			++$total;
		}
	}

	return $total;
}

/**
 * Counts real calls to one of $outer_functions whose first argument is the
 * string $hook_name — e.g. do_action( 'x' ) — within [$range_start, $range_end].
 *
 * @param array[] $tokens          Full token list for the file (see godam_check_count_calls()'s
 *                                 own note on $tokens vs the range bounds).
 * @param int     $range_start     Token index to start at (inclusive).
 * @param int     $range_end       Token index to end at (inclusive).
 * @param string  $hook_name       Hook name to match (unquoted).
 * @param array   $outer_functions Function names that count as firing this hook.
 * @param array[] $skip_ranges     Each [start, end] (inclusive) to jump straight past — see
 *                                 godam_check_count_calls()'s own note on why a nested deferred
 *                                 closure needs this to avoid being double-counted.
 * @return int
 */
function godam_check_count_hook_calls( $tokens, $range_start, $range_end, $hook_name, $outer_functions = GODAM_HOOK_FIRE_FUNCTIONS, $skip_ranges = array() ) {
	$count = 0;

	for ( $i = $range_start; $i <= $range_end; $i++ ) {
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

		if ( godam_shared_is_hook_fire_at( $tokens, $i, $hook_name, $outer_functions ) ) {
			++$count;
		}
	}

	return $count;
}

/**
 * Walks a token range in file order, treating a real before-hook fire as an
 * opened bracket and a real after-hook fire as its close — same idea as
 * matching parentheses, applied to the two hook names instead of '(' / ')'.
 *
 * Branch-aware specifically around scope-terminating statements: a guard
 * clause like
 *   before(); if ( $bad ) { after(); return; } ...more work...; after();
 * is a normal, correct pattern — exactly one of the two after() calls runs
 * on any given call, and whichever one does correctly closes the same
 * before(). A plain linear counter can't tell that apart from a real bug,
 * because lexically both after() calls look like they happen in sequence.
 * "Scope-terminating" isn't just `return`/`throw` — see
 * godam_shared_is_scope_terminator()'s own comment for why `exit`/`die`/
 * `wp_die()`-style calls need the exact same treatment. Not hypothetical:
 * class-transcoding.php's update_transcoding_status() calls
 * wp_send_json_error() as a bare statement (no `return` in front of it) to
 * end its own guard clause — one of 14 files across inc/, admin/, and
 * assets/src/blocks/ that call wp_die()/exit()/die()/wp_send_json*() at all.
 *
 * The fix: track a stack of snapshots, one pushed per '{' (what
 * $open_before_lines looked like at that exact point) and discarded per
 * '}'. At a scope-terminator, compare the current snapshot against the
 * innermost one still on the stack (i.e. the state when the block
 * containing it was entered) — if this path closed something opened
 * *before* that block started (the guard-clause shape above), that's fine:
 * code physically after the block is only reachable by NOT taking this
 * path, so it needs to see the pre-block state, not whatever this specific
 * path did — rewind to it and keep scanning. If this path instead leaves
 * something open that it itself opened after the block started, that's a
 * real bug, reported immediately rather than rewound past.
 *
 * @param array[] $tokens      Full token list for the file.
 * @param int     $range_start Token index to start at (inclusive).
 * @param int     $range_end   Token index to end at (inclusive).
 * @param array[] $skip_ranges Each [start, end] (inclusive) to jump straight past — deferred
 *                             closures (add_action()/add_filter() callbacks) nested directly
 *                             inside this range, walked independently by
 *                             godam_check_hook_balance_findings() instead. Without this, a
 *                             closure's own before()/after() pair (or lack of one) is
 *                             evaluated as if it ran inline, synchronously, as part of the
 *                             enclosing function — but a deferred callback can run at a
 *                             completely different time, so e.g. an unclosed before() inside
 *                             it could be wrongly "closed" by the enclosing function's own,
 *                               unrelated after() purely because the two happen to nest like
 *                             matched parentheses lexically.
 * @return array|null ['type' => 'unclosed_before'|'stray_after', 'line' => int, 'open_count' => int] or null if balanced.
 */
function godam_check_hook_balance_in_range( $tokens, $range_start, $range_end, $skip_ranges = array() ) {
	$open_before_lines = array();
	$checkpoints       = array(); // Stack of $open_before_lines snapshots, pushed on '{', popped on '}'.
	$count             = count( $tokens );

	for ( $i = $range_start; $i <= $range_end; $i++ ) {
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

		$text = $tokens[ $i ]['text'];

		if ( '{' === $text ) {
			$checkpoints[] = $open_before_lines;
			continue;
		}

		if ( '}' === $text ) {
			array_pop( $checkpoints );
			continue;
		}

		if ( godam_shared_is_scope_terminator( $tokens, $i, $count ) ) {
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

		if ( godam_shared_is_hook_fire_at( $tokens, $i, WRAP_HOOK_NAME ) ) {
			$open_before_lines[] = $tokens[ $i ]['line'];
			continue;
		}

		if ( godam_shared_is_hook_fire_at( $tokens, $i, AFTER_HOOK_NAME ) ) {
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
 * named function body, once per deferred closure (add_action()/add_filter()
 * callback — see godam_shared_find_deferred_closures()), plus once more
 * across whatever top-level code (file scope, outside any function or
 * deferred closure) remains — concatenated in file order, since top-level
 * statements all run sequentially at include-time regardless of function
 * declarations interspersed between them.
 *
 * A deferred closure is excluded from whichever named function or top-level
 * range would otherwise physically contain it, and checked as its own
 * independent scope instead — see godam_check_hook_balance_in_range()'s own
 * $skip_ranges parameter for why: without this, an unclosed before() inside
 * the closure could be wrongly seen as "closed" by the enclosing function's
 * own, completely unrelated after(), purely because they happen to nest
 * lexically like matched parentheses, even though the closure actually runs
 * at a different time entirely.
 *
 * @param array[] $tokens    Full token list for the file.
 * @param array[] $functions This file's own godam_shared_find_functions() result.
 * @return array[] Each finding: scope ('top-level code', a function name, or a deferred-closure
 *                  label), plus the 'type'/'line'/'open_count' from godam_check_hook_balance_in_range().
 */
function godam_check_hook_balance_findings( $tokens, $functions ) {
	$findings          = array();
	$count             = count( $tokens );
	$top_level_indexes = array();
	$deferred_closures = godam_shared_find_deferred_closures( $tokens, $functions );

	// Combines two independent exclusions into one $skip_ranges list: any
	// deferred closure nested inside the queried range (walked separately
	// below), and any OTHER named function/method nested inside it (also
	// walked separately, in its own foreach below) — the latter matters now
	// that function ranges can genuinely nest (a method inside a
	// function-scoped anonymous class sits inside its enclosing function's
	// own range — see godam_shared_find_functions()'s own comment). Without
	// excluding it here, the outer function's own balance walk would also
	// see the nested method's own before()/after() calls, potentially
	// treating an imbalance inside the nested method as if it happened
	// inline in the outer function (or vice versa) purely because their
	// ranges happen to overlap, not because either one's code actually runs
	// that way.
	$skip_ranges_for = function ( $range_start, $range_end ) use ( $deferred_closures, $functions ) {
		return array_merge(
			godam_shared_ranges_nested_in( $range_start, $range_end, $deferred_closures ),
			godam_shared_ranges_nested_in( $range_start, $range_end, $functions )
		);
	};

	for ( $i = 0; $i < $count; $i++ ) {
		$inside_a_function = false;

		foreach ( $functions as $function ) {
			if ( $i >= $function['body_start'] && $i <= $function['body_end'] ) {
				$inside_a_function = true;
				break;
			}
		}

		$inside_a_deferred_closure = false;
		foreach ( $deferred_closures as $closure ) {
			if ( $i >= $closure['body_start'] && $i <= $closure['body_end'] ) {
				$inside_a_deferred_closure = true;
				break;
			}
		}

		if ( ! $inside_a_function && ! $inside_a_deferred_closure ) {
			$top_level_indexes[] = $i;
		}
	}

	foreach ( $functions as $function ) {
		$result = godam_check_hook_balance_in_range( $tokens, $function['body_start'], $function['body_end'], $skip_ranges_for( $function['body_start'], $function['body_end'] ) );

		if ( null !== $result ) {
			$result['scope'] = null !== $function['class'] ? "{$function['class']}::{$function['name']}()" : "{$function['name']}()";
			$findings[]      = $result;
		}
	}

	foreach ( $deferred_closures as $closure ) {
		$result = godam_check_hook_balance_in_range( $tokens, $closure['body_start'], $closure['body_end'], $skip_ranges_for( $closure['body_start'], $closure['body_end'] ) );

		if ( null !== $result ) {
			$result['scope'] = null !== $closure['hook_name']
				? "closure registered for '{$closure['hook_name']}' via add_action/add_filter()"
				: 'closure registered via add_action/add_filter()';
			$findings[]      = $result;
		}
	}

	if ( ! empty( $top_level_indexes ) ) {
		// Reindex to a contiguous array so godam_check_hook_balance_in_range()'s
		// own start/end range walk still works — it isn't aware of the gaps
		// this leaves where function bodies were skipped. Deferred-closure
		// ranges are already excluded from $top_level_indexes above, so no
		// skip_ranges are needed for this specific call.
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
 * Builds { "{relative_path}::{scope}" => count }, one entry per named
 * function (its own parameter-list range plus its body — see below), per
 * deferred closure (add_action()/add_filter() callback), and per file's
 * remaining top-level code — wherever $counter( $tokens, $range_start,
 * $range_end ) returns > 0.
 *
 * Per-function (and per-closure), not per-file: a hook removed from one
 * function while an unrelated one is added to a different function in the
 * SAME file would net to an unchanged file-level total under a per-file
 * count — exactly the blind spot a full manual audit (2026-08) found this
 * check would have had: the regressed function and the added function
 * canceling out, so the real removal is never caught. Scoping counts to the
 * function/closure/top-level-code they actually occurred in closes that.
 *
 * A function's own parameter-list range is counted SEPARATELY from its body
 * (own $counter call, own skip_ranges, summed into the same scope key) for
 * the same reason godam_coverage_file_findings() in the sibling
 * coverage-check.php walks the two independently — see that function's own
 * comment for the full "new in initializers" reasoning. This counter has no
 * per-variable safe-tracking to corrupt the way the coverage-checker's walk
 * does, so summing two separate calls under one key here is purely about
 * scope-label consistency with the coverage-checker, not a safety
 * requirement of this specific function.
 *
 * @param string[] $files   Absolute file paths to scan.
 * @param string   $root    Repo root, for making paths relative/portable.
 * @param callable $counter function( array $tokens, int $range_start, int $range_end, array $skip_ranges ): int.
 * @return array<string, int>
 */
function godam_check_build_counts( $files, $root, $counter ) {
	$counts = array();

	foreach ( $files as $file ) {
		$tokens            = godam_shared_tokenize( $file );
		$bodyless          = array();
		$functions         = godam_shared_find_functions( $tokens, $bodyless );
		$deferred_closures = godam_shared_find_deferred_closures( $tokens, $functions );
		$relative          = ltrim( str_replace( $root, '', $file ), DIRECTORY_SEPARATOR );
		$count             = count( $tokens );
		$top_level_indexes = array();

		// Every function's own parameter-list range, plus every bodyless
		// (interface/abstract) declaration's own parameter-list range (see
		// godam_shared_find_functions()'s own docblock on why those are
		// tracked separately from $functions), represented the same way
		// $functions/$deferred_closures entries are (body_start/body_end) so
		// godam_shared_ranges_nested_in() can treat them identically — see
		// this function's own docblock for why this range is counted
		// separately.
		$param_list_ranges = array();
		foreach ( $functions as $function ) {
			$param_list_ranges[] = array(
				'body_start' => $function['params_open'],
				'body_end'   => $function['params_close'],
			);
		}
		foreach ( $bodyless as $bodyless_fn ) {
			$param_list_ranges[] = array(
				'body_start' => $bodyless_fn['params_open'],
				'body_end'   => $bodyless_fn['params_close'],
			);
		}

		// Combines three independent exclusions: any deferred closure nested
		// inside the queried range (counted separately below), any OTHER
		// named function/method nested inside it (also counted separately,
		// in its own foreach below), and any function's own parameter-list
		// range nested inside it (also counted separately below) — the
		// latter two matter now that function ranges can genuinely nest (a
		// method inside a function-scoped anonymous class sits inside its
		// enclosing function's own range — see
		// godam_shared_find_functions()'s own comment). Without excluding
		// them here, the outer function's own count would double-count the
		// nested method's calls (and, separately, the nested method's own
		// parameter-list default value) on top of their own separate
		// entries — the exact same double-count shape already fixed below
		// for deferred closures, just for nested named functions/parameter
		// lists instead.
		$skip_ranges_for = function ( $range_start, $range_end ) use ( $deferred_closures, $functions, $param_list_ranges ) {
			return array_merge(
				godam_shared_ranges_nested_in( $range_start, $range_end, $deferred_closures ),
				godam_shared_ranges_nested_in( $range_start, $range_end, $functions ),
				godam_shared_ranges_nested_in( $range_start, $range_end, $param_list_ranges )
			);
		};

		for ( $i = 0; $i < $count; $i++ ) {
			$inside_a_function = false;
			foreach ( $functions as $function ) {
				if ( $i >= $function['body_start'] && $i <= $function['body_end'] ) {
					$inside_a_function = true;
					break;
				}
				if ( $i >= $function['params_open'] && $i <= $function['params_close'] ) {
					$inside_a_function = true;
					break;
				}
			}

			if ( ! $inside_a_function ) {
				foreach ( $bodyless as $bodyless_fn ) {
					if ( $i >= $bodyless_fn['params_open'] && $i <= $bodyless_fn['params_close'] ) {
						$inside_a_function = true;
						break;
					}
				}
			}

			$inside_a_deferred_closure = false;
			foreach ( $deferred_closures as $closure ) {
				if ( $i >= $closure['body_start'] && $i <= $closure['body_end'] ) {
					$inside_a_deferred_closure = true;
					break;
				}
			}

			if ( ! $inside_a_function && ! $inside_a_deferred_closure ) {
				$top_level_indexes[] = $i;
			}
		}

		foreach ( $functions as $function ) {
			$scope = null !== $function['class'] ? "{$function['class']}::{$function['name']}()" : "{$function['name']}()";
			// A deferred closure nested inside this function must be
			// excluded here — it's counted separately, under its own scope,
			// a few lines below. Without this, its own calls would be
			// counted twice: once folded into this function's total, and
			// again under the closure's own entry — confirmed as a real
			// double-count via a synthetic fixture before this was added.
			$n       = $counter( $tokens, $function['body_start'], $function['body_end'], $skip_ranges_for( $function['body_start'], $function['body_end'] ) );
			$param_n = $counter( $tokens, $function['params_open'], $function['params_close'], $skip_ranges_for( $function['params_open'], $function['params_close'] ) );
			$total   = $n + $param_n;

			if ( $total > 0 ) {
				$counts[ "{$relative}::{$scope}" ] = $total;
			}
		}

		// Every bodyless (interface/abstract) declaration's own parameter
		// list, counted the same independent way a regular function's
		// parameter list is above, for the identical "new in initializers"
		// reason (see this function's own docblock and
		// godam_shared_find_functions()'s own docblock on why these are
		// tracked separately from $functions).
		foreach ( $bodyless as $bodyless_fn ) {
			$scope   = null !== $bodyless_fn['class'] ? "{$bodyless_fn['class']}::{$bodyless_fn['name']}()" : "{$bodyless_fn['name']}()";
			$param_n = $counter( $tokens, $bodyless_fn['params_open'], $bodyless_fn['params_close'], $skip_ranges_for( $bodyless_fn['params_open'], $bodyless_fn['params_close'] ) );

			if ( $param_n > 0 ) {
				$counts[ "{$relative}::{$scope}" ] = $param_n;
			}
		}

		foreach ( $deferred_closures as $closure ) {
			$scope = null !== $closure['hook_name']
				? "closure registered for '{$closure['hook_name']}' via add_action/add_filter()"
				: 'closure registered via add_action/add_filter()';
			$n     = $counter( $tokens, $closure['body_start'], $closure['body_end'], $skip_ranges_for( $closure['body_start'], $closure['body_end'] ) );

			if ( $n > 0 ) {
				$counts[ "{$relative}::{$scope}" ] = $n;
			}
		}

		if ( ! empty( $top_level_indexes ) ) {
			// Deferred-closure ranges are already excluded from
			// $top_level_indexes above, so the reindexed array physically
			// doesn't contain their tokens — no skip_ranges needed here.
			$top_level_tokens = array_values( array_intersect_key( $tokens, array_flip( $top_level_indexes ) ) );
			$n                = $counter( $top_level_tokens, 0, count( $top_level_tokens ) - 1, array() );

			if ( $n > 0 ) {
				$counts[ "{$relative}::top-level code" ] = $n;
			}
		}
	}

	ksort( $counts );

	return $counts;
}

$wrap_counts   = godam_check_build_counts(
	$files,
	$root,
	function ( $tokens, $range_start, $range_end, $skip_ranges ) {
		return godam_check_count_hook_calls( $tokens, $range_start, $range_end, WRAP_HOOK_NAME, GODAM_HOOK_FIRE_FUNCTIONS, $skip_ranges );
	}
);
$access_counts = godam_check_build_counts(
	$files,
	$root,
	function ( $tokens, $range_start, $range_end, $skip_ranges ) {
		return godam_check_count_calls( $tokens, $range_start, $range_end, ACCESS_FUNCTIONS, $skip_ranges );
	}
);

// 3. Before/after hook balance. Every finding is keyed the same way as
// godam-attachment-access-coverage-check.php's own $findings ("{file}:
// {line}"), so a specific one can be accepted into the baseline with a
// reason via godam_check_known_balance_exceptions() below — same two-sided
// contract as that script's known_reasons(): nothing is accepted without a
// reason already on file, and update-baseline never reviews anything on its
// own. Computed in both modes; filtered against accepted exceptions and
// formatted into $balance_failures only in 'check' mode below.
$balance_findings = array();
foreach ( $files as $file ) {
	$tokens    = godam_shared_tokenize( $file );
	$functions = godam_shared_find_functions( $tokens );
	$relative  = ltrim( str_replace( $root, '', $file ), DIRECTORY_SEPARATOR );

	foreach ( godam_check_hook_balance_findings( $tokens, $functions ) as $finding ) {
		$key = "{$relative}:{$finding['line']}";

		$balance_findings[ $key ] = array(
			'file'       => $relative,
			'line'       => $finding['line'],
			'type'       => $finding['type'],
			'scope'      => $finding['scope'],
			'open_count' => $finding['open_count'] ?? null,
		);
	}
}

ksort( $balance_findings );

/**
 * Human-reviewed reasons for balance findings accepted as-is, keyed the same
 * way as $balance_findings ("{file}:{line}"). Merged into the baseline on
 * every `update-baseline` run so the *why* survives regeneration. Add an
 * entry here — not directly in the baseline JSON — only for a pairing this
 * script genuinely can't trace on its own (see the comment above
 * $balance_findings above); a real bug or an unrecognized scope-terminator
 * shape belongs fixed in the code or in godam_shared_is_scope_terminator(),
 * not excepted here.
 *
 * @return array<string, string>
 */
function godam_check_known_balance_exceptions() {
	return array();
}

/**
 * Builds one balance finding's own human-readable message.
 *
 * @param array $finding One of $balance_findings' own values.
 * @return string
 */
function godam_check_format_balance_finding( $finding ) {
	if ( 'stray_after' === $finding['type'] ) {
		return "{$finding['file']}:{$finding['line']} — {$finding['scope']}: rtgodam_after_attachment_lookup fires with no matching rtgodam_before_attachment_lookup open at that point. A hook may have been added without its pairing before, or the before was removed while the after stayed.";
	}

	$plural = 1 === $finding['open_count'] ? 'call' : 'calls';
	return "{$finding['file']}:{$finding['line']} — {$finding['scope']}: {$finding['open_count']} rtgodam_before_attachment_lookup {$plural} never reach a matching rtgodam_after_attachment_lookup before the end of this scope. The site context would stay switched to whatever site the before() call switched to for the rest of this request.";
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
	// Only a finding with an ACTUAL reviewed reason on file gets accepted —
	// same rule as godam-attachment-access-coverage-check.php's own baseline:
	// a finding with no reason must NOT appear in 'accepted_balance_exceptions'
	// at all, so 'check' keeps failing on it until a human either fixes the
	// code or adds a real reason here.
	$balance_reasons              = godam_check_known_balance_exceptions();
	$accepted_balance_exceptions  = array();
	$unexplained_balance_findings = array();

	foreach ( $balance_findings as $key => $finding ) {
		if ( isset( $balance_reasons[ $key ] ) ) {
			$finding['reason']                   = $balance_reasons[ $key ];
			$accepted_balance_exceptions[ $key ] = $finding;
		} else {
			$unexplained_balance_findings[] = $key;
		}
	}

	$baseline = array(
		'generated_note'              => 'Generated by bin/godam-wp-dam-hook-check.php update-baseline. Only run this after manually auditing what changed — it is the thing this check compares against, not a substitute for the audit. A balance finding only enters "accepted_balance_exceptions" if godam_check_known_balance_exceptions() already has a reason for it — this command does not review anything on its own.',
		'wrap_counts'                 => $wrap_counts,
		'access_counts'               => $access_counts,
		'accepted_balance_exceptions' => $accepted_balance_exceptions,
	);

	file_put_contents( $baseline_path, godam_check_json_encode( $baseline ) . "\n" );
	echo "Baseline written to {$baseline_path}.\n";
	echo 'Wrap-tracked scopes: ' . count( $wrap_counts ) . ', access-pattern scopes: ' . count( $access_counts ) . "\n";
	echo 'Balance findings tracked: ' . count( $balance_findings ) . ', accepted (reviewed, with a reason on file): ' . count( $accepted_balance_exceptions ) . "\n";

	if ( ! empty( $unexplained_balance_findings ) ) {
		echo "\n" . count( $unexplained_balance_findings ) . " balance finding(s) have NO reason on file, so they were NOT accepted —\n";
		echo "'check' will still report every one of them until you either fix the code or add a real\n";
		echo "reason to godam_check_known_balance_exceptions() and re-run update-baseline.\n";
	}

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

$baseline_wrap_counts        = $baseline['wrap_counts'] ?? array();
$baseline_access_counts      = $baseline['access_counts'] ?? array();
$accepted_balance_exceptions = $baseline['accepted_balance_exceptions'] ?? array();

$failures         = array();
$warnings         = array();
$balance_failures = array_map( 'godam_check_format_balance_finding', array_diff_key( $balance_findings, $accepted_balance_exceptions ) );

// 1. Per-function (not per-file — see godam_check_build_counts()'s own
// comment for why) wrap count must never decrease from baseline.
foreach ( $baseline_wrap_counts as $scope_key => $expected_count ) {
	$actual_count = $wrap_counts[ $scope_key ] ?? 0;

	if ( $actual_count < $expected_count ) {
		$failures[] = "{$scope_key}: rtgodam_before_attachment_lookup call count dropped from {$expected_count} to {$actual_count} — a wrap may have been lost.";
	}
}

// 2. Per-function attachment-access-pattern count increasing, or a new
// function/file appearing, is a *review* signal, not an automatic failure —
// surfaced as a warning that's still printed and still fails the job (see
// below), but phrased as "go look at this" rather than "this is definitely
// broken."
foreach ( $access_counts as $scope_key => $actual_count ) {
	$expected_count = $baseline_access_counts[ $scope_key ] ?? 0;

	if ( $actual_count > $expected_count ) {
		$warnings[] = "{$scope_key}: attachment-access call count went from {$expected_count} to {$actual_count} — new or moved code touching attachment data; verify it fires rtgodam_before_attachment_lookup/rtgodam_after_attachment_lookup around it, then run 'php bin/godam-wp-dam-hook-check.php update-baseline' to accept.";
	}
}

$scanned_files = array();
foreach ( array_merge( array_keys( $wrap_counts ), array_keys( $access_counts ) ) as $scope_key ) {
	$scanned_files[ strstr( $scope_key, '::', true ) ] = true;
}

echo 'Checked ' . count( $scanned_files ) . ' files (' . ( count( $wrap_counts ) + count( $access_counts ) ) . " function/closure/top-level scopes) with attachment-related patterns.\n";
echo 'Balance findings tracked: ' . count( $balance_findings ) . ' (' . count( $accepted_balance_exceptions ) . " previously accepted)\n\n";

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
