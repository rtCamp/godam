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
 * Migrations are triggered only when the stored database version is lower than
 * the current plugin version — i.e. on fresh installs and after plugin updates.
 * The runner iterates the version-keyed $migrations map and executes only the
 * classes whose key version is newer than the stored version. All other requests
 * return after a single option read with no per-migration overhead.
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
 * 3. Add it to the $migrations array below, keyed by the plugin version it ships in.
 *    Multiple classes can share the same version key.
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
	 * Absent on fresh installs; updated incrementally as each version's migrations
	 * complete, then set to RTGODAM_VERSION at the end of a full pass.
	 *
	 * @var string
	 */
	const DB_VERSION_OPTION = 'rtgodam_db_version';

	/**
	 * Version-keyed migration map.
	 *
	 * Each key is the plugin version that introduced the migration(s).
	 * Each value is an array of fully-qualified class names with a static
	 * maybe_run() method. Entries must be ordered from oldest to newest version
	 * so incremental updates are applied in the correct sequence.
	 *
	 * To add a new migration, append an entry for the version it ships in:
	 *
	 *   '1.8.0' => [ My_New_Migration::class ],
	 *
	 * @var array<string, class-string[]>
	 */
	private static $migrations = array(
		'1.8.0' => array(
			Gallery_V1_To_V2::class,
			Godam_Cpt_Cleanup::class,
		),
	);

	/**
	 * Register persistent callbacks that must be present on every request.
	 *
	 * Called unconditionally during plugin bootstrap so that Action Scheduler
	 * can fire queued batch jobs on any request, independent of whether a
	 * migration is currently pending.
	 *
	 * Also registers the migration trigger on admin_init, which fires on every
	 * admin page load where is_admin() is guaranteed and auth functions are
	 * available. The version compare gate ensures this is a single option read
	 * on requests where no migrations are pending.
	 *
	 * @return void
	 */
	public static function init(): void {
		Godam_Cpt_Cleanup::register_hooks();

		// Trigger pending migrations on admin page loads after version changes.
		add_action( 'admin_init', array( self::class, 'maybe_run' ) );
	}

	/**
	 * Trigger pending migrations when the plugin version has changed.
	 *
	 * Hooked to admin_init by Plugin::__construct(), mirroring RankMath's
	 * pattern. admin_init fires on every admin page load so is_admin() is
	 * guaranteed and auth functions (is_user_logged_in, current_user_can)
	 * are available. The version compare is the sole gate — if stored version
	 * equals current version, this is a single option read and returns.
	 *
	 * The runner only advances the stored DB version for a given version-batch
	 * when every migration class in that batch returns true from maybe_run().
	 * If any migration bails (e.g. the current user lacks manage_options), the
	 * runner stops without bumping the stored version so the whole batch retries
	 * on the next qualifying admin_init.
	 *
	 * @return void
	 */
	public static function maybe_run(): void {
		$installed_version = get_option( self::DB_VERSION_OPTION, '' );
		if ( version_compare( $installed_version, RTGODAM_VERSION, '>=' ) ) {
			return;
		}

		foreach ( self::$migrations as $version => $classes ) {
			if ( version_compare( $installed_version, $version, '>=' ) ) {
				continue;
			}

			$all_complete = true;
			foreach ( $classes as $class ) {
				if ( ! $class::maybe_run() ) {
					$all_complete = false;
				}
			}

			if ( ! $all_complete ) {
				// At least one migration bailed — hold the stored version so
				// the entire batch retries on the next qualifying admin_init.
				return;
			}

			// Advance the stored version after each batch so that if the
			// request dies mid-pass, the next request resumes from here.
			update_option( self::DB_VERSION_OPTION, $version, false );
		}

		// Final bump to the current plugin version so the outer guard short-
		// circuits on all subsequent requests, even when no migration key
		// matches the exact current version.
		update_option( self::DB_VERSION_OPTION, RTGODAM_VERSION, false );
	}
}
