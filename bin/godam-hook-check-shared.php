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
 * Top-level directory names (directly under the plugin root only — not
 * matched anywhere deeper) that never hold hand-hookable plugin runtime
 * code, for godam_shared_list_all_php_files()'s deny-list scan.
 *
 * This list exists because an explicit include-list of scan roots (the
 * pattern both callers used before this function existed) is a silent trap:
 * a new top-level directory — or an existing one nobody thought to add, like
 * `lib/` — is invisible to both hook-coverage scripts until a human
 * remembers to add it by hand. A real miss from exactly this: `lib/` and the
 * plugin-root files (`godam.php`) were never in either script's scan_roots,
 * discovered only by a manual full-repo audit, not by either script. A
 * deny-list only has to name what's genuinely not source (vendored/compiled/
 * tooling/test code); everything else is scanned by default, so a new
 * directory is covered the moment it exists rather than the moment someone
 * remembers to opt it in.
 *
 * `build` and `vendor` are already excluded above regardless of depth
 * (compiled block output can be nested under `assets/build/`, for instance);
 * the names here are deliberately root-level-only since, unlike those two,
 * none of them are expected to recur as a nested directory name inside real
 * plugin source.
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
 * GODAM_EXCLUDED_ROOT_DIRS (matched only at the root level) plus the
 * build/vendor exclusions godam_shared_list_php_files() already applies at
 * any depth. The deny-list counterpart to passing an explicit list of scan
 * roots — see GODAM_EXCLUDED_ROOT_DIRS's own comment for why that matters.
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
 * Strips any namespace qualification from $text, returning just its final
 * segment — "get_post_meta" from "\get_post_meta", "Foo\Bar\WP_Query" or
 * "\Foo\Bar\WP_Query" alike. A plain, unqualified name (no backslash at all)
 * is returned unchanged.
 *
 * PHP 8's tokenizer represents an entire qualified name — leading-backslash
 * ("\get_post_meta") or not ("Foo\get_post_meta") — as a single
 * T_NAME_FULLY_QUALIFIED/T_NAME_QUALIFIED token whose own text includes every
 * segment, never split into separate tokens per segment. A plain
 * `ltrim( $text, '\\' )` (as godam_shared_is_new_wp_query_at() used to do,
 * before being switched to this shared helper) only strips a LEADING
 * backslash, so it still gets a qualified name wrong when there isn't one —
 * "Foo\get_post_meta" would stay "Foo\get_post_meta", never matching a bare
 * "get_post_meta" comparison. Consolidates what
 * godam_shared_find_trait_uses() already computed inline for the same
 * reason (a `use \Foo\Bar\SomeTrait;` needing to match a plain `trait
 * SomeTrait`), so both stay a single, always-in-sync definition.
 *
 * @param string $text Token text (already namespace-qualified or not).
 * @return string
 */
function godam_shared_unqualified_name( $text ) {
	return substr( strrchr( '\\' . ltrim( $text, '\\' ), '\\' ), 1 );
}

/**
 * Whether the token at $i is a real function call of one of $names — i.e. a
 * T_STRING (bare name) or T_NAME_FULLY_QUALIFIED/T_NAME_QUALIFIED (a
 * namespace-qualified name, leading-backslash or not — see
 * godam_shared_unqualified_name()) whose final segment matches
 * (case-sensitively) one of them, immediately followed (skipping
 * whitespace/comments) by '('. Being one of these three token types at all
 * already excludes anything inside a T_COMMENT/T_DOC_COMMENT, since the
 * tokenizer never splits a comment's text into separate tokens.
 *
 * Recognizing the two qualified-name token types (not just T_STRING) matters
 * concretely for every check built on this function — hook-fire detection,
 * scope-terminator detection, deferred-callback detection, ACCESS_FUNCTIONS
 * matching, and get_posts()/get_children() bare-call detection all go
 * through here — a call written as `\get_post_meta( ... )` (a common,
 * deliberate PHP style specifically to force global-namespace resolution
 * from inside a namespaced file, bypassing PHP's own namespace-fallback
 * lookup) was previously invisible to every one of them, since it never
 * tokenizes as a plain T_STRING at all. This codebase declares a namespace
 * in ~120 files today with zero such qualified calls to any tracked name
 * currently (verified via grep) — a real, currently dormant gap rather than
 * a hypothetical one, closed here so it can't silently reappear the moment
 * that style is used.
 *
 * A qualified name can never legitimately follow -> or :: (a method name,
 * static or not, is always a bare identifier — methods aren't independently
 * namespaced the way classes/functions are), so widening this to accept the
 * two extra token types can't newly misidentify a method call as a bare
 * function call; nothing changes for godam_shared_is_bare_call_to()'s own
 * method-style exclusion. A declaration's own name is likewise always bare
 * (`function \Foo\bar()` isn't valid PHP), so this also can't newly
 * misidentify a declaration as a call.
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
	return $n < $count && '(' === $tokens[ $n ]['text'];
}

/**
 * Whether the token at $i is the NAME in a function/method declaration
 * ("function name(" or, for a return-by-reference declaration, "function
 * &name(") rather than a genuine call — both shapes tokenize identically at
 * $i itself (a T_STRING immediately followed by '('), so anything matching
 * purely by text+"(" (godam_shared_is_call_to() and anything built on it)
 * needs this check wherever the matched set could include a real,
 * user-defined function/method name.
 *
 * A free function's own declaration is otherwise indistinguishable from a
 * genuine call to itself. A method's declaration is already harmless
 * wherever a separate method_style check exists (a declaration is never
 * preceded by ->/::, so it already fails that check) — but NOT wherever a
 * check matches purely by bare name with no method_style test of its own,
 * which is exactly the shape godam_shared_is_bare_call_to() needs this for:
 * a real user-defined method named get_children() (or get_posts()) has its
 * own declaration tokenized as a bare, non-method-style match, and without
 * this check it would be wrongly read as a call to the global function of
 * the same name. Confirmed via a synthetic fixture (a class with its own
 * ->get_children() method) before this check was added.
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
 * Whether the token at $i is a real call to one of $names the way
 * godam_shared_is_call_to() checks, AND is neither method-style (not
 * immediately preceded by -> or ::) NOR a function/method declaration of the
 * same name (godam_shared_is_function_declaration_at()).
 * godam_shared_is_call_to() alone can't distinguish a genuine call to a
 * global function from an unrelated class's own same-named method — e.g.
 * $query->get_posts(), reading an already-executed WP_Query instance's own
 * cached results, is a completely different operation from the global
 * get_posts() function that runs a brand-new query, but both are a T_STRING
 * matching "get_posts" immediately followed by '(' — nor from that same
 * class's own method DECLARATION, which tokenizes identically to a bare
 * call too.
 *
 * Confirmed as a real, currently-firing false positive rather than a
 * hypothetical one: admin/class-rtgodam-retranscodemedia.php calls
 * $query->get_posts() twice, each previously misdetected as a fresh global
 * query-pattern finding alongside the legitimate `new WP_Query()` finding
 * one line above it. Used specifically for get_posts()/get_children() in
 * godam_shared_query_pattern_at() below — the $wpdb query-method check
 * (godam_shared_is_wpdb_call_to()) already requires its own exact `$wpdb->`
 * prefix independently, so it isn't affected by this same gap; the 12
 * ACCESS_FUNCTIONS names in the coverage-checker have no confirmed
 * collision in this codebase today (verified via grep), so they're left as
 * godam_shared_is_call_to() for now rather than changed without a concrete
 * case motivating it.
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
 * Whether the T_CONSTANT_ENCAPSED_STRING token at $i is $hook_name, passed as
 * the first argument to a real, BARE (not method-style, not a same-named
 * declaration — godam_shared_is_bare_call_to()) call to one of
 * $outer_functions — e.g. do_action( 'x' ).
 *
 * Uses godam_shared_is_bare_call_to() rather than plain godam_shared_is_call_to()
 * specifically so a class that happens to declare its own method named
 * do_action() (or whatever GODAM_HOOK_FIRE_FUNCTIONS names) can't fake a hook
 * fire: $logger->do_action( 'rtgodam_before_attachment_lookup' ) — a
 * completely unrelated logging method that fires nothing — used to be
 * indistinguishable from the real, global do_action() call this function
 * exists to detect. Confirmed as a real, silent bug via a synthetic fixture
 * before this was fixed: the fake "before" opened a bracket that then
 * covered a genuinely uncovered get_post_meta() call immediately after it,
 * and the finding didn't just get misclassified, it vanished entirely — the
 * opposite of this file's own "more candidates, not fewer" stance elsewhere,
 * and a much worse failure than the already-accepted get_posts()/
 * get_children()-style collisions (those risk one extra, dismissable
 * candidate; this one risked silently hiding a real gap). do_action()/
 * wp_die()/wp_send_json*() are all WordPress core global functions, never
 * legitimately called via ->/:: in real code, so this exclusion can't reject
 * any genuine hook fire — only the pathological same-named-method case.
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
 * Distinct from a plain ACCESS_FUNCTIONS-style name because these are only
 * ever invoked as a method on the $wpdb global specifically —
 * godam_shared_is_call_to()'s bare-name check can't recognize that shape,
 * and neither hook-coverage script tracked it before a full manual audit
 * (2026-08) found two live, previously-unflagged gaps this way: a raw
 * $wpdb->get_results() query and a new WP_Query() call, both reading
 * exactly the same site-scoped postmeta/posts data get_post_meta() does.
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
 * (T_STRING, when the file `use`s WP_Query) or fully/partially qualified
 * (T_NAME_FULLY_QUALIFIED/T_NAME_QUALIFIED — PHP 8's single-token
 * representation of `\WP_Query`/`Foo\WP_Query`, confirmed empirically
 * against this exact PHP version's token stream rather than assumed, since
 * a T_STRING-only check would silently miss every fully-qualified usage —
 * and this codebase uses both forms in different files).
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
 * Given the index of an opening '(' or '[', returns the index of its
 * matching closer (')' or ']', respectively) by tracking depth for that
 * specific bracket type only. Returns $count (out of range) if unbalanced.
 *
 * A general counterpart to godam_shared_find_matching_paren() (which only
 * ever handles '(' — kept as its own thin wrapper below, since most callers
 * only ever need to bound a call's own argument list). Added specifically so
 * godam_shared_range_targets_attachment_post_type() can also bound an
 * array-literal (`[ ... ]`) post_type value, not just an array()-call one.
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
 * Given a target range and a list of candidate ranges (each an array with
 * 'body_start'/'body_end' keys — a godam_shared_find_functions() entry or a
 * godam_shared_find_deferred_closures() entry), returns every candidate
 * STRICTLY NESTED inside the target range, as [start, end] pairs suitable
 * for a $skip_ranges argument (godam_coverage_check_range(),
 * godam_check_hook_balance_in_range(), godam_check_count_calls(), etc.).
 *
 * Excludes an exact self-match (a candidate whose own range equals the
 * target range): a caller building "what's nested inside function F" by
 * passing the SAME list F itself came from (e.g. every entry in
 * $functions, checking which others are nested inside one specific
 * function's own range) will trivially find F matching itself, since its
 * own range always satisfies >= / <= against itself — without this
 * exclusion, the walk would jump from F's own opening token straight past
 * its entire body on the very first iteration. This exact shape of bug was
 * found and fixed for deferred closures earlier in this project (a
 * closure's own findings came back completely empty, not merely
 * misclassified) — the same guard applies here for the identical reason,
 * now that a named function's own range can also be nested inside another
 * function's range (a method inside a function-scoped anonymous class sits
 * inside its enclosing function's range too).
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
 * Whether the token range [$range_start, $range_end] contains a
 * `'post_type' => 'attachment'`/`'post_type' => 'any'` key/value pair, OR a
 * `'post_type' => array( ..., 'attachment', ... )` / `[ ..., 'any', ... ]`
 * array value that mentions either string anywhere inside it — used to
 * decide whether a WP_Query/get_posts()/get_children() call found somewhere
 * in that same range is attachment-shaped.
 *
 * The array-value shape is a real, common case a bare-string-only check
 * misses entirely: `post_type => array( 'post', 'attachment' )` is an
 * ordinary way to query more than one type in one call. Confirmed via a
 * synthetic fixture (0 findings where 1 was expected) before this branch was
 * added. Only the array's own element list (bounded by its matching closing
 * bracket) is scanned for this shape, not the whole enclosing range — the
 * bare-string branch below is unchanged and still deliberately scans the
 * whole range (see its own reasoning below).
 *
 * Deliberately scans the WHOLE enclosing range for the bare-string shape
 * rather than tracing the query's own $args variable precisely: real
 * query-args arrays in this codebase are built incrementally across several
 * statements ($args = array(...); $args['meta_query'] = ...;) before the
 * `new WP_Query( $args )` call itself, and tracing that data-flow precisely
 * would need real variable-value tracking this tool doesn't otherwise do
 * anywhere. Scanning the whole range is a deliberately permissive
 * heuristic — it can also match an unrelated post_type mentioned elsewhere
 * in a large function — false positives here just mean one more candidate
 * for a human to glance at and dismiss, not a missed real gap, the same
 * "more candidates, not fewer" tradeoff this file's other heuristics already
 * make.
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
 * Whether the token range [$range_start, $range_end] (typically a $wpdb
 * query call's own argument list) contains any token whose text mentions
 * postmeta or wp_posts — used to decide whether a raw $wpdb query is
 * attachment-shaped. wp_postmeta/wp_posts hold every post type, not just
 * attachments, so this over-includes non-attachment queries too — the same
 * "more candidates, not fewer" tradeoff as
 * godam_shared_range_targets_attachment_post_type() above.
 *
 * @param array[] $tokens      Full token list for the file.
 * @param int     $range_start Token index to start at (inclusive).
 * @param int     $range_end   Token index to end at (inclusive).
 * @return bool
 */
function godam_shared_range_mentions_post_tables( $tokens, $range_start, $range_end ) {
	for ( $i = $range_start; $i <= $range_end; $i++ ) {
		$text = strtolower( $tokens[ $i ]['text'] );
		if ( false !== strpos( $text, 'postmeta' ) || false !== strpos( $text, 'wp_posts' ) ) {
			return true;
		}
	}

	return false;
}

/**
 * If the token at $i starts a real WP_Query/get_posts()/get_children()/$wpdb
 * query-method call, returns ['kind' =>
 * 'wp_query'|'get_posts'|'get_children'|'wpdb', 'name' => human-readable
 * label, 'is_attachment_shaped' => bool]. Returns null if $i isn't one of
 * these call shapes at all.
 *
 * These shapes read (or, for $wpdb, also write) the same site-scoped
 * postmeta/posts data ACCESS_FUNCTIONS does, but none of them is a plain
 * `name(` call ACCESS_FUNCTIONS' own detection recognizes — see
 * GODAM_WPDB_QUERY_METHODS' own comment for the real gaps this exact
 * blind spot caused.
 *
 * get_children()'s own "attachment-shaped" determination reuses the same
 * post_type scan as WP_Query/get_posts(), which only catches an EXPLICIT
 * `post_type => 'attachment'/'any'`/array-containing-either shape — a bare
 * `get_children( $post_id )` call with no $args at all also returns
 * attachments by WP core's own default behavior (children of every post
 * type, attachments included), and that implicit-default shape has no
 * 'post_type' string anywhere to find, so it's NOT detected here. A
 * documented, accepted residual gap rather than a redesign: modeling WP
 * core's exact default-argument behavior via token heuristics (as opposed to
 * "is post_type explicitly set to something attachment-shaped") is a
 * different, much broader kind of inference than anything else in this
 * file attempts.
 *
 * get_posts()/get_children() are matched via godam_shared_is_bare_call_to()
 * (not plain godam_shared_is_call_to()) specifically to exclude a method-style
 * call like `$query->get_posts()` — reading an already-executed WP_Query
 * instance's own cached results, not running a fresh query — from being
 * misdetected as the global function of the same name; see that function's
 * own comment for a real, confirmed instance of exactly this collision.
 *

 * Always treated as a "direct" finding by callers, never parameter-sourced:
 * unlike get_post_meta( $id, ... ), none of these shapes takes a single
 * attachment-ID argument to check against a safe-parameter set — there's no
 * equivalent "the ID came from my own parameter" case to exclude.
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
		return array(
			'kind'                 => 'wp_query',
			'name'                 => 'new WP_Query',
			'is_attachment_shaped' => godam_shared_range_targets_attachment_post_type( $tokens, $range_start, $range_end, $count ),
		);
	}

	if ( godam_shared_is_bare_call_to( $tokens, $i, array( 'get_posts' ), $count ) ) {
		return array(
			'kind'                 => 'get_posts',
			'name'                 => 'get_posts',
			'is_attachment_shaped' => godam_shared_range_targets_attachment_post_type( $tokens, $range_start, $range_end, $count ),
		);
	}

	if ( godam_shared_is_bare_call_to( $tokens, $i, array( 'get_children' ), $count ) ) {
		return array(
			'kind'                 => 'get_children',
			'name'                 => 'get_children',
			'is_attachment_shaped' => godam_shared_range_targets_attachment_post_type( $tokens, $range_start, $range_end, $count ),
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
 * a real `return`/`throw`/`exit`/`die` (T_EXIT covers both keyword spellings
 * — they're language-level aliases, tokenized identically), or a real, BARE
 * (not method-style, not a same-named declaration —
 * godam_shared_is_bare_call_to()) call to one of GODAM_TERMINATOR_FUNCTIONS.
 *
 * Uses godam_shared_is_bare_call_to() for the same reason
 * godam_shared_is_hook_fire_at() does — see that function's own comment: a
 * class with its own wp_die()/wp_send_json*()-named method would otherwise
 * be indistinguishable from the real, global terminator call, and here that
 * would wrongly treat a normal statement as scope-ending (potentially
 * masking a real gap the same way a fake hook-fire could). All four
 * GODAM_TERMINATOR_FUNCTIONS names are WordPress core globals, never
 * legitimately called via ->/:: in real code.
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
 * Finds named class/interface/trait declarations in a token stream: name and
 * body token range, by tracking brace depth. Also records whether the
 * declaration is specifically a trait (T_TRAIT) — used by
 * godam_shared_find_trait_uses() and, downstream, by the coverage-checker's
 * caller trace to widen a private trait method's same-file search to every
 * file that actually `use`s the trait, not just the trait's own file (a
 * private trait method is only ever reachable from within whichever class
 * consumes it, which can live in a different file entirely).
 *
 * The only other thing this is used for is letting
 * godam_shared_find_functions() class-qualify each method's own name
 * (`Foo::render()` instead of a bare `render()` that reads identically for
 * any other class with a same-named method) — callers doing their own
 * reporting want that qualified form so a finding's scope label alone tells
 * a reader which class it's in, without needing to also cross-reference the
 * file.
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
			// Anonymous class (`new class { ... }` — only ever T_CLASS, never
			// T_TRAIT/T_INTERFACE) — no declared name to qualify a method
			// with, but still a genuine class: a method inside one is only
			// ever callable via ->, never as a bare free-function-style name.
			// Previously skipped entirely here, which left a method inside
			// one with class = null downstream in godam_shared_find_functions()
			// — silently misclassified as a free function, which would wrongly
			// let it match a bare `name(` call site instead of requiring
			// ->/:: the way any other method does. A synthetic name built from
			// this class's own token index is guaranteed to never collide
			// with a real (identifier-only) class name, and is enough for
			// godam_shared_find_functions() to still class-qualify its
			// methods correctly even though no caller could ever reference
			// this "name" directly. Confirmed via a synthetic fixture that a
			// method inside one is no longer misclassified as a free function
			// once this is assigned. None exist in this codebase today
			// (verified via grep) — this only guards against a future one.
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

		// Deliberately NOT jumping $i to $body_end here — the exact same
		// reasoning godam_shared_find_functions() already documents for
		// itself applies here too, and this function had the identical bug
		// until an independent review caught it: an anonymous class (`new
		// class { ... }`) can appear inside a METHOD that itself belongs to
		// an already-recorded outer class, meaning the anonymous class's own
		// T_CLASS token sits WITHIN the outer class's [body_start, body_end]
		// range. Jumping past that range skipped the anonymous class's own
		// token entirely, so it was never recorded — and every method inside
		// it then got class-qualified as the OUTER class by
		// godam_shared_find_functions() (which matches a method's body_start
		// against whichever recorded class range contains it — with the
		// anonymous class missing, the outer one was the only match left).
		// Confirmed as a real, concrete consequence, not just a theoretical
		// mislabel: two methods that happen to share a bare name (one really
		// on the outer class, one really on the nested anonymous class) then
		// collide on the exact same "{class}::{name}()" scope key in
		// godam_check_build_counts()'s baseline — silently losing one of the
		// two methods' own distinct wrap/access counts from tracking
		// entirely, which defeats the whole point of per-function (not
		// per-file) counting this file's own top-of-file comment describes.
		// Same non-double-recording argument as godam_shared_find_functions()
		// applies: the outer class's own T_CLASS token index has already
		// been passed by the time its body is scanned linearly, so it can
		// never be found a second time.
	}

	return $classes;
}

/**
 * Finds every `use TraitName[, TraitName2, ...];` (or `use TraitName { ...
 * conflict-resolution block };`) statement inside a class body, returning
 * which trait names each such class imports — distinct from a `use
 * Foo\Bar;` at the top of a file for namespace importing (same T_USE token,
 * but a class body can't have a namespace-import `use` of its own, so
 * scoping this to strictly between a class's own body_start/body_end, from
 * godam_shared_find_classes(), can't confuse the two).
 *
 * Excludes any OTHER class nested inside the one currently being scanned
 * (godam_shared_ranges_nested_in()) — now that a class's range can be nested
 * inside another class's range (an anonymous class inside a method
 * belonging to an outer, already-recorded class — see
 * godam_shared_find_classes()'s own comment), a `use TraitName;` statement
 * that's really only inside the INNER (often anonymous) class's own body
 * sits within the OUTER class's [body_start, body_end] range too. Without
 * this exclusion, that one `use` statement gets recorded twice: once
 * (correctly) for the inner class, and once (wrongly) for the outer class,
 * which never actually declared it — confirmed as a real, concrete bug via
 * a synthetic fixture (an outer class containing a method that returns `new
 * class { use SomeTrait; }`) before this exclusion was added: the outer
 * class was wrongly recorded as a consumer of a trait it never uses at all,
 * which could widen a completely unrelated private method's own
 * allowed_files in the coverage-checker's trait-consumer resolution.
 *
 * Trait names are normalized to their short (last-segment) form via
 * godam_shared_unqualified_name() — matching how godam_shared_find_classes()
 * records a trait's own declared name, always bare/unqualified — so a
 * qualified `use \Foo\Bar\SomeTrait;` still matches a plain `trait
 * SomeTrait { ... }` declaration found elsewhere.
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
 * Function names whose typical call shape passes (directly, or nested
 * inside an args array — see register_rest_route() below) a callback that
 * WordPress stores and invokes later, potentially on a completely different
 * request than the one that registered it — the same "deferred, not inline"
 * shape add_action()/add_filter() have, and the reason a closure passed to
 * any of these needs the same isolation godam_shared_find_deferred_closures()
 * applies.
 *
 * `add_shortcode()` takes a plain callback exactly like add_action()/
 * add_filter() do. register_activation_hook()/register_deactivation_hook()
 * do too — their own hook-name-equivalent first argument is __FILE__, a
 * magic constant rather than a string literal, so hook_name simply comes
 * back null for those, same as any other call whose first argument isn't a
 * plain string. register_rest_route()'s callback is nested inside its own
 * 'callback' => ... entry of the $args array (its 3rd positional argument),
 * not a direct positional argument the way the others are — but that's
 * already exactly what the existing "scan every token inside the call's own
 * parens" search handles without any extra work, since it doesn't care
 * about argument position at all.
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
 * Given the index of a T_FUNCTION token already confirmed to start an
 * anonymous closure (not a named declaration), extracts its own parameter
 * names and body token range by tracking paren/brace depth. Returns null if
 * $j doesn't actually start an anonymous closure (a named function
 * shouldn't appear here, but this doesn't guess) or if $count is reached
 * before a body is found (unbalanced — bail rather than guess).
 *
 * Shared by both ways godam_shared_find_deferred_closures() finds a deferred
 * closure: directly inline inside a registration call's own arguments, and
 * assigned to a variable first (godam_shared_find_closure_assignments()),
 * found independently of any call.
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

	// Closure's own parameter list — same param-name extraction
	// godam_shared_find_functions() does for named functions, so the closure
	// can be walked as its own independent scope with its own, correct
	// safe-parameter set (never the enclosing function's parameters — a
	// closure's parameters are its own distinct variables, even if a name
	// happens to collide).
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
 * token stream (regardless of what encloses it) — a closure assigned to a
 * variable first, rather than passed inline. Used only so
 * godam_shared_find_deferred_closures() can also recognize the "assign,
 * then register by variable" shape — see that function's own comment.
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
 * Finds every closure (`function(...) {...}`, anonymous — never a named
 * function) that's effectively DEFERRED to one of
 * GODAM_DEFERRED_CALLBACK_FUNCTIONS: either passed directly as (or nested
 * inside an args array for) an argument to a real call to one of them, or
 * first assigned to a variable which is later passed, by that variable, to
 * one of them. Returns, for each, the hook name it's registered for (when
 * the registration call's first argument is a plain string literal, purely
 * for a readable report label) and its own body's token range.
 *
 * This is what lets a *deferred* callback correctly NOT inherit whatever
 * rtgodam_before/after_attachment_lookup bracket happens to be open in the
 * function where it's DEFINED: a closure registered this way runs later,
 * whenever that hook actually fires — potentially on a completely different
 * request, long after the defining function (and its bracket) has already
 * returned. Without isolating it, a closure merely lexically positioned
 * between a before()/after() pair in its defining function would be wrongly
 * treated as covered, purely by coincidence of where it happens to sit in
 * the source file.
 *
 * Deliberately scoped to only GODAM_DEFERRED_CALLBACK_FUNCTIONS specifically
 * — not every closure passed to every function — because those are the
 * concrete, common WordPress shapes for "store this callback, invoke it
 * later, possibly on a different request." array_map()/usort()/
 * array_filter() and an immediately-invoked closure all run their closure
 * synchronously, inline, genuinely inheriting the surrounding bracket
 * correctly — changing that behavior for them would be a regression, not a
 * fix, so those are deliberately left exactly as before (swallowed into
 * their enclosing scope).
 *
 * Only matches an anonymous `function` closure (T_FUNCTION), not an arrow
 * function (T_FN) — an arrow function's single-expression body has no `{}`
 * to reliably bound this way, and this codebase's real registration calls
 * never use one (confirmed via a full-codebase grep) — a narrow, documented,
 * currently-moot gap rather than a redesign this specific risk doesn't
 * currently justify.
 *
 * The variable-mediated shape (`$cb = function() {...}; add_action( 'x',
 * $cb );`) requires the assignment and the registration call to share the
 * same enclosing function (godam_shared_enclosing_function_at()) — or both
 * be top-level code — before matching by variable name. Earlier this
 * matched file-wide with no scope check at all; that was a real,
 * confirmed-possible false-match risk (two unrelated functions each
 * assigning their own closure to a same-named local, e.g. both calling it
 * `$cb`, would incorrectly cross-match), not just a theoretical one — "same
 * enclosing function" closes the actual ambiguity without the complexity of
 * real data-flow tracking (which specific value a variable holds at one
 * exact point) this file doesn't otherwise attempt anywhere. If the same
 * variable is passed to more than one registration call within its own
 * scope, its closure is only recorded once (whichever call is encountered
 * first in file order decides the reported hook_name label).
 *
 * Both registration-call scans below use plain godam_shared_is_call_to()
 * (not godam_shared_is_bare_call_to()) DELIBERATELY, unlike
 * godam_shared_is_hook_fire_at()/godam_shared_is_scope_terminator()/
 * ACCESS_FUNCTIONS matching. Those have no legitimate object-oriented
 * equivalent — nobody defines a method that means "fire this exact WP hook"
 * or "read this exact attachment meta the same way the global does," so
 * excluding method-style calls there can only ever remove a false positive.
 * add_action()/add_filter() are different: the common WordPress "Plugin
 * Boilerplate" Loader-class pattern — `$this->loader->add_action( 'init',
 * $callback )` — is a genuine, widely-used deferred-registration mechanism,
 * functionally identical to the global call; the callback it wraps still
 * runs later, not now. This was tried as `is_bare_call_to()` in an earlier
 * round for consistency with the other checks, and confirmed via a
 * synthetic fixture to be a real regression, not just a theoretical one: a
 * closure passed through exactly this Loader pattern stopped being isolated
 * from its enclosing scope, so it silently inherited whatever bracket
 * happened to be open where it's lexically defined — a genuinely uncovered
 * access call inside it produced ZERO findings, not a misclassification,
 * the exact failure mode this whole isolation mechanism exists to prevent.
 * Reverted back to plain is_call_to() here specifically: a class with some
 * OTHER, unrelated add_action()-named method that ISN'T a deferred-callback
 * wrapper (confirmed with a second fixture) now produces a false positive
 * instead — annoying, not dangerous, the same "more candidates, not fewer"
 * direction this file's other heuristics already accept.
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

	// Phase 2: a closure assigned to a variable first, then that variable
	// passed (directly, or nested inside an args array) as a bare argument
	// to a registration call — e.g. `$cb = function() { ... }; add_action(
	// 'init', $cb );`. Phase 1 above can't see this shape at all: the call's
	// own argument list contains a T_VARIABLE, not a T_FUNCTION, so nothing
	// inside it ever matches there.
	$assignments = godam_shared_find_closure_assignments( $tokens );
	if ( empty( $assignments ) ) {
		return $closures;
	}

	$assignments_by_var = array();
	foreach ( $assignments as $assignment ) {
		// Recorded once here rather than re-derived per candidate match below —
		// the assignment's own position (its closure's body_start) stands in
		// for "where the assignment itself is," since the two are always
		// textually adjacent.
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
 * `function` keyword is at token index $i, by scanning backward over any
 * combination of visibility/static/abstract/final modifiers immediately
 * preceding it (order-independent — `public static function` and `static
 * public function` are both valid PHP and both handled).
 *
 * Used to scope godam-attachment-access-coverage-check.php's one-hop
 * call-site search: a `private` method can only be called from within its
 * own class, so callers can be found by a same-file-only search rather than
 * a codebase-wide one, which both narrows the search and sidesteps the
 * same-name-in-a-different-class collision risk a codebase-wide search
 * can't rule out without real type resolution.
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
 * Finds named function/method declarations in a token stream: name,
 * enclosing class name, parameter names, parameter-list token range, and
 * body token range, by tracking paren depth (parameter list) and brace depth
 * (body) rather than assuming a fixed shape.
 *
 * `params_open`/`params_close` (the parameter list's own '('/')') are
 * recorded separately from body_start/body_end specifically so a PHP 8.1+ "new in
 * initializers" default value — `function search( $query = new WP_Query(
 * ... ) )` — can be found and correctly attributed to this function, without
 * being walked as part of the SAME range as the body. See
 * godam_coverage_file_findings()'s own comment for why those two ranges are
 * walked independently rather than merged into one.
 *
 * An interface/abstract method declaration (semicolon-terminated, no body)
 * can have this exact same "new in initializers" shape in its own parameter
 * list, but is deliberately NOT added to the returned $functions — doing so
 * would give a name a SECOND "definition" purely from its declaration,
 * alongside whatever concrete class actually implements it with a real
 * body, breaking godam_coverage_resolve_coverage()'s codebase-wide-
 * uniqueness check (a common one-interface-one-implementation shape would
 * wrongly stop auto-resolving that name, treating it as ambiguous when
 * there's really only one implementation to trace). Its parameter-list
 * range is still worth tracking for the SAME "new in initializers" scoping
 * purpose, though, so it's returned separately via the optional
 * $bodyless_declarations by-reference parameter — existing callers that
 * don't pass anything are completely unaffected; callers that need it
 * (currently: the parameter-list scoping in godam_coverage_file_findings()/
 * godam_check_build_counts()) opt in explicitly.
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
			// Interface/abstract declaration — no body, so not added to
			// $functions (see this function's own docblock for why) — but
			// its own parameter-list range is recorded separately, using
			// $i (the T_FUNCTION token's own index — body_start doesn't
			// exist for this shape) to find the smallest-span enclosing
			// class the exact same way a bodied function does.
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

		// Picks the SMALLEST (innermost) containing class, not just the
		// first match in $classes' own array order — now that a class's
		// range can be nested inside another class's range (an anonymous
		// class inside a method belonging to an outer, already-recorded
		// class — see godam_shared_find_classes()'s own comment on why it no
		// longer jumps past a class's body), a function's body_start can
		// fall within BOTH the outer and the inner class's ranges at once,
		// and $classes lists the outer one first (found earlier in the same
		// linear scan). Taking the first match unconditionally would
		// class-qualify a method that's really on the inner (often
		// anonymous) class as if it belonged to the outer one instead —
		// confirmed as a real, concrete bug via an independent review plus a
		// synthetic fixture: two same-named methods, one really on the outer
		// class and one really on a nested anonymous class, both got
		// class-qualified as the outer class, colliding on the exact same
		// scope key downstream and silently losing one method's own counts
		// from tracking entirely.
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

		// Deliberately NOT jumping $i to $body_end here: this function's own
		// body can contain another named function/method — a method inside
		// a `new class { ... }` expression (godam_shared_find_classes() now
		// gives every anonymous class a synthetic name specifically so its
		// methods can be found), or, in principle, a conditionally-declared
		// nested named function — and jumping straight past the whole body
		// would skip over its T_FUNCTION token entirely, silently dropping it
		// from the result. Confirmed as a real bug via a synthetic fixture: a
		// private method inside a `return new class { ... }` expression
		// wasn't merely misclassified, it was never found at all, because
		// the jump this comment used to justify ("nested closures already
		// consumed") landed past it before the outer for loop ever reached
		// its T_FUNCTION token. A genuinely anonymous closure was already,
		// separately, never added to $functions regardless (see the
		// anonymous-function `continue` above, which doesn't advance $i) —
		// so letting the loop's own $i++ walk through an already-captured
		// body linearly instead of jumping past it doesn't risk
		// re-recording anything, including this function itself (its own
		// T_FUNCTION token index has already been passed and is never
		// revisited); it only means a nested named declaration inside that
		// body is no longer invisible.
	}

	return $functions;
}

/**
 * Returns the INNERMOST (smallest-range) entry in $functions whose
 * [body_start, body_end] contains $index, or null if none do.
 *
 * "Innermost" matters specifically because function ranges can now nest — a
 * method inside a function-scoped anonymous class sits inside its enclosing
 * function's own range too (see godam_shared_find_functions()'s own comment
 * on why the jump-past-body optimization was removed). An index inside such
 * a method is technically "contained" by both entries; the method itself is
 * the more specific, correct answer to "which function is this really
 * inside," so the smallest-spanning match wins.
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
 * Whether $a and $b — each either a godam_shared_enclosing_function_at()
 * result or null — refer to the same enclosing scope: both null (both
 * top-level), or both a function entry with the same body_start/body_end.
 * Comparing by range rather than by array identity, since two independent
 * calls to godam_shared_find_functions()/godam_shared_enclosing_function_at()
 * never return the exact same PHP array instance even for the same
 * underlying function.
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
