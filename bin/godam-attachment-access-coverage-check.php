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
	$reasons = array();

	// add_media_thumbnails(): sole caller is handle_wp_media_transcoding_callback()
	// (admin/class-rtgodam-transcoder-rest-routes.php), which already runs entirely
	// inside its own caller's rtgodam_before/after_attachment_lookup pair (see that
	// method's own docblock). The checker has no interprocedural tracing, so it
	// re-flags every access inside a callee whose coverage comes from its caller.
	foreach ( array( 736, 737, 739, 740, 744, 746, 754, 761, 762, 767, 770, 772 ) as $line ) {
		$reasons[ "admin/class-rtgodam-transcoder-handler.php:{$line}" ] = 'add_media_thumbnails(): covered transitively — sole caller (handle_wp_media_transcoding_callback) already runs inside its own caller\'s before/after pair.';
	}

	// handle_callback()'s 'sureforms-godam-recorder' branch: $form_id comes from
	// SRFM\...\Entries::get( $entry_id )['form_id'] — a SureForms form ID used only
	// as a postmeta key to stash the transcoded URL, mirroring the ninja-forms/
	// sureforms Form_Submit pattern below. Never an attachment ID.
	$reasons['admin/class-rtgodam-transcoder-rest-routes.php:337'] = 'handle_callback(): $form_id is a SureForms form ID used as a postmeta key (not an attachment ID) to stash the transcoded URL.';

	// handle_wp_media_transcoding_callback(): the extracted body of handle_callback()'s
	// 'wp-media' branch. Its own docblock records that it always runs with the
	// centralized media site active — see the before/after pair in the caller.
	foreach ( array( 449, 451, 457, 471, 476 ) as $line ) {
		$reasons[ "admin/class-rtgodam-transcoder-rest-routes.php:{$line}" ] = 'handle_wp_media_transcoding_callback(): covered transitively — caller (handle_callback) wraps the entire call in try/finally.';
	}

	// rtgodam_rtt_set_video_thumbnail(): legacy rtMedia integration. rtMedia is not
	// present in this codebase (no RTMediaModel / rtmedia_type() / rtmedia_media_id()
	// defined anywhere) — dead code unless a site separately installs rtMedia, in
	// which case rtmedia_type()/rtmedia_media_id() would already fatal before this
	// line is reached. Same determination already made for vj-develop's copy of GoDAM.
	$reasons['admin/godam-transcoder-actions.php:229'] = 'rtgodam_rtt_set_video_thumbnail(): dead code — rtMedia is not present in this codebase.';

	// godam-player / godam-video-duration / godam-video-thumbnail render.php: this
	// particular get_post_meta() reads '_godam_attachment_id' off the HOST post the
	// block is embedded in (global $post / get_the_ID()), to discover which
	// attachment the block refers to. That's host-post meta, not attachment data —
	// the genuine attachment-scoped reads later in the video-duration/thumbnail
	// files already have their own rtgodam_before/after_attachment_lookup pair.
	$reasons['assets/src/blocks/godam-player/render.php:21']          = "Reads '_godam_attachment_id' off the host post (global \$post), not off the attachment — this is host-post meta, not attachment data.";
	$reasons['assets/src/blocks/godam-video-duration/render.php:21']  = "Reads '_godam_attachment_id' off the host post (get_the_ID()), not off the attachment — the actual attachment meta read a few lines below already has its own before/after pair.";
	$reasons['assets/src/blocks/godam-video-thumbnail/render.php:23'] = "Reads '_godam_attachment_id' off the host post (get_the_ID()), not off the attachment — the actual attachment meta read a few lines below already has its own before/after pair.";

	// Media_Usage_Backfill::run_timed_batches(): $post is the host post/page being
	// scanned for attachment references; Media_Usage_Tracker::POST_META_KEY
	// ('_godam_tracked_media') is written onto that host post to mark it processed
	// (mirrors Seo::update_attachment_post_mapping()'s already-established
	// $post_id-scoped local read/write exclusion). Not attachment data.
	$reasons['inc/classes/class-media-usage-backfill.php:396'] = "\$post is the host post being scanned; POST_META_KEY is a 'processed' marker written on that host post, not on any attachment.";

	// Seo::sync_seo_for_attachment_posts(): get_post( $post_id ) here reads the HOST
	// posts referencing the attachment (from the reverse-index meta read a few lines
	// above, which already has its own before/after pair). Documented in-file as a
	// known structural limitation, not a hook-fixable gap — the reverse-index meta
	// stores bare post IDs with no blog_id, so a multi-site reference can only ever
	// resolve against whichever site is currently active.
	$reasons['inc/classes/class-seo.php:1141'] = 'sync_seo_for_attachment_posts(): reads HOST posts referencing the attachment (see the docblock note on this exact line) — documented structural limitation, not a hook-fixable gap.';

	// Seo::add_video_seo_schema(): $post_id = get_queried_object_id() — the current
	// page being viewed. Reads that page's OWN cached SEO schema meta (written by
	// save_seo_data_as_postmeta against the host page). Not attachment data.
	$reasons['inc/classes/class-seo.php:443'] = "add_video_seo_schema(): \$post_id is get_queried_object_id() (the current page); reads that page's own cached SEO meta, not attachment data.";

	// Lifter_LMS::has_godam_video_block(): $post_id = get_the_ID() — the current post
	// in the loop. Reads its own post_content for a godam/video block. Not attachment data.
	$reasons['inc/classes/lifter-lms/class-lifter-lms.php:139'] = 'has_godam_video_block(): $post_id is get_the_ID() (the current post); reads its own post_content, not attachment data.';

	// Elementor_Gallery_Widget_V1_To_V2::run(): reads/writes '_elementor_data' on
	// regular Elementor-built pages/posts, prefiltered by a direct SQL LIKE on that
	// meta key. Attachments are never edited with Elementor, so this key never
	// appears on an attachment post. One-time migration, gated by its own option.
	$reasons['inc/classes/migrations/class-elementor-gallery-widget-v1-to-v2.php:128'] = "run(): reads '_elementor_data' on Elementor-built posts/pages (prefiltered by SQL) — never an attachment post type.";
	$reasons['inc/classes/migrations/class-elementor-gallery-widget-v1-to-v2.php:150'] = "run(): writes '_elementor_data' back to the same Elementor-built posts/pages — never an attachment post type.";

	// Ninja_Forms_Field_Godam_Recorder::handle_transcoding_callback(): despite taking
	// $attachment_id as its first parameter (unused in the body), the actual
	// get_post_meta/update_post_meta calls use $entry_id — a Ninja Forms entry ID
	// used as a postmeta key to stash the transcoded URL, mirroring the sureforms
	// Form_Submit pattern. Never an attachment ID.
	$reasons['inc/classes/ninja-forms/class-ninja-forms-field-godam-recorder.php:663'] = "handle_transcoding_callback(): \$entry_id is a Ninja Forms entry ID used as a postmeta key (not the function's own unused \$attachment_id parameter).";
	$reasons['inc/classes/ninja-forms/class-ninja-forms-field-godam-recorder.php:672'] = "handle_transcoding_callback(): \$entry_id is a Ninja Forms entry ID used as a postmeta key (not the function's own unused \$attachment_id parameter).";

	// Analytics::enrich_placements(): $placement_post_id is the HOST page a video was
	// placed/embedded on (for the placements table's title/permalink/edit-link), not
	// an attachment ID.
	$reasons['inc/classes/rest-api/class-analytics.php:493'] = 'enrich_placements(): $placement_post_id is the host page a video was placed on, not an attachment ID.';

	// Jetpack::get_jetpack_form() / get_rendered_form_html_static(): $post_id is the
	// HOST post embedding the Jetpack contact-form block (parsed out of a
	// "{post_id}-{form_number}" composite form ID). Reads $post->post_content for
	// block parsing — not attachment data.
	$reasons['inc/classes/rest-api/class-jetpack.php:304'] = 'get_jetpack_form(): $post_id is the host post embedding the Jetpack form block, not an attachment ID.';
	$reasons['inc/classes/rest-api/class-jetpack.php:434'] = 'get_rendered_form_html_static(): $post_id is the host post embedding the Jetpack form block, not an attachment ID.';

	// Media_Library::create_virtual_attachment_after_lookup(): extracted body of
	// create_virtual_attachment(), called via try/finally from inside the caller's
	// own before/after pair. Every line below uses this function's own $attachment_id
	// parameter (or a value derived from it) — the checker's "own parameter is safe"
	// exclusion doesn't reach across the extraction boundary into a differently-named
	// callee, so it re-flags what the caller already covers.
	foreach ( array( 1853, 1890, 1892, 1896, 1906, 1908, 1909, 1910, 1911, 1912, 1913, 1925, 1941, 1948, 1951, 1967, 1977, 1983, 1990, 1994, 2016, 2020 ) as $line ) {
		$reasons[ "inc/classes/rest-api/class-media-library.php:{$line}" ] = 'create_virtual_attachment_after_lookup(): covered transitively — caller (create_virtual_attachment) wraps the entire call in try/finally.';
	}

	// Media_Library::update_image_attachment_meta_after_lookup(): same extract-and-wrap
	// pattern as create_virtual_attachment_after_lookup() above.
	foreach ( array( 428, 429, 560, 567, 568 ) as $line ) {
		$reasons[ "inc/classes/rest-api/class-media-library.php:{$line}" ] = 'update_image_attachment_meta_after_lookup(): covered transitively — caller (update_image_attachment_meta) wraps the entire call in try/finally.';
	}

	// Video_Editor::prioritize_item(): private method, sole call site is inside
	// get_videos()'s own rtgodam_before/after_attachment_lookup pair (wrapping the
	// whole query + prepare + prioritize sequence, matching vj-develop's reference
	// copy of this same file). Covered transitively.
	$reasons['inc/classes/rest-api/class-video-editor.php:262'] = 'prioritize_item(): covered transitively — sole caller (get_videos) wraps the entire call in its own before/after pair.';

	// GoDAM_Player::maybe_enqueue_lightbox_runtime() (shortcodes): bare get_post() —
	// the current singular post — then reads that SAME post's own post_content and
	// '_elementor_data' meta, sniffing for a lightbox trigger marker. Not attachment data.
	$reasons['inc/classes/shortcodes/class-godam-player.php:235'] = 'maybe_enqueue_lightbox_runtime(): bare get_post() resolves to the current singular post, not an attachment.';
	$reasons['inc/classes/shortcodes/class-godam-player.php:239'] = "maybe_enqueue_lightbox_runtime(): reads the current post's own '_elementor_data', not attachment data.";

	// Sureforms\Assets::register_scripts(): bare get_post() — the current post being
	// rendered — checked only for its post_type/post_content to decide whether to
	// enqueue scripts. Not attachment data.
	$reasons['inc/classes/sureforms/class-assets.php:53'] = 'register_scripts(): bare get_post() resolves to the current post being rendered, not an attachment.';

	// Sureforms\Form_Submit::render_custom_field_markup(): $form_id is a SureForms
	// form ID used as a postmeta key to stash/read the transcoded URL (mirrors the
	// ninja-forms and handle_callback() sureforms-branch patterns above). Never an
	// attachment ID.
	$reasons['inc/classes/sureforms/class-form-submit.php:350'] = 'render_custom_field_markup(): $form_id is a SureForms form ID used as a postmeta key, not an attachment ID.';

	return $reasons;
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
