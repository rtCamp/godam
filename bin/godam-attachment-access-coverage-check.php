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
 * returned. That exclusion is deliberately permissive: a safe value's data
 * predates anything this function itself did, so it might already have been
 * centralized by whichever caller passed it in, or it might genuinely not be
 * an attachment ID at all — this script can't tell locally, so it excludes
 * rather than over-flags. That's a real false-negative source (a caller that
 * does NOT wrap the call, passing a genuine attachment ID straight through,
 * would be wrongly excluded here) — an accepted tradeoff, not an oversight.
 *
 * A clean run means "no new uncovered call sites since the last accepted
 * baseline" — not "every access here is correctly centralized." Every
 * candidate needs a human to read the surrounding code and either add the
 * hook or record why it's fine as-is.
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

$root          = dirname( __DIR__ ); // Plugin root.
$baseline_path = __DIR__ . '/godam-attachment-access-coverage-baseline.json';
$run_mode      = $argv[1] ?? 'check';

$scan_roots = array(
	$root . '/inc',
	$root . '/admin',
	$root . '/assets/src/blocks',
);

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
	if ( ! godam_shared_is_call_to( $tokens, $i, ACCESS_FUNCTIONS, $count ) ) {
		return null;
	}

	$name = $tokens[ $i ]['text'];
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

	// Shape 3: a single-argument function call of itself, e.g. $target = absint( $target ).
	if ( $rhs < $count && T_STRING === ( $tokens[ $rhs ]['id'] ?? null ) ) {
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
 * @param array[] $tokens Normalized tokens from godam_shared_tokenize().
 * @return array[] Each: name, params (string[]), body_start, body_end.
 */
function godam_coverage_find_functions( $tokens ) {
	return godam_shared_find_functions( $tokens );
}

/**
 * Walks a token range tracking before/after balance exactly like
 * godam-wp-dam-hook-check.php's godam_check_hook_balance_in_range() (same
 * checkpoint-per-'{', rewind-on-scope-terminator algorithm — see this file's
 * own top-of-file comment for why that's required here too), and
 * additionally records every access-function call found with nothing open
 * at that point.
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
	$safe_vars         = $params;

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

		$access = godam_coverage_access_call_at( $tokens, $i, $count );
		if ( null === $access ) {
			continue;
		}

		if ( ! empty( $open_before_lines ) ) {
			continue; // Covered.
		}

		if ( '' !== $access['arg'] && in_array( $access['arg'], $safe_vars, true ) ) {
			continue; // First argument is a parameter, or a traceable, un-reassigned alias of one — see top-of-file comment.
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
		$scope = null !== $function['class'] ? "{$function['class']}::{$function['name']}()" : "{$function['name']}()";

		foreach ( godam_coverage_check_range( $tokens, $function['body_start'], $function['body_end'], $function['params'] ) as $finding ) {
			$finding['scope'] = $scope;
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
	foreach ( godam_shared_list_php_files( $scan_root ) as $file ) {
		$tokens    = godam_shared_tokenize( $file );
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
