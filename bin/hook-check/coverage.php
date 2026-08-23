<?php
/**
 * Coverage audit: finds every real call to one of the 12 tracked
 * attachment-access functions (get_post_meta, wp_get_attachment_url, etc.)
 * that has no rtgodam_before_attachment_lookup bracket open at that exact
 * point — one candidate per call site, not per file.
 *
 * The sibling balance.php only catches a wrap regressing or
 * an existing pair being unbalanced — neither answers "does every
 * attachment-touching call site have a wrap at all," which matters because
 * a centralizing plugin like wp-dam has no way to know GoDAM is about to
 * touch attachment data unless GoDAM fires this hook pair around it.
 *
 * Shares its tokenizer and hook-fire/scope-terminator detection with the
 * sibling script via shared.php. On top of the same
 * branch-aware before/after balance walk, this script watches every real
 * access-function call: if nothing is open at that point, it's a
 * candidate — unless the call's first argument is provably safe
 * (godam_coverage_assignment_at()): one of the enclosing function's own
 * parameters, a plain unmodified alias of one, or a cast/single-argument
 * sanitizing call of one that hasn't since been reassigned (including via
 * `list()`/`[...]` destructuring, which always revokes safety).
 *
 * A parameter-sourced call is reported under its own PARAMETER_SOURCED kind
 * (see FINDING_KIND_* below) unless godam_coverage_trace_callers() can
 * already resolve it automatically, by recursively tracing whether the
 * enclosing function is itself always invoked under a bracket, arbitrarily
 * many hops deep (see godam_coverage_resolve_coverage()).
 *
 * A clean run means "every candidate call site is either wrapped, or
 * explicitly justified in place" — not "every access here is correctly
 * centralized." There is no baseline file: a human reads the surrounding
 * code and either adds the hook, or records why it's fine as-is with one
 * of four comments at the call site (see godam_shared_coverage_directives()
 * in shared.php) — mirroring phpcs:ignore/disable/enable/
 * ignoreFile minus a rule-code argument (this script only checks one thing):
 *
 *   get_post_meta( $id, 'x', true ); // godam-coverage-ignore -- not attachment data, see docblock above
 *
 *   // godam-coverage-disable -- whole migration is host-post-scoped, see class docblock
 *   ...several lines...
 *   // godam-coverage-enable
 *
 *   // godam-coverage-ignore-file -- entire file operates on the 'godam-video' CPT, never 'attachment'
 *
 * A godam-coverage-disable with no matching godam-coverage-enable before
 * end of file is a hard error, not a silent "rest of the file is fine."
 *
 * Scans the entire plugin root (godam_shared_list_all_php_files()), a
 * deny-list rather than an explicit directory list — see
 * GODAM_EXCLUDED_ROOT_DIRS in shared.php.
 *
 * One mode — the code itself (hooks plus inline comments) is the complete
 * source of truth, nothing to update:
 *   php bin/hook-check/coverage.php
 *
 * @package GoDAM
 */

// phpcs:disable WordPress.WP.AlternativeFunctions, WordPress.Security.EscapeOutput, WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_fwrite -- CLI script, no WP bootstrap, no browser output, no VIP filesystem restrictions (writes to STDERR only).

require_once __DIR__ . '/shared.php';

const BEFORE_HOOK = 'rtgodam_before_attachment_lookup';
const AFTER_HOOK  = 'rtgodam_after_attachment_lookup';

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

// Finding kinds, in the order the "why does this need a reason" story gets
// harder to argue with — used for the printed report's own grouping.
const FINDING_KIND_DIRECT           = 'direct'; // No open bracket, non-parameter argument.
const FINDING_KIND_CALLER_CONFIRMED = 'caller_confirmed'; // Parameter-sourced, but a real caller is itself uncovered — see godam_coverage_trace_callers().
const FINDING_KIND_UNVERIFIED       = 'unverified'; // Parameter-sourced; tracing couldn't prove it either way.

// No baseline file anymore — error instead of silently ignoring a stale
// 'update-baseline' call from CI config or muscle memory.
if ( isset( $argv[1] ) && 'update-baseline' === $argv[1] ) {
	fwrite( STDERR, "'update-baseline' no longer exists — this script has no baseline file to\n" );
	fwrite( STDERR, "write. Add a // godam-coverage-ignore/-disable/-enable/-ignore-file comment\n" );
	fwrite( STDERR, "at the call site instead (see this script's own top-of-file comment for\n" );
	fwrite( STDERR, "the exact syntax), then re-run with no arguments.\n" );
	exit( 1 );
}

/**
 * If the token at $i starts a real, bare call to one of ACCESS_FUNCTIONS,
 * returns ['name' => function name, 'arg' => unprefixed first-argument
 * variable name, or '' if the first argument isn't a plain variable].
 * Returns null otherwise.
 *
 * Uses godam_shared_is_bare_call_to() for the same reason
 * godam_shared_is_hook_fire_at()/godam_shared_is_scope_terminator() do:
 * every ACCESS_FUNCTIONS name is a core global, never legitimately called
 * via ->/::, so this only excludes a same-named user-defined method or
 * declaration. 'name' is run through godam_shared_unqualified_name() so a
 * qualified call reports as "get_post_meta()", not leaking its leading
 * backslash — cosmetic only, findings are keyed on file:line.
 *
 * @param array[] $tokens Token list.
 * @param int     $i      Index to check.
 * @param int     $count  Token count.
 * @return array|null
 */
function godam_coverage_access_call_at( $tokens, $i, $count ) {
	if ( ! godam_shared_is_bare_call_to( $tokens, $i, ACCESS_FUNCTIONS, $count ) ) {
		return null;
	}

	$name = godam_shared_unqualified_name( $tokens[ $i ]['text'] );
	$open = godam_shared_skip_forward( $tokens, $i + 1, $count ); // The '(' itself.
	$arg  = godam_shared_skip_forward( $tokens, $open + 1, $count );

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
 * If the T_VARIABLE token at $i is immediately followed by a bare '=' (a
 * real assignment — '==', '+=', etc. are their own distinct tokens),
 * returns ['target' => name, 'safe_copy_of' => name|null]. 'safe_copy_of'
 * is set only for two shapes, both immediately followed by ';' with
 * nothing else: a bare copy of another variable ($x = $y;), or $target
 * reassigned to a cast or single-argument call of itself ($id =
 * absint($id);, $id = (int) $id;) — sanitizing/casting doesn't introduce
 * new external data, so it shouldn't cost the value its safety. Anything
 * else on the right gets 'safe_copy_of' => null. Returns null entirely if
 * $i isn't an assignment target at all.
 *
 * Deliberately does NOT handle `list( $target, ... ) = ...` or
 * `[ $target, ... ] = ...` — detected separately by
 * godam_coverage_destructuring_targets_at(), since a destructured value is
 * never a "bare copy" and should always revoke safety, never preserve it.
 *
 * @param array[] $tokens Token list.
 * @param int     $i      Index of a token to check (only meaningful for a T_VARIABLE).
 * @param int     $count  Token count.
 * @return array|null
 */
function godam_coverage_assignment_at( $tokens, $i, $count ) {
	if ( T_VARIABLE !== ( $tokens[ $i ]['id'] ?? null ) ) {
		return null;
	}

	$eq = godam_shared_skip_forward( $tokens, $i + 1, $count );
	if ( $eq >= $count || '=' !== $tokens[ $eq ]['text'] ) {
		return null;
	}

	$target = ltrim( $tokens[ $i ]['text'], '$' );
	$rhs    = godam_shared_skip_forward( $tokens, $eq + 1, $count );

	// Shape 1: a bare copy, e.g. $target = $other.
	if ( $rhs < $count && T_VARIABLE === ( $tokens[ $rhs ]['id'] ?? null ) ) {
		$after_rhs = godam_shared_skip_forward( $tokens, $rhs + 1, $count );
		if ( $after_rhs < $count && ';' === $tokens[ $after_rhs ]['text'] ) {
			return array(
				'target'       => $target,
				'safe_copy_of' => ltrim( $tokens[ $rhs ]['text'], '$' ),
			);
		}
		return array(
			'target'       => $target,
			'safe_copy_of' => null,
		); // e.g. $x = $y->prop or $x = $y . 'z' — more than a bare copy.
	}

	// Shape 2: a cast of itself, e.g. $target = (int) $target.
	$cast_tokens = array( T_INT_CAST, T_DOUBLE_CAST, T_STRING_CAST, T_ARRAY_CAST, T_BOOL_CAST, T_UNSET_CAST );
	if ( $rhs < $count && in_array( $tokens[ $rhs ]['id'] ?? null, $cast_tokens, true ) ) {
		$var = godam_shared_skip_forward( $tokens, $rhs + 1, $count );
		if ( $var < $count && T_VARIABLE === ( $tokens[ $var ]['id'] ?? null ) && ltrim( $tokens[ $var ]['text'], '$' ) === $target ) {
			$after = godam_shared_skip_forward( $tokens, $var + 1, $count );
			if ( $after < $count && ';' === $tokens[ $after ]['text'] ) {
				return array(
					'target'       => $target,
					'safe_copy_of' => $target,
				); // Casting itself preserves whatever safety it already had.
			}
		}
		return array(
			'target'       => $target,
			'safe_copy_of' => null,
		);
	}

	// Shape 3: a single-argument self-call, e.g. $target = absint( $target )
	// — bare or qualified (matching godam_shared_is_call_to()'s own
	// qualified-name widening; no name list to check against here, so only
	// the token types need accepting).
	if ( $rhs < $count && in_array( $tokens[ $rhs ]['id'] ?? null, array( T_STRING, T_NAME_FULLY_QUALIFIED, T_NAME_QUALIFIED ), true ) ) {
		$open = godam_shared_skip_forward( $tokens, $rhs + 1, $count );
		if ( $open < $count && '(' === $tokens[ $open ]['text'] ) {
			$arg = godam_shared_skip_forward( $tokens, $open + 1, $count );
			if ( $arg < $count && T_VARIABLE === ( $tokens[ $arg ]['id'] ?? null ) && ltrim( $tokens[ $arg ]['text'], '$' ) === $target ) {
				$close = godam_shared_skip_forward( $tokens, $arg + 1, $count );
				if ( $close < $count && ')' === $tokens[ $close ]['text'] ) {
					$after = godam_shared_skip_forward( $tokens, $close + 1, $count );
					if ( $after < $count && ';' === $tokens[ $after ]['text'] ) {
						return array(
							'target'       => $target,
							'safe_copy_of' => $target,
						); // Single-arg self-transform (sanitize/format-style) preserves safety.
					}
				}
			}
		}
		return array(
			'target'       => $target,
			'safe_copy_of' => null,
		);
	}

	// Anything else on the right — a literal, array(), a property access,
	// a `new` expression, a multi-argument or chained call — isn't one of
	// the recognized safety-preserving shapes above.
	return array(
		'target'       => $target,
		'safe_copy_of' => null,
	);
}

/**
 * If the token at $i starts a `list( ... ) = ...` or a statement-leading
 * `[ ... ] = ...` (short-array destructuring), returns the unprefixed names
 * of every variable named directly inside it — each is freshly assigned
 * from the right-hand side, so every name here should have its safety
 * revoked, never preserved.
 *
 * The `[` case is scoped to statement-start position (immediately after
 * `;`, `{`, `}`) so an ordinary array literal or a `$arr[0]` subscript
 * isn't mistaken for a destructuring target. Nested destructuring
 * (`list( $a, list( $b, $c ) ) = ...`) only recognizes the outer level's
 * own variables — a narrow, accepted gap for a rare shape. The
 * statement-start check can also misfire on a `[...] =` that's the first
 * top-level statement right after a function definition, since
 * godam_coverage_file_findings()'s reindexed top-level token list cuts
 * function bodies out — narrow and unlikely in a WordPress plugin.
 *
 * @param array[] $tokens Token list.
 * @param int     $i      Index to check.
 * @param int     $count  Token count.
 * @return string[] Variable names (unprefixed), empty if $i isn't a recognized destructuring target.
 */
function godam_coverage_destructuring_targets_at( $tokens, $i, $count ) {
	$is_list_keyword = T_LIST === ( $tokens[ $i ]['id'] ?? null );
	$is_bracket_open = null === ( $tokens[ $i ]['id'] ?? null ) && '[' === $tokens[ $i ]['text'];

	if ( ! $is_list_keyword && ! $is_bracket_open ) {
		return array();
	}

	if ( $is_bracket_open ) {
		$prev      = godam_shared_skip_backward( $tokens, $i - 1 );
		$prev_text = $prev >= 0 ? $tokens[ $prev ]['text'] : '';
		if ( $prev >= 0 && ! in_array( $prev_text, array( ';', '{', '}' ), true ) ) {
			return array(); // Not statement-start — an array literal or $arr[...] access, not a destructuring target.
		}
	}

	$open = $is_list_keyword ? godam_shared_skip_forward( $tokens, $i + 1, $count ) : $i;
	if ( $open >= $count || ( '(' !== $tokens[ $open ]['text'] && '[' !== $tokens[ $open ]['text'] ) ) {
		return array();
	}

	$targets     = array();
	$paren_depth = 0;
	$j           = $open;

	for ( ; $j < $count; $j++ ) {
		$text = $tokens[ $j ]['text'];

		if ( '(' === $text || '[' === $text ) {
			++$paren_depth;
			continue;
		}
		if ( ')' === $text || ']' === $text ) {
			--$paren_depth;
			if ( 0 === $paren_depth ) {
				break;
			}
			continue;
		}
		if ( 1 === $paren_depth && T_VARIABLE === ( $tokens[ $j ]['id'] ?? null ) ) {
			$targets[] = ltrim( $tokens[ $j ]['text'], '$' );
		}
	}

	if ( $j >= $count ) {
		return array(); // Unbalanced brackets — bail rather than guess.
	}

	$after = godam_shared_skip_forward( $tokens, $j + 1, $count );
	if ( $after >= $count || '=' !== $tokens[ $after ]['text'] ) {
		return array(); // Not actually an assignment — e.g. a short-array literal used as a plain expression.
	}

	return $targets;
}

/**
 * Thin wrapper around godam_shared_find_functions() — kept as its own
 * function in case coverage-specific metadata is ever needed here without
 * touching the sibling script.
 *
 * @param array[] $tokens                 Normalized tokens from godam_shared_tokenize().
 * @param array[] &$bodyless_declarations Output — see godam_shared_find_functions()'s own docblock.
 * @return array[] Each: name, class, visibility, params (string[]), body_start, body_end.
 */
function godam_coverage_find_functions( $tokens, &$bodyless_declarations = array() ) {
	return godam_shared_find_functions( $tokens, $bodyless_declarations );
}

/**
 * Walks a token range tracking before/after balance exactly like
 * godam_check_hook_balance_in_range() (same checkpoint-per-'{',
 * rewind-on-scope-terminator algorithm), and additionally records every
 * access-function call found with nothing open at that point, split into
 * 'uncovered' (a non-parameter argument) and 'parameter_sourced' (the
 * argument is one of the enclosing scope's own parameters, or a traceable
 * alias of one — see godam_coverage_assignment_at()).
 *
 * Also records, in 'call_sites', every real call to a name in
 * $known_call_targets (the codebase-wide set godam_coverage_trace_callers()
 * might need to trace a parameter_sourced finding back to its callers),
 * with whether a before/after bracket was open there — reusing this same
 * walk rather than re-tokenizing the file a second time.
 *
 * The set of "safe" variable names starts from the enclosing scope's own
 * parameters and evolves alongside the scan: a plain, unmodified copy of a
 * currently-safe variable extends safety to the new name; any other
 * reassignment (including destructuring) revokes it. This tracking has no
 * branch-awareness, unlike the before/after balance tracking above — a
 * deliberate simplification; safety differing across branches at an access
 * call hasn't shown up as a real false positive or negative.
 *
 * @param array[] $tokens             Full token list for the file.
 * @param int     $range_start        Token index to start at (inclusive).
 * @param int     $range_end          Token index to end at (inclusive).
 * @param array   $params             Enclosing function's own parameter names (empty for top-level code).
 * @param array   $known_call_targets Set (name => true) of function/method names worth recording call sites for.
 * @param array[] $skip_ranges        Each [start, end] to jump past — deferred closures nested in this
 *                                    range, walked independently by godam_coverage_file_findings()
 *                                    with a fresh bracket state, since they can run at a different
 *                                    time than the function that merely defines them.
 * @return array{uncovered: array[], parameter_sourced: array[], call_sites: array[]}
 *               uncovered/parameter_sourced entries: line, call.
 *               call_sites entries: name, line, covered (bool), method_style (bool — preceded by -> or ::).
 */
function godam_coverage_check_range( $tokens, $range_start, $range_end, $params, $known_call_targets, $skip_ranges = array() ) {
	$open_before_lines = array();
	$checkpoints       = array();
	$count             = count( $tokens );
	$uncovered         = array();
	$parameter_sourced = array();
	$call_sites        = array();
	$safe_vars         = $params;

	for ( $i = $range_start; $i <= $range_end; $i++ ) {
		$jumped = false;
		foreach ( $skip_ranges as $skip ) {
			if ( $i === $skip[0] ) {
				$i      = $skip[1]; // The loop's own ++$i then lands just past it.
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
			// Rewind to the state when the innermost enclosing block was
			// entered — see godam_check_hook_balance_in_range() for the full
			// reasoning. That script flags an actual imbalance; this one only
			// cares whether access calls are covered, so it always rewinds
			// unconditionally rather than also checking the over-open case.
			$open_before_lines = empty( $checkpoints ) ? array() : end( $checkpoints );
			continue;
		}

		if ( godam_shared_is_hook_fire_at( $tokens, $i, BEFORE_HOOK ) ) {
			$open_before_lines[] = $tokens[ $i ]['line'];
			continue;
		}

		if ( godam_shared_is_hook_fire_at( $tokens, $i, AFTER_HOOK ) ) {
			if ( ! empty( $open_before_lines ) ) {
				array_pop( $open_before_lines );
			}
			continue;
		}

		$destructured = godam_coverage_destructuring_targets_at( $tokens, $i, $count );
		if ( ! empty( $destructured ) ) {
			$safe_vars = array_values( array_diff( $safe_vars, $destructured ) );
		}

		$assignment = godam_coverage_assignment_at( $tokens, $i, $count );
		if ( null !== $assignment ) {
			if ( null !== $assignment['safe_copy_of'] && in_array( $assignment['safe_copy_of'], $safe_vars, true ) ) {
				$safe_vars[] = $assignment['target'];
			} else {
				$safe_vars = array_values( array_diff( $safe_vars, array( $assignment['target'] ) ) );
			}
		}

		if ( T_STRING === ( $tokens[ $i ]['id'] ?? null ) && isset( $known_call_targets[ $tokens[ $i ]['text'] ] ) ) {
			$n = godam_shared_skip_forward( $tokens, $i + 1, $count );
			if ( $n < $count && '(' === $tokens[ $n ]['text'] ) {
				$p = godam_shared_skip_backward( $tokens, $i - 1 );

				// A function's own declaration tokenizes identically to a call
				// to a same-named function (T_STRING followed by '('). Harmless
				// for a method (already excluded by the method_style check
				// below), but a FREE function's own declaration line would
				// otherwise be recorded as a fake call site to itself, always
				// resolving as an unrecoverable gap. Also excludes `new
				// ClassName(`: a class and a free function can share a bare
				// name, and `known_call_targets` is keyed purely by text, so
				// `new Helper()` would otherwise be indistinguishable from a
				// call to a free function also named Helper.
				$preceded_by_new = $p >= 0 && T_NEW === ( $tokens[ $p ]['id'] ?? null );

				if ( ! $preceded_by_new && ! godam_shared_is_function_declaration_at( $tokens, $i ) ) {
					$method_style = $p >= 0 && in_array( $tokens[ $p ]['text'], array( '->', '::' ), true );

					$call_sites[] = array(
						'name'         => $tokens[ $i ]['text'],
						'line'         => $tokens[ $i ]['line'],
						'covered'      => ! empty( $open_before_lines ),
						'method_style' => $method_style,
					);
				}
			}
		}

		// Query-pattern calls (new WP_Query(), get_posts(), $wpdb->query()-
		// style methods) are always treated as "direct" — never parameter-
		// sourced, since none of them take a single attachment-ID argument
		// to check against a safe-parameter set the way get_post_meta()
		// does.
		$query_pattern = godam_shared_query_pattern_at( $tokens, $i, $range_start, $range_end, $count );
		if ( null !== $query_pattern ) {
			if ( empty( $open_before_lines ) && $query_pattern['is_attachment_shaped'] ) {
				$uncovered[] = array(
					'line' => $tokens[ $i ]['line'],
					'call' => $query_pattern['name'],
				);
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

		if ( '' !== $access['arg'] && in_array( $access['arg'], $safe_vars, true ) ) {
			$parameter_sourced[] = array(
				'line' => $tokens[ $i ]['line'],
				'call' => $access['name'],
			);
			continue;
		}

		$uncovered[] = array(
			'line' => $tokens[ $i ]['line'],
			'call' => $access['name'],
		);
	}

	return array(
		'uncovered'         => $uncovered,
		'parameter_sourced' => $parameter_sourced,
		'call_sites'        => $call_sites,
	);
}

/**
 * Runs godam_coverage_check_range() across an entire file: once per named
 * function's own parameter list, once per named function body, once per
 * deferred closure (add_action()/add_filter() callback), plus once more
 * across whatever top-level code remains — concatenated in file order.
 *
 * A deferred closure is excluded from its enclosing range and walked as its
 * own independent scope (empty bracket state, its own parameters) — it can
 * run at a completely different time than the function that defines it.
 * Its parameter-sourced findings get fn_name = null: nothing else can call
 * an anonymous closure by name, so there's nothing to trace.
 *
 * A function's own parameter list is walked as a SEPARATE range from its
 * body, for a PHP 8.1+ "new in initializers" default value (`function
 * search( $query = new WP_Query(...) )`), which sits before body_start and
 * would otherwise be mislabeled as top-level code. Merging the two ranges
 * into one walk is unsafe: `$query = new WP_Query(...)` looks like a real
 * assignment, so godam_coverage_assignment_at() would wrongly revoke
 * $query's safety for the rest of the function. The two independent calls
 * share no mutable state, so they can't interfere; findings from both are
 * merged under the same scope label.
 *
 * Every parameter-list finding carries 'from_param_list' => true: findings
 * are keyed by "{file}:{line}", and a compact one-liner can put a
 * parameter-list default and a body call on the same physical line, so the
 * flag lets the caller disambiguate without changing the key format for
 * every other finding.
 *
 * $bodyless_declarations gets the same parameter-list treatment as
 * $functions, for the same "new in initializers" reason on an
 * interface/abstract method's default value. Its findings get fn_name =
 * null too: a bodyless declaration is deliberately never added to
 * $definitions_by_name (see godam_shared_find_functions()), so there's no
 * safe way to trace it as a caller/callee.
 *
 * @param array[] $tokens                Full token list for the file.
 * @param array[] $functions             This file's own godam_coverage_find_functions() result.
 * @param array   $known_call_targets    Passed straight through to godam_coverage_check_range().
 * @param array[] $bodyless_declarations This file's own godam_coverage_find_functions() by-reference output.
 * @return array{uncovered: array[], parameter_sourced: array[], call_sites: array[]}
 *               uncovered/parameter_sourced entries: line, call, scope ('top-level code', a function
 *               name, or a deferred-closure label), from_param_list (bool, only ever true).
 *               call_sites entries: name, line, covered, method_style, scope, enclosing_fn_name (the
 *               enclosing function/method this call site itself sits inside — null for top-level code
 *               and for deferred closures, neither of which is callable by name).
 */
function godam_coverage_file_findings( $tokens, $functions, $known_call_targets, $bodyless_declarations = array() ) {
	$uncovered         = array();
	$parameter_sourced = array();
	$call_sites        = array();
	$count             = count( $tokens );
	$top_level_indexes = array();

	$deferred_closures = godam_shared_find_deferred_closures( $tokens, $functions );

	// Every function's own parameter-list range, plus every bodyless
	// declaration's, represented the same way $functions/$deferred_closures
	// entries are (body_start/body_end) so godam_shared_ranges_nested_in()
	// can treat them identically.
	$param_list_ranges = array();
	foreach ( $functions as $function ) {
		$param_list_ranges[] = array(
			'body_start' => $function['params_open'],
			'body_end'   => $function['params_close'],
		);
	}
	foreach ( $bodyless_declarations as $bodyless ) {
		$param_list_ranges[] = array(
			'body_start' => $bodyless['params_open'],
			'body_end'   => $bodyless['params_close'],
		);
	}

	// Combines three independent exclusions into one $skip_ranges list, each
	// walked separately below with its own state: (a) any deferred closure
	// nested inside the range, (b) any OTHER named function/method nested
	// inside it, and (c) any function's own parameter-list range nested
	// inside it. (b) and (c) matter because function ranges can genuinely
	// nest (a method inside a function-scoped anonymous class) — without
	// excluding them, the outer walk would re-scan the nested scope's
	// tokens under the OUTER function's params/bracket state.
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
			foreach ( $bodyless_declarations as $bodyless ) {
				if ( $i >= $bodyless['params_open'] && $i <= $bodyless['params_close'] ) {
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
		$scope  = null !== $function['class'] ? "{$function['class']}::{$function['name']}()" : "{$function['name']}()";
		$result = godam_coverage_check_range( $tokens, $function['body_start'], $function['body_end'], $function['params'], $known_call_targets, $skip_ranges_for( $function['body_start'], $function['body_end'] ) );

		foreach ( $result['uncovered'] as $finding ) {
			$finding['scope'] = $scope;
			$uncovered[]      = $finding;
		}
		foreach ( $result['parameter_sourced'] as $finding ) {
			$finding['scope']    = $scope;
			$finding['fn_name']  = $function['name'];
			$finding['class']    = $function['class'];
			$parameter_sourced[] = $finding;
		}
		foreach ( $result['call_sites'] as $call_site ) {
			$call_site['scope']             = $scope;
			$call_site['enclosing_fn_name'] = $function['name'];
			$call_sites[]                   = $call_site;
		}

		// The function's own parameter list, walked independently (empty
		// params/safe_vars, see this function's own docblock) so a "new in
		// initializers" default value is found without sharing mutable
		// state with the body walk above.
		$param_result = godam_coverage_check_range( $tokens, $function['params_open'], $function['params_close'], array(), $known_call_targets, $skip_ranges_for( $function['params_open'], $function['params_close'] ) );

		foreach ( $param_result['uncovered'] as $finding ) {
			$finding['scope']           = $scope;
			$finding['from_param_list'] = true; // See godam_coverage_file_findings()'s own docblock note on this flag.
			$uncovered[]                = $finding;
		}
		foreach ( $param_result['parameter_sourced'] as $finding ) {
			$finding['scope']           = $scope;
			$finding['fn_name']         = $function['name'];
			$finding['class']           = $function['class'];
			$finding['from_param_list'] = true;
			$parameter_sourced[]        = $finding;
		}
		foreach ( $param_result['call_sites'] as $call_site ) {
			$call_site['scope']             = $scope;
			$call_site['enclosing_fn_name'] = $function['name'];
			$call_sites[]                   = $call_site;
		}
	}

	// Every bodyless declaration's own parameter list — same independent,
	// empty-params walk as a regular function's, for the same "new in
	// initializers" reason. fn_name is always null: a bodyless declaration
	// is deliberately never added to $definitions_by_name (see
	// godam_shared_find_functions()'s docblock), so there's no safe name to
	// trace a finding through.
	foreach ( $bodyless_declarations as $bodyless ) {
		$scope        = null !== $bodyless['class'] ? "{$bodyless['class']}::{$bodyless['name']}()" : "{$bodyless['name']}()";
		$param_result = godam_coverage_check_range( $tokens, $bodyless['params_open'], $bodyless['params_close'], array(), $known_call_targets, $skip_ranges_for( $bodyless['params_open'], $bodyless['params_close'] ) );

		foreach ( $param_result['uncovered'] as $finding ) {
			$finding['scope']           = $scope;
			$finding['from_param_list'] = true;
			$uncovered[]                = $finding;
		}
		foreach ( $param_result['parameter_sourced'] as $finding ) {
			$finding['scope']           = $scope;
			$finding['fn_name']         = null;
			$finding['class']           = null;
			$finding['from_param_list'] = true;
			$parameter_sourced[]        = $finding;
		}
		foreach ( $param_result['call_sites'] as $call_site ) {
			$call_site['scope']             = $scope;
			$call_site['enclosing_fn_name'] = null;
			$call_sites[]                   = $call_site;
		}
	}

	foreach ( $deferred_closures as $closure ) {
		$scope  = null !== $closure['hook_name']
			? "closure registered for '{$closure['hook_name']}' via add_action/add_filter()"
			: 'closure registered via add_action/add_filter()';
		$result = godam_coverage_check_range( $tokens, $closure['body_start'], $closure['body_end'], $closure['params'], $known_call_targets, $skip_ranges_for( $closure['body_start'], $closure['body_end'] ) );

		foreach ( $result['uncovered'] as $finding ) {
			$finding['scope'] = $scope;
			$uncovered[]      = $finding;
		}
		foreach ( $result['parameter_sourced'] as $finding ) {
			$finding['scope']    = $scope;
			$finding['fn_name']  = null; // Anonymous — nothing else can call it by name, so it can't be traced to a caller.
			$finding['class']    = null;
			$parameter_sourced[] = $finding;
		}
		foreach ( $result['call_sites'] as $call_site ) {
			$call_site['scope']             = $scope;
			$call_site['enclosing_fn_name'] = null;
			$call_sites[]                   = $call_site;
		}
	}

	if ( ! empty( $top_level_indexes ) ) {
		$top_level_tokens = array_values( array_intersect_key( $tokens, array_flip( $top_level_indexes ) ) );
		$result           = godam_coverage_check_range( $top_level_tokens, 0, count( $top_level_tokens ) - 1, array(), $known_call_targets );

		foreach ( $result['uncovered'] as $finding ) {
			$finding['scope'] = 'top-level code';
			$uncovered[]      = $finding;
		}
		foreach ( $result['parameter_sourced'] as $finding ) {
			$finding['scope']    = 'top-level code';
			$finding['fn_name']  = null;
			$finding['class']    = null;
			$parameter_sourced[] = $finding;
		}
		foreach ( $result['call_sites'] as $call_site ) {
			$call_site['scope']             = 'top-level code';
			$call_site['enclosing_fn_name'] = null; // Top-level code is never itself "called" — see godam_coverage_trace_callers().
			$call_sites[]                   = $call_site;
		}
	}

	return array(
		'uncovered'         => $uncovered,
		'parameter_sourced' => $parameter_sourced,
		'call_sites'        => $call_sites,
	);
}

/**
 * Recursively (with memoization and cycle-breaking) determines whether
 * every real invocation of a codebase-wide-uniquely-named function/method
 * is guaranteed to happen with a rtgodam_before_attachment_lookup bracket
 * already open — either locally, or because the call site sits inside
 * ANOTHER function that is itself always invoked under a bracket,
 * arbitrarily many levels deep.
 *
 * Correct for an ARBITRARY number of hops because the recursion only asks
 * "how is this function invoked," never "does this function touch
 * attachment data." A fixed-depth or iterative version asking the latter
 * would fail on a PURE forwarding function (no access call of its own): it
 * could never resolve as "itself always covered," so any deeper call
 * reached through it would be wrongly reported as a confirmed gap.
 *
 * Deliberately conservative regardless of chain depth: a name is only
 * ever resolved automatically when it's unique across the entire
 * codebase. A same-named method on an unrelated class is common in a
 * WordPress plugin (render(), get_instance(), setup_hooks() all recur
 * here), and a text-level search can't tell "a call to ClassA::render()"
 * from "a call to ClassB::render()" — so an ambiguous name resolves to
 * 'unknown' for a human to check.
 *
 * For a unique name, call sites are filtered to the shape its definition
 * could actually be called through:
 *   - `private` method: only `$this->name(`/`self::name(`/`static::name(`
 *     sites, within the definition's own 'allowed_files' — ordinarily just
 *     its own file, but widened to every file that `use`s the trait when
 *     the method is defined inside a trait (see Pass 1 below).
 *   - non-private method: any `->name(`/`::name(` call site, anywhere.
 *   - free function: any bare `name(` call site, anywhere.
 *
 * Cycles are broken via $in_progress: hitting a name already being
 * resolved higher up the call stack returns 'unknown' for that edge
 * WITHOUT memoizing it, so the surrounding resolution can still finish
 * using its other, non-cyclic call sites. Expected to be rare in
 * practice — WordPress hook callbacks and REST routes are the real entry
 * points here, not functions calling each other in a loop.
 *
 * @param string $name                Bare function/method name to resolve.
 * @param array  $definitions_by_name Name => list of {file, class, visibility}.
 * @param array  $call_sites_by_name  Name => list of call sites {file, line, covered, method_style, enclosing_fn_name}.
 * @param array  &$memo               name => resolution result (see return shape). Shared across the whole trace; populated lazily.
 * @param array  &$in_progress        Set (name => true) of names currently being resolved higher up the recursion stack.
 * @return array{status: string, problem_candidates: array[], reason: string|null} status is 'covered'|'gap'|'unknown'.
 */
function godam_coverage_resolve_coverage( $name, $definitions_by_name, $call_sites_by_name, &$memo, &$in_progress ) {
	if ( isset( $memo[ $name ] ) ) {
		return $memo[ $name ];
	}

	if ( isset( $in_progress[ $name ] ) ) {
		return array(
			'status'             => 'unknown',
			'problem_candidates' => array(),
			'reason'             => "circular caller relationship involving {$name}() — verify manually.",
		);
	}

	$definitions = $definitions_by_name[ $name ] ?? array();

	if ( 1 !== count( $definitions ) ) {
		$result        = array(
			'status'             => 'unknown',
			'problem_candidates' => array(),
			'reason'             => count( $definitions ) > 1
				? sprintf( '%d functions/methods named %s() exist codebase-wide — call-graph tracing skipped to avoid a cross-class mismatch.', count( $definitions ), $name )
				: 'enclosing function/method definition not found (should not happen — tracing skipped defensively).',
		);
		$memo[ $name ] = $result;
		return $result;
	}

	$definition = $definitions[0];
	$candidates = array();

	foreach ( ( $call_sites_by_name[ $name ] ?? array() ) as $call_site ) {
		if ( null === $definition['class'] ) {
			// Free function: only a bare call is a real match; -> / :: means
			// this text match is an unrelated method with the same name.
			if ( ! $call_site['method_style'] ) {
				$candidates[] = $call_site;
			}
			continue;
		}

		// Method: only a -> / :: call is a real match.
		if ( ! $call_site['method_style'] ) {
			continue;
		}

		if ( 'private' === $definition['visibility'] && ! in_array( $call_site['file'], $definition['allowed_files'], true ) ) {
			continue; // Structurally uncallable from outside its own file (or, for a trait method, its consumer files).
		}

		$candidates[] = $call_site;
	}

	if ( empty( $candidates ) ) {
		$result        = array(
			'status'             => 'unknown',
			'problem_candidates' => array(),
			'reason'             => 'no caller found via static call-site search — may be a hook callback registered by name/array-callback, or genuinely unused code.',
		);
		$memo[ $name ] = $result;
		return $result;
	}

	$in_progress[ $name ] = true;

	$problem_candidates = array();
	$any_unknown        = false;

	foreach ( $candidates as $candidate ) {
		if ( $candidate['covered'] ) {
			continue; // Locally bracketed — definitely fine, no recursion needed.
		}

		$enclosing = $candidate['enclosing_fn_name'];

		if ( null === $enclosing ) {
			// Top-level code, not locally bracketed — there's no further
			// caller to check (top-level code isn't itself "invoked" the
			// way a function is), so this path is a definite gap.
			$problem_candidates[] = $candidate;
			continue;
		}

		$enclosing_result = godam_coverage_resolve_coverage( $enclosing, $definitions_by_name, $call_sites_by_name, $memo, $in_progress );

		if ( 'covered' === $enclosing_result['status'] ) {
			continue; // This call inherits coverage from its own always-bracketed caller.
		}

		if ( 'gap' === $enclosing_result['status'] ) {
			$problem_candidates[] = $candidate;
			continue;
		}

		$any_unknown = true;
	}

	unset( $in_progress[ $name ] );

	if ( ! empty( $problem_candidates ) ) {
		$result = array(
			'status'             => 'gap',
			'problem_candidates' => $problem_candidates,
			'reason'             => null,
		);
	} elseif ( $any_unknown ) {
		$result = array(
			'status'             => 'unknown',
			'problem_candidates' => array(),
			'reason'             => 'coverage depends on a caller this trace could not fully resolve — verify manually.',
		);
	} else {
		$result = array(
			'status'             => 'covered',
			'problem_candidates' => array(),
			'reason'             => null,
		);
	}

	$memo[ $name ] = $result;
	return $result;
}

/**
 * Recursively (with memoization and cycle-breaking) resolves every file a
 * private trait method defined in $trait_name could actually be called
 * from: every class that directly `use`s the trait, plus — for any such
 * consumer that is itself a trait — every file that transitively consumes
 * THAT trait too.
 *
 * Needed because trait composition genuinely nests: trait B can `use`
 * trait A, and class C can `use` trait B. A private method in A is
 * reachable from C, but C's file never appears in A's own direct
 * $trait_consumers entry — only B's file does. Resolving only one level
 * would miss C's file entirely, the same gap 'allowed_files' exists to
 * close for the single-level case. No multi-level trait usage exists in
 * this codebase today — this only guards against a future one.
 *
 * Same recursive/memoized/cycle-breaking shape as
 * godam_coverage_resolve_coverage() above (a different graph — trait-uses-
 * trait, not caller-calls-callee). A cycle breaks via $visiting,
 * contributing no further files for that edge, without infinite recursion.
 *
 * @param string $trait_name       Bare trait name to resolve.
 * @param array  $trait_consumers  Trait name => list of {class, file} — every file's own, direct (one-hop) consumers.
 * @param array  $is_trait_by_name Class/trait name => bool.
 * @param array  &$memo            trait name => fully-resolved file list. Shared across the whole trace; populated lazily.
 * @param array  &$visiting        Set (trait name => true) of names currently being resolved higher up the recursion stack.
 * @return string[] Every file (deduplicated) whose class could reach a method defined in $trait_name via `use`, directly or transitively.
 */
function godam_coverage_resolve_trait_consumer_files( $trait_name, $trait_consumers, $is_trait_by_name, &$memo, &$visiting ) {
	if ( isset( $memo[ $trait_name ] ) ) {
		return $memo[ $trait_name ];
	}

	if ( isset( $visiting[ $trait_name ] ) ) {
		return array(); // Cycle — contribute nothing further for this edge rather than recurse forever.
	}

	$visiting[ $trait_name ] = true;

	$files = array();
	foreach ( ( $trait_consumers[ $trait_name ] ?? array() ) as $consumer ) {
		$files[] = $consumer['file'];

		if ( ! empty( $is_trait_by_name[ $consumer['class'] ] ) ) {
			$files = array_merge( $files, godam_coverage_resolve_trait_consumer_files( $consumer['class'], $trait_consumers, $is_trait_by_name, $memo, $visiting ) );
		}
	}

	unset( $visiting[ $trait_name ] );

	$files               = array_values( array_unique( $files ) );
	$memo[ $trait_name ] = $files;
	return $files;
}

/**
 * Runs godam_coverage_resolve_coverage() for every parameter-sourced
 * finding's own enclosing function, and sorts the findings into the three
 * outcomes that function's 'status' can produce. Top-level-code findings
 * (fn_name === null) bypass the resolver entirely — top-level code is never
 * itself invoked the way a function is, so there's nothing to trace.
 *
 * @param array[] $parameter_sourced   Every parameter_sourced finding across all files, each already
 *                                     carrying 'file', 'line', 'call', 'scope', 'fn_name', 'class'.
 * @param array[] $call_sites          Every recorded call site across all files, each carrying
 *                                     'file', 'name', 'line', 'covered', 'method_style', 'scope',
 *                                     'enclosing_fn_name' (null for top-level code).
 * @param array[] $definitions_by_name Name => list of {file, class, visibility}, one entry per
 *                                     function/method definition sharing that bare name anywhere.
 * @return array{confirmed: array[], unverified: array[], transitively_covered: array[]}
 */
function godam_coverage_trace_callers( $parameter_sourced, $call_sites, $definitions_by_name ) {
	$call_sites_by_name = array();
	foreach ( $call_sites as $call_site ) {
		$call_sites_by_name[ $call_site['name'] ][] = $call_site;
	}

	$memo        = array();
	$in_progress = array();

	$confirmed            = array();
	$unverified           = array();
	$transitively_covered = array();

	foreach ( $parameter_sourced as $finding ) {
		if ( null === $finding['fn_name'] ) {
			$finding['reason_unverified'] = 'top-level code' === $finding['scope']
				? 'top-level code — coverage cannot be traced to a caller.'
				: 'an anonymous closure — nothing else can call it by name, so coverage cannot be traced to a caller; only WordPress itself, via whichever hook it\'s registered for, ever actually invokes it.';
			$unverified[]                 = $finding;
			continue;
		}

		$result = godam_coverage_resolve_coverage( $finding['fn_name'], $definitions_by_name, $call_sites_by_name, $memo, $in_progress );

		if ( 'covered' === $result['status'] ) {
			$transitively_covered[] = $finding;
		} elseif ( 'gap' === $result['status'] ) {
			$finding['uncovered_callers'] = $result['problem_candidates'];
			$confirmed[]                  = $finding;
		} else {
			$finding['reason_unverified'] = $result['reason'];
			$unverified[]                 = $finding;
		}
	}

	return array(
		'confirmed'            => $confirmed,
		'unverified'           => $unverified,
		'transitively_covered' => $transitively_covered,
	);
}

// --- Pass 1: tokenize every file once, find every function/method definition. ---
//
// 1a walks every file first to build two codebase-wide maps before any
// per-function work starts: which class/trait names are actually traits,
// and which files `use` each trait. Needed up front because a trait's
// consumers can be discovered in a file scanned AFTER the trait's own
// definition — 1b can't know a private trait method's real allowed files
// until every file has been looked at once.

$root  = dirname( __DIR__, 2 ); // Plugin root — this file lives two levels under it, in bin/hook-check/.
$files = godam_shared_list_all_php_files( $root );

$file_tokens            = array();
$file_classes           = array();
$is_trait_by_class_name = array();
$trait_consumers        = array(); // trait_name => list of {class, file} — every file's own, direct (one-hop) consumers.

foreach ( $files as $file ) {
	$tokens   = godam_shared_tokenize( $file );
	$relative = ltrim( str_replace( $root, '', $file ), DIRECTORY_SEPARATOR );
	$classes  = godam_shared_find_classes( $tokens );

	$file_tokens[ $relative ]  = $tokens;
	$file_classes[ $relative ] = $classes;

	foreach ( $classes as $class ) {
		$is_trait_by_class_name[ $class['name'] ] = $class['is_trait'];
	}

	foreach ( godam_shared_find_trait_uses( $tokens, $classes ) as $trait_name => $consumer_classes ) {
		foreach ( $consumer_classes as $consumer_class ) {
			$trait_consumers[ $trait_name ][] = array(
				'class' => $consumer_class,
				'file'  => $relative,
			);
		}
	}
}

// 1b: per-function definitions, now that trait consumership is fully known.
$file_functions             = array();
$file_bodyless_declarations = array();
$definitions_by_name        = array();
$trait_file_memo            = array();
$trait_file_visiting        = array();

foreach ( $file_tokens as $relative => $tokens ) {
	$bodyless                                = array();
	$functions                               = godam_coverage_find_functions( $tokens, $bodyless );
	$file_functions[ $relative ]             = $functions;
	$file_bodyless_declarations[ $relative ] = $bodyless;

	foreach ( $functions as $function ) {
		$allowed_files = array( $relative );

		if ( null !== $function['class'] && ! empty( $is_trait_by_class_name[ $function['class'] ] ) ) {
			// A private trait method is only reachable from whichever class
			// `use`s the trait, which can be a different file (and, when
			// composition nests, more than one hop away — see
			// godam_coverage_resolve_trait_consumer_files()). Widening
			// allowed_files to every consumer file is what lets a private
			// trait method's real callers be found at all.
			$consumer_files = godam_coverage_resolve_trait_consumer_files( $function['class'], $trait_consumers, $is_trait_by_class_name, $trait_file_memo, $trait_file_visiting );
			$allowed_files  = array_values( array_unique( array_merge( $allowed_files, $consumer_files ) ) );
		}

		$definitions_by_name[ $function['name'] ][] = array(
			'file'          => $relative,
			'class'         => $function['class'],
			'visibility'    => $function['visibility'],
			'allowed_files' => $allowed_files,
		);
	}
}

$known_call_targets = array_fill_keys( array_keys( $definitions_by_name ), true );

// --- Pass 2: coverage + call-site discovery, reusing the cached tokens. ---

$uncovered_findings = array(); // Keyed by file:line (or file:line:params — see below).
$parameter_sourced  = array(); // Flat list, each carrying its own 'file'.
$all_call_sites     = array(); // Flat list, each carrying its own 'file'.

foreach ( $file_tokens as $relative => $tokens ) {
	$result = godam_coverage_file_findings( $tokens, $file_functions[ $relative ], $known_call_targets, $file_bodyless_declarations[ $relative ] );

	foreach ( $result['uncovered'] as $finding ) {
		// A parameter-list finding gets a distinct ":params" key suffix so it
		// can't collide with a body-level finding on the same physical line —
		// routine for a compact one-liner like `function search( $query = new
		// WP_Query(...) ) { get_post_meta(...); }`.
		$key                        = ! empty( $finding['from_param_list'] ) ? "{$relative}:{$finding['line']}:params" : "{$relative}:{$finding['line']}";
		$uncovered_findings[ $key ] = array(
			'file'  => $relative,
			'line'  => $finding['line'],
			'call'  => $finding['call'],
			'scope' => $finding['scope'],
			'kind'  => FINDING_KIND_DIRECT,
		);
	}

	foreach ( $result['parameter_sourced'] as $finding ) {
		$finding['file']     = $relative;
		$parameter_sourced[] = $finding;
	}

	foreach ( $result['call_sites'] as $call_site ) {
		$call_site['file'] = $relative;
		$all_call_sites[]  = $call_site;
	}
}

// --- Pass 3: reconcile parameter-sourced findings via the recursive call-graph trace. ---

$traced = godam_coverage_trace_callers( $parameter_sourced, $all_call_sites, $definitions_by_name );

foreach ( $traced['confirmed'] as $finding ) {
	$key   = "{$finding['file']}:{$finding['line']}";
	$first = $finding['uncovered_callers'][0];

	$uncovered_findings[ $key ] = array(
		'file'         => $finding['file'],
		'line'         => $finding['line'],
		'call'         => $finding['call'],
		'scope'        => $finding['scope'],
		'kind'         => FINDING_KIND_CALLER_CONFIRMED,
		'caller_file'  => $first['file'],
		'caller_line'  => $first['line'],
		'caller_count' => count( $finding['uncovered_callers'] ),
	);
}

$unverified_findings = array();
foreach ( $traced['unverified'] as $finding ) {
	$key = "{$finding['file']}:{$finding['line']}";

	$unverified_findings[ $key ] = array(
		'file'   => $finding['file'],
		'line'   => $finding['line'],
		'call'   => $finding['call'],
		'scope'  => $finding['scope'],
		'kind'   => FINDING_KIND_UNVERIFIED,
		'detail' => $finding['reason_unverified'],
	);
}

ksort( $uncovered_findings );
ksort( $unverified_findings );

// The two dicts never share a key (a parameter_sourced finding is, by
// definition, excluded from the direct uncovered pass), so a plain array
// union keeps both without a collision risk to reason about.
$findings = $uncovered_findings + $unverified_findings;

// --- Pass 4: apply inline godam-coverage-ignore/disable/enable/ignore-file
// comments — checked once per file so a finding's own line is looked up in
// O(1) instead of re-scanning every file per finding. This is the *only*
// acceptance mechanism — there is no baseline file to fall back to. ---

$directives_by_file = array();
foreach ( $file_tokens as $relative => $tokens ) {
	$directives_by_file[ $relative ] = godam_shared_coverage_directives( $tokens );
}

// A disable with no matching enable is a hard error: left alone, it would
// silently suppress every finding for the rest of the file with no
// human-reviewed reason at all.
$dangling_disables = array();
foreach ( $directives_by_file as $relative => $directives ) {
	if ( null !== $directives['dangling_disable'] ) {
		$dangling_disables[ $relative ] = $directives['dangling_disable'];
	}
}

$directive_covered = array();
foreach ( $findings as $key => $finding ) {
	$directives = $directives_by_file[ $finding['file'] ] ?? null;
	if ( null === $directives ) {
		continue;
	}

	if ( null !== $directives['ignore_file'] ) {
		$directive_covered[ $key ] = $directives['ignore_file'];
		continue;
	}

	$reason = godam_shared_coverage_directive_covers( $directives, $finding['line'] );
	if ( null !== $reason ) {
		$directive_covered[ $key ] = $reason;
	}
}

$findings = array_diff_key( $findings, $directive_covered );

if ( ! empty( $dangling_disables ) ) {
	fwrite( STDERR, "DANGLING godam-coverage-disable — no matching godam-coverage-enable found\n" );
	fwrite( STDERR, "before end of file. This would otherwise silently suppress every finding\n" );
	fwrite( STDERR, "for the rest of the file with no reviewed reason at all:\n\n" );
	foreach ( $dangling_disables as $relative => $disable ) {
		fwrite( STDERR, " - {$relative}:{$disable['line']} -- {$disable['reason']}\n" );
	}
	fwrite( STDERR, "\nAdd a matching // godam-coverage-enable comment, or remove the disable if it's no longer needed.\n" );
	exit( 1 );
}

$direct     = array_filter(
	$findings,
	function ( $f ) {
		return FINDING_KIND_UNVERIFIED !== $f['kind'];
	}
);
$unverified = array_filter(
	$findings,
	function ( $f ) {
		return FINDING_KIND_UNVERIFIED === $f['kind'];
	}
);

echo 'Uncovered/unverified call sites: ' . count( $findings ) . "\n";
echo 'Auto-resolved as transitively covered (no action needed): ' . count( $traced['transitively_covered'] ) . "\n";
echo 'Suppressed via inline godam-coverage-ignore/disable/ignore-file comments: ' . count( $directive_covered ) . "\n\n";

$exit_code = 0;

if ( ! empty( $direct ) ) {
	$exit_code = 1;
	echo "CONFIRMED UNCOVERED ACCESS CALLS:\n";
	foreach ( $direct as $key => $finding ) {
		echo " - {$finding['file']}:{$finding['line']} in {$finding['scope']}: {$finding['call']}() runs with no\n";
		echo '   rtgodam_before_attachment_lookup open.';
		if ( FINDING_KIND_CALLER_CONFIRMED === $finding['kind'] ) {
			echo " Confirmed via a real caller: {$finding['caller_file']}:{$finding['caller_line']}\n";
			echo "   doesn't wrap this call either" . ( $finding['caller_count'] > 1 ? " ({$finding['caller_count']} uncovered callers total)" : '' ) . '.';
		}
		echo "\n   Add the hook pair around it, or if this call genuinely isn't attachment data\n";
		echo "   needing centralization, add a // godam-coverage-ignore -- reason comment (see\n";
		echo "   this script's own top-of-file comment for the exact syntax).\n\n";
	}
}

if ( ! empty( $unverified ) ) {
	$exit_code = 1;
	echo "UNVERIFIED PARAMETER-SOURCED CALLS (coverage depends on a caller this script\n";
	echo "couldn't confirm — needs a human to check, not a proven gap):\n";
	foreach ( $unverified as $key => $finding ) {
		echo " - {$finding['file']}:{$finding['line']} in {$finding['scope']}: {$finding['call']}() — {$finding['detail']}\n\n";
	}
}

if ( 0 !== $exit_code ) {
	echo "This script cannot prove a call site needs centralizing — see its own\n";
	echo "top-of-file comment for what it can and can't detect. A human still needs\n";
	echo "to read each finding above.\n";
	exit( $exit_code );
}

echo "No uncovered or unverified attachment-access call sites found.\n";
exit( 0 );
