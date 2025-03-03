<?php
/**
 * Plugin Name: DAM
 * Plugin URI: https://godam.io
 * Description: Seamlessly manage and optimize digital assets with GoDAM – featuring transcoding, adaptive streaming, interactive video layers, gravity forms integration, and ad integration.
 * Version: 1.0.0
 * Text Domain: godam
 * Author: rtCamp
 * Author URI: https://rtcamp.com/?utm_source=dashboard&utm_medium=plugin&utm_campaign=godam
 * Domain Path: /languages/
 * License: GPLv2 or later
 * License URI: http://www.gnu.org/licenses/gpl-2.0.html
 *
 * @package GoDAM
 */

if ( ! defined( 'GODAM_PATH' ) ) {
	/**
	 * The server file system path to the plugin directory
	 */
	define( 'GODAM_PATH', plugin_dir_path( __FILE__ ) );
}

if ( ! defined( 'GODAM_URL' ) ) {
	/**
	 * The url to the plugin directory
	 */
	define( 'GODAM_URL', plugin_dir_url( __FILE__ ) );
}

if ( ! defined( 'GODAM_BASE_NAME' ) ) {
	/**
	 * The base name of the plugin directory
	 */
	define( 'GODAM_BASE_NAME', plugin_basename( __FILE__ ) );
}

if ( ! defined( 'GODAM_VERSION' ) ) {
	/**
	 * The version of the plugin
	 */
	define( 'GODAM_VERSION', '1.0.0' );
}

if ( ! defined( 'GODAM_NO_MAIL' ) && defined( 'VIP_GO_APP_ENVIRONMENT' ) ) {
	define( 'GODAM_NO_MAIL', true );
}

if ( ! defined( 'GODAM_API_BASE' ) ) {
	define( 'GODAM_API_BASE', 'https://app.godam.io' );
}

if ( ! defined( 'GODAM_ANALYTICS_BASE' ) ) {
	define( 'GODAM_ANALYTICS_BASE', 'https://analytics.godam.io' );
}

if ( ! defined( 'GODAMIO_API_BASE' ) ) {
	define( 'GODAMIO_API_BASE', 'https://godam.io' );
}

require_once GODAM_PATH . 'inc/helpers/autoloader.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
require_once GODAM_PATH . 'inc/helpers/custom-functions.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
require_once GODAM_PATH . 'admin/godam-transcoder-functions.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
require_once GODAM_PATH . 'admin/godam-transcoder-admin.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant

global $rt_transcoder_admin;

/**
 * Initiate file system.
 */
\Transcoder\Inc\FileSystem::get_instance();

$rt_transcoder_admin = new RT_Transcoder_Admin();

/**
 * Initiate blocks.
 */
\Transcoder\Inc\Plugin::get_instance();

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
function rtt_action_links( $links, $file ) {
	// Return normal links if not plugin.
	if ( plugin_basename( 'godam/godam.php' ) !== $file ) {
		return $links;
	}

	// Add a few links to the existing links array.
	$settings_url = sprintf(
		'<a href="%1$s">%2$s</a>',
		esc_url( admin_url( 'admin.php?page=godam' ) ),
		esc_html__( 'Settings', 'godam' )
	);

	return array_merge(
		$links,
		array(
			'settings' => $settings_url,
		)
	);
}

add_filter( 'plugin_action_links', 'rtt_action_links', 11, 2 );
add_filter( 'network_admin_plugin_action_links', 'rtt_action_links', 11, 2 );

/**
 * Autoloader for the vendor directory.
 */
require GODAM_PATH . 'vendor/autoload.php';

/**
 * Runs when the plugin is activated.
 */
function godam_plugin_activate() {
	update_site_option( 'godam_plugin_activation_time', time() );
}
register_activation_hook( __FILE__, 'godam_plugin_activate' );

/**
 * Runs when the plugin is deactivated.
 */
function godam_plugin_deactivate() {
	\Transcoder\Inc\Cron::get_instance()->unschedule_video_cleanup();
	delete_site_option( 'godam_plugin_activation_time' );
}
register_deactivation_hook( __FILE__, 'godam_plugin_deactivate' );