<?php
/**
 * Plugin Name: GoDAM
 * Plugin URI: https://godam.io
 * Description: Seamlessly manage and deliver your media assets directly from the cloud-based media management. Store assets efficiently, stream them via a CDN, and enhance your website's performance and user experience. Featuring adaptive bit rate streaming, adding interactive layers in videos, and taking full advantage of a digital asset management solution within WordPress.
 * Version: 1.4.9
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
	define( 'RTGODAM_VERSION', '1.4.9' );
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

require_once RTGODAM_PATH . 'inc/helpers/autoloader.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
require_once RTGODAM_PATH . 'inc/helpers/custom-functions.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
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

	// Explicitly register post types to ensure they are available before flushing.
	$godam_video = \RTGODAM\Inc\Post_Types\GoDAM_Video::get_instance();
	$godam_video->register_post_type();

	// Flush rewrite rules to ensure CPT rules are applied.
	flush_rewrite_rules( true );
}

register_activation_hook( __FILE__, 'rtgodam_plugin_activate' );

/**
 * Runs when the plugin is deactivated.
 */
function rtgodam_plugin_deactivate() {
	delete_option( 'rtgodam_plugin_activation_time' );
	delete_option( 'rtgodam_video_metadata_migration_completed' );

	// Flush rewrite rules to remove CPT rules.
	flush_rewrite_rules( true );
}

register_deactivation_hook( __FILE__, 'rtgodam_plugin_deactivate' );

/**
 * Runs when the plugin is deleted.
 *
 * Note: This function is kept for backward compatibility.
 * The main uninstall process is now handled in uninstall.php
 */
function rtgodam_plugin_delete() {
	\RTGODAM\Inc\Uninstall::get_instance()->start_uninstall();
}

register_uninstall_hook( __FILE__, 'rtgodam_plugin_delete' );
