<?php
/**
 * Plugin Name: GoDAM
 * Plugin URI: https://godam.io
 * Description: Seamlessly manage and deliver your media assets directly from the cloud-based media management. Store assets efficiently, stream them via a CDN, and enhance your website's performance and user experience. Featuring adaptive bit rate streaming, adding interactive layers in videos, and taking full advantage of a digital asset management solution within WordPress.
 * Version: 2.2.1
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Text Domain: godam
 * Author: rtCamp
 * Author URI: https://rtcamp.com/?utm_source=dashboard&utm_medium=plugin&utm_campaign=godam
 * Domain Path: /languages
 * License: GPLv2 or later
 * License URI: http://www.gnu.org/licenses/gpl-2.0.html
 *
 * @package GoDAM
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'RTGODAM_PATH' ) ) {
	/**
	 * The server file system path to the plugin directory
	 */
	define( 'RTGODAM_PATH', plugin_dir_path( __FILE__ ) );
}

if ( ! defined( 'RTGODAM_URL' ) ) {
	/**
	 * The url to the plugin directory
	 */
	define( 'RTGODAM_URL', plugin_dir_url( __FILE__ ) );
}

if ( ! defined( 'RTGODAM_BASE_NAME' ) ) {
	/**
	 * The base name of the plugin directory
	 */
	define( 'RTGODAM_BASE_NAME', plugin_basename( __FILE__ ) );
}

if ( ! defined( 'RTGODAM_VERSION' ) ) {
	/**
	 * The version of the plugin
	 */
	define( 'RTGODAM_VERSION', '2.2.1' );
}

if ( ! defined( 'RTGODAM_API_BASE' ) ) {
	define( 'RTGODAM_API_BASE', 'https://app.godam.io' );
}

if ( ! defined( 'RTGODAM_ANALYTICS_BASE' ) ) {
	define( 'RTGODAM_ANALYTICS_BASE', 'https://analytics.godam.io' );
}

if ( ! defined( 'RTGODAM_IO_API_BASE' ) ) {
	define( 'RTGODAM_IO_API_BASE', 'https://godam.io' );
}

if ( ! defined( 'FRAPPE_DISPATCH_SITE_URL' ) ) {
	define( 'FRAPPE_DISPATCH_SITE_URL', 'https://app.godam.io' );
}

require_once RTGODAM_PATH . 'inc/helpers/autoloader.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
require_once RTGODAM_PATH . 'inc/helpers/custom-functions.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
require_once RTGODAM_PATH . 'inc/helpers/class-api-key.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
require_once RTGODAM_PATH . 'admin/godam-transcoder-functions.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
require_once RTGODAM_PATH . 'admin/class-rtgodam-transcoder-admin.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant

require_once plugin_dir_path( __FILE__ ) . 'vendor/woocommerce/action-scheduler/action-scheduler.php';


global $rtgodam_transcoder_admin;

/**
 * Initiate file system.
 */
\RTGODAM\Inc\FileSystem::get_instance();

$rtgodam_transcoder_admin = new RTGODAM_Transcoder_Admin();

/**
 * Initiate blocks.
 */
\RTGODAM\Inc\Plugin::get_instance();

/**
 * Add Settings/Docs link to plugins area.
 *
 * @since 1.1.2
 *
 * @param array  $links Links array in which we would prepend our link.
 * @param string $file Current plugin basename.
 *
 * @return array Processed links.
 */
function rtgodam_action_links( $links, $file ) {
	// Return normal links if not plugin.
	if ( plugin_basename( 'godam/godam.php' ) !== $file ) {
		return $links;
	}

	// Add a few links to the existing links array.
	$settings_url = sprintf(
		'<a href="%1$s">%2$s</a>',
		esc_url( admin_url( 'admin.php?page=rtgodam_settings' ) ),
		esc_html__( 'Settings', 'godam' )
	);

	return array_merge(
		$links,
		array(
			'settings' => $settings_url,
		)
	);
}

add_filter( 'plugin_action_links', 'rtgodam_action_links', 11, 2 );
add_filter( 'network_admin_plugin_action_links', 'rtgodam_action_links', 11, 2 );

/**
 * Runs when the plugin is activated.
 */
function rtgodam_plugin_activate() {
	update_option( 'rtgodam_plugin_activation_time', time() );

	// Flush rewrite rules on activation.
	flush_rewrite_rules( true );
}

register_activation_hook( __FILE__, 'rtgodam_plugin_activate' );

/**
 * Runs when the plugin is deactivated.
 */
function rtgodam_plugin_deactivate() {
	delete_option( 'rtgodam_plugin_activation_time' );
	delete_option( 'rtgodam_video_metadata_migration_completed' );

	// Flush rewrite rules on deactivation.
	flush_rewrite_rules( true );
}

register_deactivation_hook( __FILE__, 'rtgodam_plugin_deactivate' );

/*
 * Plugin-state cleanup on deletion lives in uninstall.php (run in isolation by WordPress),
 * NOT in a register_uninstall_hook() callback. The register_uninstall_hook() path makes
 * WordPress bootstrap this whole file (and load bundled Action Scheduler) during deletion,
 * which then fatals on `shutdown` once the files are gone — see uninstall.php and issue #1146.
 */

/**
 * Prevent a `shutdown` fatal when GoDAM is deleted while active.
 *
 * GoDAM bundles WooCommerce Action Scheduler, whose queue runner registers a `shutdown`
 * callback (`ActionScheduler_QueueRunner::maybe_dispatch_async_request`). Deleting the
 * plugin removes its files mid-request, so on `shutdown` that callback tries to autoload a
 * class from the now-deleted plugin (e.g. `ActionScheduler_Lock`) and throws a fatal. A
 * fatal-catcher such as Query Monitor appends that error to the delete-plugin AJAX body,
 * corrupting the JSON so the admin shows "Deletion failed" even though the plugin was
 * actually removed. `delete_plugin` fires immediately before the files are deleted, so
 * detaching Action Scheduler's shutdown dispatch here avoids the fatal entirely (and the
 * async request it would dispatch is pointless when the plugin is going away). See #1146.
 *
 * @since 2.2.1
 *
 * @param string $plugin_file Plugin being deleted, relative to the plugins directory.
 * @return void
 */
function rtgodam_detach_action_scheduler_on_delete( $plugin_file ) {
	if ( plugin_basename( __FILE__ ) !== $plugin_file ) {
		return;
	}

	if ( ! class_exists( 'ActionScheduler_QueueRunner' ) || ! method_exists( 'ActionScheduler_QueueRunner', 'instance' ) ) {
		return;
	}

	$runner = ActionScheduler_QueueRunner::instance();

	// Prefer Action Scheduler's own API; fall back to removing the hook directly for older
	// versions that predate unhook_dispatch_async_request().
	if ( method_exists( $runner, 'unhook_dispatch_async_request' ) ) {
		$runner->unhook_dispatch_async_request();
	} else {
		remove_action( 'shutdown', array( $runner, 'maybe_dispatch_async_request' ) );
	}
}

add_action( 'delete_plugin', 'rtgodam_detach_action_scheduler_on_delete' );
