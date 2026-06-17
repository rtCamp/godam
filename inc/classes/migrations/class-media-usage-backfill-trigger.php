<?php
/**
 * Migration: kick off the media usage backfill.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Migrations;

use RTGODAM\Inc\Media_Usage_Backfill;

defined( 'ABSPATH' ) || exit;

/**
 * Auto-starts the media usage backfill through the migration system.
 *
 * The heavy lifting — batching, Action Scheduler chaining, progress tracking and
 * the manual Start/Stop REST API used by the Tools page — lives in
 * {@see Media_Usage_Backfill}. This migration is only the *trigger*: it lets the
 * backfill start itself with no user intervention, the same way the WooCommerce
 * add-on does, rather than relying on an `admin_init` flag that only fired once
 * on the first wp-admin visit.
 *
 * ## Why a migration
 *
 * Routing the auto-start through {@see Runner} gives three things the previous
 * `admin_init` + one-time-flag approach lacked:
 *
 *  - it fires on `init` for *every* request type (front-end, admin, REST, AJAX,
 *    WP-Cron), so the backfill begins even if an administrator never opens
 *    wp-admin;
 *  - it is version-gated, so a future release that needs to re-seed the index can
 *    re-trigger it simply by shipping under a new version key; and
 *  - it inherits the runner's multisite handling for free.
 *
 * ## Lifecycle
 *
 * 1. `Runner::maybe_run()` (hooked to `init`) calls `maybe_run()` once the stored
 *    db version is behind the current plugin version.
 * 2. `maybe_run()` returns true immediately for the terminal states (completed, or
 *    manually stopped from the Tools page) so the runner advances the stored
 *    version and never re-triggers.
 * 3. Otherwise it calls {@see Media_Usage_Backfill::start()}, which is idempotent:
 *    it begins a fresh run, no-ops an already-pending one, or reschedules a
 *    dropped Action Scheduler batch.
 * 4. While batches are still running it returns false, so the runner holds the
 *    stored version and retries on the next `init` until the chain completes.
 *
 * The Action Scheduler batch callback is registered unconditionally by the
 * {@see Media_Usage_Backfill} singleton's constructor (instantiated in the
 * Plugin manifest), so this migration needs no `register_hooks()` of its own.
 *
 * ## Re-running (e.g. for testing)
 *
 *   wp option delete godam_media_backfill_status
 *   wp option delete rtgodam_db_version
 *
 * @since 1.13.0
 */
class Media_Usage_Backfill_Trigger {

	/**
	 * Start (or resume) the media usage backfill.
	 *
	 * Returns true only when there is nothing left for the migration to do, so
	 * the runner advances the stored db version. While the backfill is still
	 * processing it returns false and the runner retries on the next `init`.
	 *
	 * @since 1.13.0
	 *
	 * @return bool True when complete (or a terminal state), false while pending.
	 */
	public static function maybe_run(): bool {
		$status = get_option( Media_Usage_Backfill::OPT_STATUS, Media_Usage_Backfill::STATUS_IDLE );

		// Terminal states — nothing more for the migration to do. A manual Stop
		// from the Tools page is respected here: we do not resume it, and
		// returning true lets the runner stop re-triggering.
		if ( in_array(
			$status,
			array( Media_Usage_Backfill::STATUS_COMPLETED, Media_Usage_Backfill::STATUS_STOPPED ),
			true
		) ) {
			return true;
		}

		// Backfill batches run on Action Scheduler. If it is not loaded yet,
		// report incomplete so the runner retries on a later request.
		if ( ! function_exists( 'as_enqueue_async_action' ) ) {
			return false;
		}

		// Idempotent: starts a fresh run, no-ops an already-pending one, or
		// reschedules a dropped batch action.
		Media_Usage_Backfill::get_instance()->start();

		// start() flips status straight to COMPLETED when there are no posts to
		// scan; otherwise it is now RUNNING and we report incomplete so the
		// runner retries until the batch chain finishes.
		return Media_Usage_Backfill::STATUS_COMPLETED === get_option(
			Media_Usage_Backfill::OPT_STATUS,
			Media_Usage_Backfill::STATUS_IDLE
		);
	}
}
