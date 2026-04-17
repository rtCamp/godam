<?php
/**
 * GoDAM Migrations Runner.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Migrations;

defined( 'ABSPATH' ) || exit;

/**
 * Coordinates all one-time content and database migrations.
 *
 * ## Execution model
 *
 * Migrations are triggered only when the stored database version differs from
 * the current plugin version — i.e. on fresh installs and after plugin updates.
 * All other requests return after a single option read with no per-migration
 * overhead.
 *
 * ## Persistent hooks
 *
 * Some migrations (e.g. Godam_Cpt_Cleanup) use Action Scheduler for async
 * batch processing. Their AS callbacks must be registered on every request so
 * Action Scheduler can fire them even when no migration is pending. Runner::init()
 * handles this unconditionally, separate from the version-gated trigger.
 *
 * ## Adding a future migration
 *
 * 1. Create a migration class in this namespace with a static maybe_run().
 * 2. If it uses Action Scheduler, add a register_hooks() call inside init().
 * 3. Call its maybe_run() inside maybe_run() below.
 *
 * ## Re-running migrations (e.g. for testing)
 *
 *   wp option delete rtgodam_db_version
 *   wp option delete rtgodam_gallery_v1_v2_migration_done
 *   wp option delete rtgodam_godam_cpt_cleanup_done
 */
class Runner {

	/**
	 * WordPress option key storing the plugin version migrations last ran against.
	 *
	 * Absent on fresh installs; updated to RTGODAM_VERSION after each migration
	 * pass so subsequent requests skip the migration block entirely.
	 *
	 * @var string
	 */
	const DB_VERSION_OPTION = 'rtgodam_db_version';

	/**
	 * Register persistent callbacks that must be present on every request.
	 *
	 * Called unconditionally during plugin bootstrap so that Action Scheduler
	 * can fire queued batch jobs on any request, independent of whether a
	 * migration is currently pending.
	 *
	 * @return void
	 */
	public static function init(): void {
		Godam_Cpt_Cleanup::register_hooks();
	}

	/**
	 * Trigger pending migrations when the plugin version has changed.
	 *
	 * Compares the stored database version against RTGODAM_VERSION. When they
	 * differ (fresh install or update), each migration's maybe_run() is invoked
	 * and the stored version is advanced. On every subsequent request this method
	 * exits after a single option read, adding negligible overhead.
	 *
	 * @return void
	 */
	public static function maybe_run(): void {
		$installed_version = get_option( self::DB_VERSION_OPTION, '' );

		if ( version_compare( $installed_version, RTGODAM_VERSION, '>=' ) ) {
			return;
		}

		Gallery_V1_To_V2::maybe_run();
		Godam_Cpt_Cleanup::maybe_run();

		// Advance the stored version so this block is skipped on subsequent
		// requests. Individual migration guard options remain as idempotency
		// safeguards and track per-migration completion state independently.
		update_option( self::DB_VERSION_OPTION, RTGODAM_VERSION, false );
	}
}
