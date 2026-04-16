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
 * Each migration class must expose a static maybe_run() method that gates
 * itself behind a WordPress option so it only executes once per site.
 *
 * To add a future migration: instantiate it here and call ::maybe_run().
 * The order of calls determines execution order.
 *
 * Re-running all migrations (e.g. for testing) requires deleting each
 * migration's guard option individually:
 *   wp option delete rtgodam_gallery_v1_v2_migration_done
 *   wp option delete rtgodam_godam_cpt_cleanup_done
 */
class Runner {

	/**
	 * Invoke every registered migration in sequence.
	 *
	 * Called once during plugin bootstrap (Plugin::__construct).
	 *
	 * @return void
	 */
	public static function run() {
		Gallery_V1_To_V2::maybe_run();
		Godam_Cpt_Cleanup::maybe_run();
	}
}
