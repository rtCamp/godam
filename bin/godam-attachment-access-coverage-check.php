<?php
/**
 * Coverage audit: finds every real call to one of the 12 tracked
 * attachment-access functions (get_post_meta, wp_get_attachment_url, etc.)
 * that has no rtgodam_before_attachment_lookup bracket open at that exact
 * point — one candidate per call site, not per file.
 *
 * The sibling godam-wp-dam-hook-check.php's own checks only catch a wrap
 * *regressing* (a per-file call count dropping) or an existing pair being
 * unbalanced. Neither answers "does every attachment-touching call site have
 * a wrap at all" — which matters because wp-dam (or any similar multisite
 * media centralization plugin) has no way to know GoDAM is about to
 * read/write attachment data unless GoDAM fires this hook pair around it; a
 * single missed spot is a live bug on a site using it, not just a lint nit.
 *
 * This also fully covers a narrower shape a separate, now-retired script
 * (godam-interprocedural-leak-check.php) used to check on its own: a
 * function that wraps its own attachment access correctly, called from
 * somewhere that then reads the result unwrapped. That's just one specific
 * way an access call can end up uncovered — this script catches it as a
 * natural side effect of checking *every* access call's coverage directly,
 * without needing to first match a call site back to a specific named
 * function the way the retired script had to (which is also why that
 * script needed class-resolution logic — Foo::method() vs $this->method()
 * — that has no equivalent problem to solve here at all).
 *
 * Shares its tokenizer, function-boundary finder, and hook-fire/
 * scope-terminator detection with the sibling godam-wp-dam-hook-check.php via
 * godam-hook-check-shared.php — see that file's own top-of-file comment for
 * why (a real HOOK_FIRE_FUNCTIONS drift bug between the two scripts, found
 * during review, is what prompted extracting it). The branch-aware
 * before/after balance walk it provides (checkpoint-per-'{',
 * rewind-on-scope-terminator) is exactly what "is a before open right here"
 * needs — a before opened at the top of a function, closed early in one
 * guard clause and again at the normal exit, must still read as "open" for
 * an access call that sits between the guard clauses and the final close,
 * on the path where neither guard fired.
 *
 * On top of that walk, this script also watches every real access-function
 * call: if nothing is open at that point, it's a candidate — unless the
 * call's first argument is provably safe (godam_coverage_assignment_at()):
 * one of the enclosing function's own parameters, a plain unmodified alias
 * of one, or a cast/single-argument sanitizing call of one that hasn't since
 * been reassigned to anything else — reassigned including via `list()` /
 * `[...]` destructuring (godam_coverage_destructuring_targets_at()), which
 * always revokes safety rather than ever preserving it, since a destructured
 * value is always freshly derived from whatever the right-hand side
 * returned.
 *
 * That "parameter is safe" case used to be silently excluded from every
 * finding: a safe value's data predates anything the enclosing function
 * itself did, so it might already have been centralized by whichever caller
 * passed it in, and the tool had no way to check. That silence was a real,
 * confirmed false-negative source in practice — a full manual recursive
 * audit of this exact codebase (2026-08) found 14 genuine gaps this way,
 * every one invisible to `check` because the enclosing function's own
 * parameter carried the ID. This script no longer drops those findings:
 * every parameter-sourced call is now reported under its own PARAMETER_SOURCED
 * kind (see FINDING_KIND_* below) unless godam_coverage_trace_callers() below
 * can already resolve it automatically — see godam_coverage_resolve_coverage()'s
 * own comment for the recursive, arbitrary-depth call-graph trace (not just
 * one or two hops — a genuine 3-hop false negative was found and fixed
 * before this was considered done) and exactly how conservative it is about
 * doing so (only for a codebase-wide-unique function/method name, so a
 * same-named method in an unrelated class can never be mistaken for the one
 * actually being checked).
 *
 * A clean run means "no new uncovered or unverified-parameter-sourced call
 * sites since the last accepted baseline" — not "every access here is
 * correctly centralized." Every candidate needs a human to read the
 * surrounding code and either add the hook, or record why it's fine as-is.
 *
 * Scans the entire plugin root (godam_shared_list_all_php_files()) rather
 * than an explicit list of directories — see GODAM_EXCLUDED_ROOT_DIRS's own
 * comment in godam-hook-check-shared.php for why an include-list was itself
 * a real, confirmed blind spot (lib/ and the plugin-root files were invisible
 * to this script until a manual audit found them).
 *
 * Two modes, same convention as godam-wp-dam-hook-check.php:
 *   php bin/godam-attachment-access-coverage-check.php check
 *   php bin/godam-attachment-access-coverage-check.php update-baseline
 *
 * @package GoDAM
 */

// phpcs:disable WordPress.WP.AlternativeFunctions, WordPress.Security.EscapeOutput, WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_file_put_contents, WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_fwrite -- CLI script, no WP bootstrap, no browser output, no VIP filesystem restrictions (reads/writes its own baseline file and STDERR only).

require_once __DIR__ . '/godam-hook-check-shared.php';

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

/**
 * Finding kinds, in the exact order the "why does this need a reason" story
 * gets harder to argue with — used both for the printed report's grouping
 * and as the 'kind' field persisted into the baseline.
 */
const FINDING_KIND_DIRECT           = 'direct'; // No open bracket, non-parameter argument. The original, unambiguous case.
const FINDING_KIND_CALLER_CONFIRMED = 'caller_confirmed'; // Parameter-sourced, but a real caller of the enclosing function is itself uncovered — see godam_coverage_trace_callers().
const FINDING_KIND_UNVERIFIED       = 'unverified'; // Parameter-sourced; tracing couldn't prove it either way (no caller found, or the name isn't unique enough to trust).

$root          = dirname( __DIR__ ); // Plugin root.
$baseline_path = __DIR__ . '/godam-attachment-access-coverage-baseline.json';
$run_mode      = $argv[1] ?? 'check';

/**
 * If the token at $i starts a real, BARE (not method-style, not a same-named
 * declaration — godam_shared_is_bare_call_to()) call to one of
 * ACCESS_FUNCTIONS, returns ['name' => function name, 'arg' => unprefixed
 * first-argument variable name, or '' if the first argument isn't a plain
 * variable]. Returns null if $i isn't an access-function call at all.
 *
 * Uses godam_shared_is_bare_call_to() (rather than plain godam_shared_is_call_to())
 * for the same reason godam_shared_is_hook_fire_at()/
 * godam_shared_is_scope_terminator() use it: every ACCESS_FUNCTIONS name is a
 * WordPress core global, never legitimately called via ->/::, so this only
 * excludes the pathological case of a same-named user-defined method or
 * declaration — no confirmed collision in this codebase today, but the same
 * class of risk as the get_posts()/get_children() collision this mirrors.
 * 'name' is run through godam_shared_unqualified_name() so a qualified call
 * (`\get_post_meta(...)`) reports as "get_post_meta()" rather than leaking
 * its leading backslash into the printed finding — cosmetic only, since
 * baseline matching keys on file:line, never on this field.
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
 * real assignment — '==', '+=', etc. are their own distinct multi-character
 * tokens, never text "="), returns ['target' => name, 'safe_copy_of' =>
 * name|null]. 'safe_copy_of' is a name currently in the caller's safe set
 * only for two shapes, both immediately followed by ';' with nothing else:
 * a bare copy of another variable ($x = $y;), or $target reassigned to a
 * cast or single-argument function call of *itself* ($id = absint($id);,
 * $id = (int) $id;) — sanitizing or casting a value doesn't introduce new,
 * external data, so it shouldn't cost the value its safety. That second
 * shape was added only after the first version (bare-copy detection only)
 * ran against the real codebase (not just planted cases): 22+ instances of
 * exactly this self-sanitizing pattern turned into false positives the
 * narrower version didn't handle — the same "test before trusting
 * it" step this whole project has relied on throughout. Anything else on
 * the right gets 'safe_copy_of' => null. Returns null entirely if $i isn't
 * an assignment target at all.
 *
 * Deliberately does NOT handle `list( $target, ... ) = ...` or
 * `[ $target, ... ] = ...` — those are a different assignment shape entirely,
 * detected separately by godam_coverage_destructuring_targets_at(), because
 * a destructured value is never a "bare copy" the way this function checks
 * for; it's always freshly derived from whatever the right-hand side
 * returned, so it should always revoke safety, never preserve it.
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

	// Shape 3: a single-argument function call of itself, e.g. $target =
	// absint( $target ) — bare, or qualified (\absint( $target ), matching
	// the same T_STRING/T_NAME_FULLY_QUALIFIED/T_NAME_QUALIFIED widening
	// godam_shared_is_call_to() got; this check doesn't compare against a
	// name list at all (any self-transforming single-arg call preserves
	// safety, regardless of which function), so it only needs to accept the
	// extra token types, not also call godam_shared_unqualified_name(). A
	// qualified self-cast used to fall through to "anything else" below and
	// wrongly revoke safety — confirmed via a synthetic fixture: `$id =
	// \absint( $id ); get_post_meta( $id, ... );` was reported as a
	// confirmed, unambiguous gap, while the byte-identical bare-call version
	// correctly landed in the softer "unverified, no caller found" bucket —
	// same code, different (more alarming) classification purely because of
	// the leading backslash.
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
 * of every variable named directly inside it — each one is always being
 * freshly assigned from whatever the right-hand side returns, so every name
 * returned here should have its safety revoked, never preserved, regardless
 * of what it held before.
 *
 * The `[` case is scoped to statement-start position (immediately after
 * `;`, `{`, `}`, or as the first token in range) specifically so an ordinary
 * array literal or a `$arr[0]` subscript access isn't mistaken for a
 * destructuring target — neither of those ever appears in that position.
 * Nested destructuring (`list( $a, list( $b, $c ) ) = ...`) only recognizes
 * the outer level's own direct variables; the inner list's own variables
 * are missed — an accepted, narrow gap for a rare shape, not silently
 * unhandled by mistake.
 *
 * The statement-start check for `[` only sees real, reliable backward
 * context for the common case — inside a function/method body, where
 * $tokens is always this file's complete, untouched token list. The one
 * place that isn't true: godam_coverage_file_findings()'s top-level-code
 * pass builds a separate, reindexed token list with every function/method
 * body already cut out of it, so a `[...] = ` that is itself the very
 * first top-level statement after a function/method definition sees
 * whatever real top-level token preceded that definition (e.g. a `)` from
 * its parameter list) rather than a `}` — and is wrongly read as not being
 * statement-start, so its targets are missed. Narrow and, in a WordPress
 * plugin, unlikely (real top-level code here is almost always
 * `add_action()`/`require` calls, not destructuring) — worth knowing about,
 * not worth the redesign a full fix would need.
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
 * Finds named function/method declarations plus parameter names — thin
 * wrapper around the shared finder for naming continuity with this file's
 * own history; kept as its own function in case coverage-specific function
 * metadata is ever needed here without affecting the sibling script.
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
 * godam-wp-dam-hook-check.php's godam_check_hook_balance_in_range() (same
 * checkpoint-per-'{', rewind-on-scope-terminator algorithm — see this file's
 * own top-of-file comment for why that's required here too), and
 * additionally records every access-function call found with nothing open
 * at that point, split into 'uncovered' (a non-parameter argument — the
 * original, unambiguous case) and 'parameter_sourced' (the argument is one
 * of the enclosing scope's own parameters, or a traceable alias of one —
 * see godam_coverage_assignment_at()'s docblock).
 *
 * Also records, in 'call_sites', every real call to a name present in
 * $known_call_targets (the codebase-wide set of function/method names
 * godam_coverage_trace_callers() might need to trace a parameter_sourced
 * finding back to its own callers), together with whether a before/after
 * bracket was open at that exact call site. This reuses the same walk
 * rather than re-tokenizing/re-walking the file a second time purely for
 * call-site discovery.
 *
 * The set of "safe" variable names starts from the enclosing scope's own
 * parameters and evolves alongside the scan: a plain, unmodified copy of a
 * currently-safe variable ($new = $existing_safe_var;) extends safety to
 * the new name; any other reassignment of a currently-safe variable
 * (including one holding an access-call's fresh result, or one reassigned
 * via `list()`/`[...]` destructuring) revokes it. This is a simple linear
 * scan with no branch-awareness for the *safe-variable* tracking
 * specifically (separate from the before/after balance tracking above,
 * which *is* branch-aware) — a variable's safety isn't reset or restored
 * per if/else branch. A deliberate simplification, not an oversight: adding
 * that would mean tracking a separate safe-set per branch and merging them
 * back at each join point, real complexity for a pattern (a value's safety
 * differing across branches at the exact point of an access call) that
 * hasn't shown up as a real false positive or false negative in this
 * codebase.
 *
 * @param array[] $tokens             Full token list for the file.
 * @param int     $range_start        Token index to start at (inclusive).
 * @param int     $range_end          Token index to end at (inclusive).
 * @param array   $params             Enclosing function's own parameter names (empty for top-level code).
 * @param array   $known_call_targets Set (name => true) of function/method names worth recording call sites for.
 * @param array[] $skip_ranges        Each [start, end] (inclusive token indexes) to jump straight
 *                                    past rather than walk — deferred closures (add_action()/
 *                                    add_filter() callbacks) nested directly inside this range, which
 *                                    godam_coverage_file_findings() walks separately, as their own
 *                                    independent scope with their own params and a fresh bracket
 *                                    state, precisely so they do NOT inherit whatever before/after
 *                                    state happens to be open in the function that merely DEFINES
 *                                    them — see godam_shared_find_deferred_closures()'s own comment
 *                                    for why a closure registered this way can run at a completely
 *                                    different time than its defining function.
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
			// entered — see godam_check_hook_balance_in_range()'s docblock
			// for the full reasoning (guard clauses closing an outer before()
			// early). That script is the one responsible for flagging an
			// actual imbalance; this one only cares whether access calls are
			// covered, so it always rewinds unconditionally rather than also
			// checking for the over-open case.
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

				// A function's own declaration ("function name(" or, for a
				// return-by-reference function, "function &name(") reads
				// identically to a genuine call to a same-named function —
				// both are a T_STRING immediately followed by '(' — but it
				// isn't one. For a method this was already harmless: a
				// declaration is never preceded by ->/::, so it already
				// failed the method_style check below and was effectively
				// inert wherever method-shaped call sites are consumed. For a
				// FREE function there's no such filter — godam_coverage_resolve_coverage()
				// accepts any bare (non-method_style) match — so without this
				// exclusion, a free function's own declaration line was
				// itself recorded as an uncovered "call site" to itself.
				// Since a declaration sits before its own body_start (outside
				// [body_start, body_end]), that fake call site always
				// resolved with enclosing_fn_name = null ("top-level,
				// unbracketed"), which the resolver treats as a definite,
				// unrecoverable gap — so every free function with a
				// parameter-sourced finding of its own always resolved as a
				// confirmed gap, regardless of how its real callers actually
				// wrapped it. Confirmed live via a minimal fixture (a free
				// function correctly wrapped by its only real caller was
				// still reported as a confirmed gap, "via" its own
				// declaration line) before this exclusion was added. Uses the
				// shared godam_shared_is_function_declaration_at() rather than
				// its own inline check so this and godam_shared_is_bare_call_to()'s
				// identical need (get_posts()/get_children() vs. a real,
				// same-named user-defined method's own declaration) can't
				// drift into two different definitions of the same rule.
				//
				// Also excludes a `new ClassName(` instantiation: a class and
				// a free function can share the exact same bare name (they
				// live in separate PHP symbol tables even without namespaces),
				// and `known_call_targets` is keyed purely by that bare text —
				// so `new Helper()` was indistinguishable from a genuine call
				// to a free function ALSO named Helper. Confirmed as a real,
				// silent bug via a synthetic fixture: an unrelated `new
				// Helper()` (in, of all places, another function's own "new in
				// initializers" default value) got recorded as a fake call
				// site to the free function Helper(), and since that call
				// site's own enclosing function happened to always be invoked
				// under a bracket, godam_coverage_resolve_coverage() resolved
				// Helper()'s real, otherwise-untraceable parameter-sourced
				// finding as "transitively covered" — silently dropping it,
				// via a caller relationship that was never real.
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
 * function's own parameter list (see the params_open/params_close comment
 * below), once per named function body (with its own parameters), once per
 * deferred closure (add_action()/add_filter() callback — see
 * godam_shared_find_deferred_closures()), plus once more across whatever
 * top-level code (file scope, outside any function/closure or parameter
 * list) remains — concatenated in file order, same reasoning as
 * godam-wp-dam-hook-check.php's own godam_check_hook_balance_findings().
 *
 * A deferred closure is excluded from whichever named function or top-level
 * range would otherwise physically contain it, and walked as its own
 * independent scope instead, starting from an empty bracket state and its
 * own parameter list — never inheriting the enclosing function's params or
 * whatever before/after state happens to be open there. That's the whole
 * point: the closure can run at a completely different time (whenever its
 * hook actually fires) than the function that merely defines it, so
 * treating it as covered purely because it's lexically positioned between a
 * before()/after() pair in the defining function would be wrong. A
 * parameter-sourced finding inside a deferred closure is reported with
 * fn_name = null (like top-level code) rather than traced to a caller: an
 * anonymous closure has no name anything else could call it by, so there's
 * nothing to trace — WordPress itself is the only real "caller," via
 * whatever fires the hook it's registered for.
 *
 * A function's own parameter list is walked as a SEPARATE, independently
 * scoped range from its body — never merged into the same
 * godam_coverage_check_range() call — specifically for a PHP 8.1+ "new in
 * initializers" default value: `function search( $query = new WP_Query(
 * ... ) )`. That query call sits textually before body_start, so without
 * tracking it at all it would fall through to "top-level code" (a real,
 * confirmed mislabeling — the finding still surfaced, just attributed to
 * the wrong scope). The naive-seeming fix — just widening body_start to
 * also cover the parameter list, one walk instead of two — was tried and
 * confirmed unsafe: `$query = new WP_Query(...)` is itself shaped exactly
 * like a real assignment, so godam_coverage_assignment_at() misreads it as
 * one and wrongly revokes $query's safety for the REST of the function
 * body, escalating a legitimate get_post_meta( $query ) from
 * parameter_sourced to a hard, unconditional "uncovered" finding. Two
 * independent godam_coverage_check_range() calls (this one starting from
 * empty params — a default value can never legally reference any variable,
 * not even an earlier parameter, so there's nothing to seed safety with)
 * share no mutable state, so they can't interfere with each other by
 * construction, not by luck. Findings from both calls are merged under the
 * SAME scope label. Deliberately NOT extended to a deferred closure's own
 * parameter list — closures registered via add_action()/add_filter() could
 * technically have this same shape, but it's a rarer compound case than the
 * already-rare named-function one, and leaving it alone has the same
 * "mislabeled, not lost" failure mode this comment describes, not a silent
 * miss.
 *
 * Every uncovered/parameter_sourced entry from the parameter-list walk
 * carries 'from_param_list' => true (absent — treat as false — from the
 * body walk and everywhere else). This exists because the caller
 * (Pass 2, in this file's own main script body) keys findings by
 * "{file}:{line}" for baseline acceptance, and a compact one-line function
 * — `function search( $query = new WP_Query(...) ) { get_post_meta(...); }`
 * — puts the parameter-list default and a genuine body call on the exact
 * same physical line. Confirmed as a real bug via a synthetic fixture
 * before this flag was added: the two, entirely distinct findings collided
 * on one key and only the body one survived, the param-list one silently
 * dropped — exactly the failure mode the whole point of walking these two
 * ranges independently was supposed to avoid. The flag lets the caller
 * disambiguate the two without changing the key format for every other
 * finding (a same-line collision between two ordinary body-level calls is a
 * separate, pre-existing characteristic of this key scheme, not something
 * introduced here, and not fixed by this flag).
 *
 * $bodyless_declarations (godam_shared_find_functions()'s own by-reference
 * output) gets the exact same parameter-list treatment as $functions —
 * excluded from "top-level code," excluded from every OTHER scope's own
 * skip_ranges, walked independently and merged under its own scope label —
 * for an interface/abstract method's "new in initializers" default value.
 * Its own parameter-sourced findings (structurally near-impossible in
 * practice — PHP only allows `new ClassName(...)`-shaped default values, and
 * nothing about that shape can produce a parameter_sourced result — but
 * handled correctly regardless) get fn_name = null, the same as top-level
 * code and deferred closures: a bodyless declaration is deliberately never
 * added to $definitions_by_name (see godam_shared_find_functions()'s own
 * docblock — doing so would give a name a second "definition," breaking the
 * codebase-wide-uniqueness check a concrete implementation of the same name
 * elsewhere depends on for auto-resolution), so there is no safe way to
 * trace it as a caller/callee here either.
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
	// (interface/abstract) declaration's own parameter-list range,
	// represented the same way $functions/$deferred_closures entries are
	// (body_start/body_end) so godam_shared_ranges_nested_in() can treat
	// them identically — see the docblock above for why these ranges are
	// tracked and walked separately.
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

	// Combines three independent exclusions into one $skip_ranges list for a
	// given range's own walk: (a) any deferred closure nested inside it
	// (walked separately below, own bracket state/params — see
	// godam_shared_find_deferred_closures()'s own comment), (b) any OTHER
	// named function/method nested inside it (walked separately in its own
	// foreach below too), and (c) any function's own parameter-list range
	// nested inside it (walked separately below too — see this function's
	// own docblock for why). (b) and (c) both matter now that function
	// ranges can genuinely nest — a method inside a function-scoped
	// anonymous class sits inside its enclosing function's own
	// [body_start, body_end] range (see godam_shared_find_functions()'s own
	// comment on why the old jump-past-body optimization was removed) — and
	// without excluding them here, the outer function's own walk would
	// re-scan the nested method's tokens (including, for (c) specifically,
	// the nested method's OWN parameter-list default value) a second time
	// under the OUTER function's params/bracket state, on top of the nested
	// scope's own separate, correct walk. (b) was confirmed as a real bug
	// via a synthetic fixture: a get_post_meta() call inside such a nested
	// method was reported twice — once correctly, once under the outer
	// function's scope — and since both findings shared the same file:line
	// key, the WRONG one (the outer function's) silently won the final
	// merge, permanently masking whatever the nested method's own,
	// potentially-correct resolution would have been. (c) is the exact same
	// risk, just for a nested function's parameter-list default value
	// instead of its body. godam_shared_ranges_nested_in() already carries
	// the same self-match exclusion the closure case needed (a range placed
	// in its own candidate list, as $functions/$param_list_ranges are here,
	// would otherwise trivially match itself).
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
		// params/safe_vars — see this function's own docblock) so a "new in
		// initializers" default value is found and attributed to this same
		// scope, without the walk sharing any mutable state with the body
		// walk above.
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

	// Every bodyless (interface/abstract) declaration's own parameter list —
	// same independent, empty-params walk as a regular function's parameter
	// list above, for the identical "new in initializers" reason (see this
	// function's own docblock). fn_name is always null here: a bodyless
	// declaration is deliberately never added to $definitions_by_name (see
	// godam_shared_find_functions()'s own docblock), so there's no safe name
	// to trace a parameter-sourced finding through even in the
	// near-impossible case one occurs.
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
 * Recursively (with memoization and cycle-breaking) determines whether every
 * real invocation of a codebase-wide-uniquely-named function/method is
 * guaranteed to happen with a rtgodam_before_attachment_lookup bracket
 * already open — either because the call site itself is locally bracketed,
 * or because the call site sits inside ANOTHER function that is itself
 * always invoked under a bracket, arbitrarily many levels deep.
 *
 * This is what makes the trace correct for an ARBITRARY number of hops,
 * not just one or two: the recursion never asks "does this function touch
 * attachment data" — only "how is this exact function invoked." That
 * distinction is what an earlier, iterative version of this got wrong. That
 * version only treated a function as a possible link in the chain if it had
 * an attachment-access call of ITS OWN (i.e. it appeared as the enclosing
 * scope of some other parameter-sourced finding) — so a PURE forwarding
 * function (one that only calls another function, with no
 * get_post_meta()-style call anywhere in its own body) could never be
 * resolved as "itself always covered," and any deeper call reached through
 * it was wrongly reported as a confirmed gap. Confirmed with a synthetic
 * 3-hop fixture (entrypoint() [bracketed] → hop_one() [pure forwarder] →
 * hop_two() [pure forwarder] → hop_three() [the real get_post_meta() call])
 * before this recursive version replaced the iterative one — the iterative
 * version reported hop_three() as a confirmed gap; this one correctly
 * resolves it as covered, and continues to do so regardless of how many
 * pure-forwarding hops sit in between.
 *
 * Also naturally handles the earlier real false positive that first
 * motivated going beyond one hop at all
 * (RTGODAM_Transcoder_Handler::wp_media_transcoding(), reached via
 * Transcoding::retranscode_media_centralized(), itself only covered by ITS
 * OWN caller's bracket) — that shape is just a 2-hop instance of the same
 * general recursion, not a separately-handled special case.
 *
 * Deliberately conservative in one specific way, independent of chain depth:
 * a name is only ever resolved automatically when it's unique across the
 * *entire* codebase (exactly one function/method definition anywhere). A
 * same-named method on an unrelated class is common in a WordPress plugin
 * (render(), get_instance(), setup_hooks() all recur constantly here) and a
 * text-level call-site search has no type information to tell "a call to
 * ClassA::render()" apart from "a call to ClassB::render()" — so tracing
 * would risk resolving a genuine gap in ClassA using ClassB's unrelated,
 * already-covered callers. Rather than guess, an ambiguous name resolves to
 * 'unknown', for a human to check — confirmed with a second synthetic
 * fixture (two unrelated classes, each with its own private render(), one
 * covered and one not) that this refuses to resolve *either* one rather than
 * risk conflating them. This mirrors this whole codebase's established
 * stance on every other heuristic here (godam_coverage_assignment_at() et
 * al.) — exclude rather than over-claim confidence.
 *
 * For a name that *is* unique, call sites are further filtered to the shape
 * that name's definition could actually be called through:
 *   - `private` method: only `$this->name(`/`self::name(`/`static::name(`
 *     call sites, and only within one of the definition's own
 *     'allowed_files' — ordinarily just the defining file itself, since a
 *     private method is structurally uncallable from anywhere else (a
 *     same-text match in a different file would have to be a different,
 *     coincidental symbol, not a real call) — but widened to every file
 *     that `use`s the trait when the method is defined INSIDE a trait
 *     rather than a plain class: a private trait method is only reachable
 *     from within whichever class consumes the trait, which can live in a
 *     completely different file than the trait's own definition (see the
 *     'allowed_files' computation in Pass 1 below).
 *   - non-private method (public/protected, or no modifier — implicitly
 *     public): any `->name(`/`::name(` call site, anywhere.
 *   - free function (no enclosing class): any bare `name(` call site
 *     (never preceded by `->`/`::`), anywhere.
 *
 * Cycles (F reachable from G reachable from F, directly or through more
 * hops) are broken via $in_progress rather than infinite-recursing: hitting
 * a name already being resolved higher up the same call stack returns
 * 'unknown' for that specific edge WITHOUT memoizing it, so the surrounding
 * resolution can still finish (and get memoized) using whatever its other,
 * non-cyclic call sites determine. A real, all-cyclic-with-nothing-else
 * codebase shape would settle on 'unknown' for everyone involved — safe,
 * not a crash, not a guess — but this is expected to be rare in practice;
 * WordPress hook callbacks and REST routes are the actual entry points here,
 * not functions calling each other in a loop.
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
 * from: every class that directly `use`s the trait, PLUS — for any such
 * consumer that is itself a trait rather than a plain class — every file
 * that (transitively, arbitrarily many levels deep) eventually consumes THAT
 * trait too.
 *
 * Needed because trait composition genuinely nests: trait B can `use` trait
 * A, and a plain class C can then `use` trait B. A private method defined in
 * A is reachable from C, but C's file never appears in A's own direct
 * $trait_consumers entry — only B's file does, since B is the one that
 * textually `use`s A. Resolving only one level (the previous behavior) would
 * miss C's file entirely for a method defined in A — the same class of gap
 * the whole 'allowed_files' mechanism exists to close for the single-level
 * case. No multi-level trait usage exists in this codebase today (verified
 * via grep) — this only guards against a future one.
 *
 * Same recursive/memoized/cycle-breaking shape as
 * godam_coverage_resolve_coverage() above (a different graph — trait-uses-
 * trait, not caller-calls-callee — but the same underlying reason a plain
 * one-hop or fixed-depth check isn't enough: composition can nest
 * arbitrarily deep). A cycle (trait A using trait B using trait A — invalid
 * PHP, but defended against anyway rather than assumed away) breaks via
 * $visiting and contributes no further files for that specific edge, without
 * infinite recursion.
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

/**
 * Human-reviewed reasons for findings accepted into the baseline, keyed the
 * same way as $findings. Merged into the baseline on every
 * `update-baseline` run so the *why* survives regeneration. Add an entry
 * here — not directly in the baseline JSON — when accepting a new finding
 * as reviewed-and-fine. Applies to every finding kind (direct,
 * caller_confirmed, unverified) — a transitively_covered resolution is the
 * one kind that never needs an entry here, since the tool proved it safe on
 * its own.
 *
 * @return array<string, string>
 */
function godam_coverage_known_reasons() {
	return array();
}

// --- Pass 1: tokenize every file once, find every function/method definition. ---
//
// 1a walks every file first to build two codebase-wide, cross-file maps
// before any per-function work starts: which class/trait names are
// actually traits (godam_shared_find_classes()'s 'is_trait'), and which
// files `use` each trait. Needed up front because a trait's consumers can
// be discovered in a file scanned AFTER the trait's own definition — 1b
// can't know a private trait method's real allowed files until every file
// has been looked at once.

$root  = dirname( __DIR__ );
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
			// A private method defined in a trait is only ever reachable
			// from within whichever class actually `use`s that trait — which
			// can live in a completely different file than the trait's own
			// definition, and, when trait composition nests (a trait using
			// another trait), can be more than one hop away — see
			// godam_coverage_resolve_trait_consumer_files()'s own comment.
			// Widening allowed_files to every (transitive) consumer file is
			// what lets a private trait method's real callers be found at
			// all; comparing only against the trait's own file (the
			// original behavior) would always report "no caller found" for
			// a private trait method genuinely called from its consumer
			// class, an auto-resolution this tool could have made but
			// silently didn't.
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
		// A parameter-list finding (see godam_coverage_file_findings()'s own
		// docblock on 'from_param_list') gets a distinct ":params" key
		// suffix, so it can never collide with — and silently lose to — a
		// body-level finding that happens to sit on the exact same physical
		// line, which a compact one-line function makes routine: `function
		// search( $query = new WP_Query(...) ) { get_post_meta(...); }`.
		// Confirmed as a real bug via a synthetic fixture before this
		// suffix was added — exactly this shape reported only 1 finding
		// where 2 genuinely distinct ones exist.
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

if ( 'update-baseline' === $run_mode ) {
	// Only a finding with an ACTUAL reviewed reason on file gets accepted —
	// this is the whole point of the baseline: a finding with no reason must
	// NOT appear in 'accepted' at all, so 'check' keeps failing on it until a
	// human either fixes the code or adds a real reason here.
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
		'generated_note' => 'Generated by bin/godam-attachment-access-coverage-check.php update-baseline. A finding only enters "accepted" if godam_coverage_known_reasons() already has a reason for it — this command does not review anything on its own. Findings with no reason stay failing in "check" mode. transitively_covered resolutions never appear here at all — see godam_coverage_trace_callers()\'s own comment.',
		'accepted'       => $accepted,
	);

	file_put_contents( $baseline_path, json_encode( $baseline, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) . "\n" );
	echo "Baseline written to {$baseline_path}.\n";
	echo 'Uncovered/unverified call sites found: ' . count( $findings ) . ', accepted (reviewed, with a reason on file): ' . count( $accepted ) . "\n";
	echo 'Auto-resolved as transitively covered (no reason needed): ' . count( $traced['transitively_covered'] ) . "\n";

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

$new_findings   = array_diff_key( $findings, $accepted_findings );
$new_direct     = array_filter(
	$new_findings,
	function ( $f ) {
		return FINDING_KIND_UNVERIFIED !== $f['kind'];
	} 
);
$new_unverified = array_filter(
	$new_findings,
	function ( $f ) {
		return FINDING_KIND_UNVERIFIED === $f['kind'];
	} 
);

echo 'Uncovered/unverified call sites tracked: ' . count( $findings ) . ' (' . count( $accepted_findings ) . " previously accepted)\n";
echo 'Auto-resolved as transitively covered this run (no action needed): ' . count( $traced['transitively_covered'] ) . "\n\n";

$exit_code = 0;

if ( ! empty( $new_direct ) ) {
	$exit_code = 1;
	echo "NEW CONFIRMED UNCOVERED ACCESS CALLS (not in the accepted baseline):\n";
	foreach ( $new_direct as $key => $finding ) {
		echo " - {$finding['file']}:{$finding['line']} in {$finding['scope']}: {$finding['call']}() runs with no\n";
		echo '   rtgodam_before_attachment_lookup open.';
		if ( FINDING_KIND_CALLER_CONFIRMED === $finding['kind'] ) {
			echo " Confirmed via a real caller: {$finding['caller_file']}:{$finding['caller_line']}\n";
			echo "   doesn't wrap this call either" . ( $finding['caller_count'] > 1 ? " ({$finding['caller_count']} uncovered callers total)" : '' ) . '.';
		}
		echo "\n   Add the hook pair around it, or if this call genuinely isn't attachment data\n";
		echo "   needing centralization, run 'update-baseline' after confirming why (see this\n";
		echo "   script's own top-of-file comment for the exclusion rules).\n\n";
	}
}

if ( ! empty( $new_unverified ) ) {
	$exit_code = 1;
	echo "NEW UNVERIFIED PARAMETER-SOURCED CALLS (coverage depends on a caller this script\n";
	echo "couldn't confirm — needs a human to check, not a proven gap):\n";
	foreach ( $new_unverified as $key => $finding ) {
		echo " - {$finding['file']}:{$finding['line']} in {$finding['scope']}: {$finding['call']}() — {$finding['detail']}\n\n";
	}
}

if ( 0 !== $exit_code ) {
	echo "This script cannot prove a call site needs centralizing — see its own\n";
	echo "top-of-file comment for what it can and can't detect. A human still needs\n";
	echo "to read each finding above.\n";
	exit( $exit_code );
}

echo "No new uncovered or unverified attachment-access call sites since the last accepted baseline.\n";
exit( 0 );
