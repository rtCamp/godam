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
 * ## Multisite performance
 *
 * Iterating every subsite on every request would be extremely expensive at scale
 * (50 sites = 50× switch_to_blog + 50× option read per request). To avoid this,
 * the runner stores a network-wide option (DB_VERSION_NETWORK_OPTION) once every
 * subsite has been fully migrated. Subsequent requests do a single
 * get_network_option() call — which is object-cache backed and essentially free —
 * and return immediately. The loop only runs again after a plugin update raises
 * RTGODAM_VERSION above the stored network version.
 *
 * ## Re-running migrations (e.g. for testing)
 *
 * Single-site:
 *   wp option delete rtgodam_db_version
 *   wp option delete rtgodam_gallery_v1_v2_migration_done
 *   wp option delete rtgodam_godam_cpt_cleanup_done
 *
 * Multisite (also clear the network-level fast-path flag):
 *   wp network meta delete 1 rtgodam_db_version_network
 *   Then for each subsite (e.g. example.com, sub.example.com):
 *   wp option --url=example.com delete rtgodam_db_version
 *   wp option --url=example.com delete rtgodam_gallery_v1_v2_migration_done
 *   wp option --url=example.com delete rtgodam_godam_cpt_cleanup_done
 *   wp option --url=sub.example.com delete rtgodam_db_version
 *   wp option --url=sub.example.com delete rtgodam_gallery_v1_v2_migration_done
 *   wp option --url=sub.example.com delete rtgodam_godam_cpt_cleanup_done
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
	 * Network option key used as a fast-path gate on multisite.
	 *
	 * Set to RTGODAM_VERSION once every subsite has been fully migrated.
	 * Stored in wp_sitemeta; object-cache backed on most hosts, making the
	 * per-request check essentially free.
	 *
	 * Reset command: wp network meta delete 1 rtgodam_db_version_network
	 *
	 * @var string
	 */
	const DB_VERSION_NETWORK_OPTION = 'rtgodam_db_version_network';

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
	 * Also registers the migration trigger on init, which fires on every
	 * request (frontend, admin, REST, AJAX, WP-Cron) so pending migrations
	 * are not blocked behind an admin page visit. The version compare gate
	 * ensures this is a single option read on requests where no migrations
	 * are pending.
	 *
	 * @return void
	 */
	public static function init(): void {
		Godam_Cpt_Cleanup::register_hooks();
		Godam_Cpt_Cleanup::register_redirect_hooks();

		// Trigger pending migrations on every request after version changes.
		add_action( 'init', array( self::class, 'maybe_run' ) );
	}

	/**
	 * Trigger pending migrations when the plugin version has changed.
	 *
	 * Hooked to init so migrations fire on every request type — frontend,
	 * admin, REST, AJAX, and WP-Cron — without requiring an admin page visit.
	 * The version compare gate keeps per-request overhead to a single option
	 * read once migrations are complete.
	 *
	 * On multisite, iterates every registered site using switch_to_blog() so
	 * that all subsites are migrated when any request loads — regardless of
	 * which subsite the current request targets. Each site tracks its own
	 * DB_VERSION_OPTION, so the version compare gate is evaluated independently
	 * per site.
	 *
	 * @return void
	 */
	public static function maybe_run(): void {
		if ( is_multisite() ) {
			// Fast-path: a single network option read (object-cache backed) so that
			// requests on fully-migrated networks avoid the expensive get_sites()
			// loop entirely. The version compare naturally re-enables the loop after
			// every plugin update that raises RTGODAM_VERSION.
			$network_version = get_network_option( null, self::DB_VERSION_NETWORK_OPTION, '' );
			if ( version_compare( $network_version, RTGODAM_VERSION, '>=' ) ) {
				return;
			}

			$site_ids = get_sites(
				array(
					'fields' => 'ids',
					'number' => 0,
				)
			);

			$all_done = true;
			foreach ( $site_ids as $site_id ) {
				switch_to_blog( $site_id );
				self::run_for_current_site();
				// get_option() is object-cache backed here; the value was already
				// loaded by run_for_current_site(), so this is effectively free.
				if ( version_compare( get_option( self::DB_VERSION_OPTION, '' ), RTGODAM_VERSION, '<' ) ) {
					$all_done = false;
				}
				restore_current_blog();
			}

			// Once every subsite is fully migrated, stamp the network option so
			// all future requests skip this loop via the fast-path gate above.
			if ( $all_done ) {
				update_network_option( null, self::DB_VERSION_NETWORK_OPTION, RTGODAM_VERSION );
			}

			return;
		}

		self::run_for_current_site();
	}

	/**
	 * Run pending migrations for the site that is currently active.
	 *
	 * The version compare is the sole gate — if the stored version equals the
	 * current plugin version, this is a single option read and returns immediately
	 * with no per-migration overhead.
	 *
	 * The runner only advances the stored DB version for a given version-batch
	 * when every migration class in that batch returns true from maybe_run().
	 * If any migration bails (e.g. the concurrency lock is held), the runner
	 * stops without bumping the stored version so the whole batch retries
	 * on the next qualifying init.
	 *
	 * @return void
	 */
	private static function run_for_current_site(): void {
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
				// the entire batch retries on the next qualifying init.
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
