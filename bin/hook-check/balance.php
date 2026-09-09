<?php
/**
 * Guards GoDAM's own `rtgodam_before_attachment_lookup` /
 * `rtgodam_after_attachment_lookup` hook pair against being malformed.
 *
 * These hooks let a plugin centralizing media on a multisite network (e.g.
 * wp-dam) switch site context around a local attachment read/write, then
 * switch back. GoDAM only fires them; a centralizing plugin only listens.
 *
 * One check: every before-hook in a scope must reach a matching after-hook
 * before the scope ends, and no after may fire with nothing open.
 * Branch-aware around early return/throw/exit/die/wp_die() (see
 * godam_check_hook_balance_in_range()) — a guard clause that closes the
 * wrap and returns early is valid, not a bug. A pairing this script can't
 * trace needs a godam-coverage-ignore/-disable comment at the call site
 * (see godam_shared_coverage_directives() in shared.php).
 *
 * Deliberately doesn't track whether a hook was removed, or whether
 * attachment-access code is growing — that's a GitHub reviewer's job. A
 * removed hook whose access call stays is caught directly and statelessly
 * by the sibling coverage.php. No baseline, no persisted state, no
 * update-baseline mode.
 *
 * Shares its tokenizer and hook/directive detection with that sibling via
 * shared.php.
 *
 *   php bin/hook-check/balance.php
 *
 * @package GoDAM
 */

// phpcs:disable WordPress.WP.AlternativeFunctions, WordPress.Security.EscapeOutput, WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_fwrite -- CLI script, no WP bootstrap, no browser output, no VIP filesystem restrictions (writes to STDERR only).

require_once __DIR__ . '/shared.php';

$root = dirname( __DIR__, 2 ); // Plugin root — this file lives two levels under it, in bin/hook-check/.

// No baseline file anymore — error instead of silently ignoring a stale
// 'update-baseline' call from CI config or muscle memory.
if ( isset( $argv[1] ) && 'update-baseline' === $argv[1] ) {
	fwrite( STDERR, "'update-baseline' no longer exists — this script has no baseline file to\n" );
	fwrite( STDERR, "write. Add a // godam-coverage-ignore/-disable/-enable comment at the call\n" );
	fwrite( STDERR, "site instead (see this script's own top-of-file comment for the exact\n" );
	fwrite( STDERR, "syntax), then re-run with no arguments.\n" );
	exit( 1 );
}

// Deny-list scan, not an allow-list — see GODAM_EXCLUDED_ROOT_DIRS in
// shared.php.
$files = godam_shared_list_all_php_files( $root );

const WRAP_HOOK_NAME  = 'rtgodam_before_attachment_lookup'; // Must reach a matching AFTER_HOOK_NAME before its scope ends.
const AFTER_HOOK_NAME = 'rtgodam_after_attachment_lookup'; // WRAP_HOOK_NAME's closing counterpart.

/**
 * Walks a token range treating a before-hook fire as an opened bracket and
 * an after-hook fire as its close, like matching parentheses.
 *
 * Branch-aware around scope-terminating statements (return/throw/exit/die/
 * wp_die()-style calls — see godam_shared_is_scope_terminator()): a guard
 * clause like `before(); if ($bad) { after(); return; } ...; after();` is
 * valid — exactly one after() runs on any given call, and it closes the
 * same before(). A stack of $open_before_lines snapshots, pushed per '{'
 * and popped per '}', lets a terminator rewind to the state when its
 * enclosing block was entered rather than flag the not-taken branch's
 * still-open before() as a bug. Anything left open that was opened AFTER
 * the block started is a real bug, reported immediately instead.
 *
 * @param array[] $tokens      Full token list for the file.
 * @param int     $range_start Token index to start at (inclusive).
 * @param int     $range_end   Token index to end at (inclusive).
 * @param array[] $skip_ranges Each [start, end] to jump past — deferred closures nested in this
 *                             range, walked independently since they can run at a different
 *                             time than the code around them.
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
 * Runs godam_check_hook_balance_in_range() once per named function body,
 * once per deferred closure, and once across the remaining top-level code
 * (concatenated in file order).
 *
 * A deferred closure is excluded from its enclosing range and checked as
 * its own independent scope instead — see the $skip_ranges parameter above.
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

	// Excludes deferred closures AND other nested functions/methods (ranges
	// can nest, e.g. a method inside a function-scoped anonymous class) so
	// an outer scope's walk doesn't also see a nested scope's own
	// before()/after() calls.
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
		// Reindexed to a contiguous array so the range walk isn't confused
		// by the gaps left where function bodies were skipped.
		$top_level_tokens = array_values( array_intersect_key( $tokens, array_flip( $top_level_indexes ) ) );
		$result           = godam_check_hook_balance_in_range( $top_level_tokens, 0, count( $top_level_tokens ) - 1 );

		if ( null !== $result ) {
			$result['scope'] = 'top-level code';
			$findings[]      = $result;
		}
	}

	return $findings;
}

// Before/after hook balance, keyed "{file}:{line}" like the sibling
// coverage-check.php. Accepted only via a godam-coverage-ignore/-disable
// comment at the call site — reserved for a pairing this script can't
// trace, not for excepting a real bug.
$balance_findings   = array();
$directives_by_file = array();
foreach ( $files as $file ) {
	$tokens    = godam_shared_tokenize( $file );
	$functions = godam_shared_find_functions( $tokens );
	$relative  = ltrim( str_replace( $root, '', $file ), DIRECTORY_SEPARATOR );

	$directives_by_file[ $relative ] = godam_shared_coverage_directives( $tokens );

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

// A disable with no matching enable is a hard error — otherwise it would
// silently suppress every finding for the rest of the file.
$dangling_disables = array();
foreach ( $directives_by_file as $relative => $directives ) {
	if ( null !== $directives['dangling_disable'] ) {
		$dangling_disables[ $relative ] = $directives['dangling_disable'];
	}
}

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

$directive_covered_balance = array();
foreach ( $balance_findings as $key => $finding ) {
	$directives = $directives_by_file[ $finding['file'] ] ?? null;
	if ( null === $directives ) {
		continue;
	}

	if ( null !== $directives['ignore_file'] ) {
		$directive_covered_balance[ $key ] = $directives['ignore_file'];
		continue;
	}

	$reason = godam_shared_coverage_directive_covers( $directives, $finding['line'] );
	if ( null !== $reason ) {
		$directive_covered_balance[ $key ] = $reason;
	}
}

$balance_findings = array_diff_key( $balance_findings, $directive_covered_balance );

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

// Already filtered down to what no godam-coverage-* comment covers (see
// above); nothing left to diff against, so report directly.
$balance_failures = array_map( 'godam_check_format_balance_finding', $balance_findings );

echo 'Checked ' . count( $files ) . " file(s) for rtgodam_before_attachment_lookup/rtgodam_after_attachment_lookup balance.\n";
echo 'Suppressed via inline godam-coverage-ignore/disable/ignore-file comments: ' . count( $directive_covered_balance ) . "\n\n";

if ( ! empty( $balance_failures ) ) {
	echo "MALFORMED HOOK PAIRS (before/after don't balance — not just missing, wrong):\n";
	foreach ( $balance_failures as $balance_failure ) {
		echo " - {$balance_failure}\n";
	}
	echo "\n";
	echo "This check cannot prove centralization-compatibility on its own — see\n";
	echo "this file's own top-of-file comment for what it can and can't catch.\n";
	echo "A human still needs to look at the above.\n";
	exit( 1 );
}

echo "No malformed hook pairs detected.\n";
exit( 0 );
