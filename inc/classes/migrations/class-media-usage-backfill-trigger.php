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
 * 2. `maybe_run()` calls {@see Media_Usage_Backfill::start()} (unless the backfill
 *    is already running or finished), which is idempotent: it begins a fresh run,
 *    no-ops an already-pending one, or reschedules a dropped batch.
 * 3. It then returns true as soon as the backfill is kicked off — running, or
 *    finished — so the runner advances the stored version immediately. The
 *    Action Scheduler batch chain (and the Tools page) own progress and
 *    completion from here.
 *
 * This mirrors {@see Godam_Cpt_Cleanup}: the migration is considered done once it
 * has successfully started, *not* once every batch has finished. Returning false
 * for the whole (potentially hours-long) backfill would hold back the stored db
 * version, re-enter start() on every request, and — worse — block any migration
 * keyed after this one until the backfill completed, wedging the runner entirely
 * if the backfill ever stalled.
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
	 * Start the media usage backfill, then report it as done to the runner.
	 *
	 * Returns true once the backfill has been kicked off (running) or finished
	 * (completed, or manually stopped), so the runner advances the stored db
	 * version and does not babysit the long-running batch chain. Returns false
	 * only when Action Scheduler is not yet loaded, so the runner retries on a
	 * later request rather than advancing past an un-started backfill.
	 *
	 * @since 1.13.0
	 *
	 * @return bool True once the backfill is running or finished; false only if it could not be started.
	 */
	public static function maybe_run(): bool {
		$status = get_option( Media_Usage_Backfill::OPT_STATUS, Media_Usage_Backfill::STATUS_IDLE );

		// Already running or finished (a manual Stop from the Tools page is
		// respected — we do not resume it). Nothing more for the migration to do.
		if ( self::is_kicked_off( $status ) ) {
			return true;
		}

		// Backfill batches run on Action Scheduler. If it is not loaded yet,
		// report incomplete so the runner retries on a later request.
		if ( ! function_exists( 'as_enqueue_async_action' ) ) {
			return false;
		}

		// Kicks off the batch chain (or completes immediately when there are no
		// posts to scan). From here Action Scheduler drives it to completion.
		Media_Usage_Backfill::get_instance()->start();

		return self::is_kicked_off( get_option( Media_Usage_Backfill::OPT_STATUS, Media_Usage_Backfill::STATUS_IDLE ) );
	}

	/**
	 * Whether a status means the backfill has been started or finished — i.e. the
	 * runner has nothing left to do and can advance the stored db version.
	 *
	 * @since 1.13.0
	 *
	 * @param string $status Current backfill status option value.
	 * @return bool
	 */
	private static function is_kicked_off( string $status ): bool {
		return in_array(
			$status,
			array(
				Media_Usage_Backfill::STATUS_RUNNING,
				Media_Usage_Backfill::STATUS_COMPLETED,
				Media_Usage_Backfill::STATUS_STOPPED,
			),
			true
		);
	}
}
