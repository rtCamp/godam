<?php
/**
 * Plugin Name: GoDAM
 * Plugin URI: https://rtmedia.io/transcoder/?utm_source=dashboard&utm_medium=plugin&utm_campaign=transcoder
 * Description: Audio & video transcoding services for ANY WordPress website. Allows you to convert audio/video files of any format to a web-friendly format (mp3/mp4).
 * Version: 1.3.6
 * Text Domain: transcoder
 * Author: rtCamp
 * Author URI: https://rtcamp.com/?utm_source=dashboard&utm_medium=plugin&utm_campaign=transcoder
 * Domain Path: /languages/
 * License: GPLv2 or later
 * License URI: http://www.gnu.org/licenses/gpl-2.0.html
 *
 * @package GoDAM
 */

if ( ! defined( 'RT_TRANSCODER_PATH' ) ) {
	/**
	 * The server file system path to the plugin directory
	 */
	define( 'RT_TRANSCODER_PATH', plugin_dir_path( __FILE__ ) );
}

if ( ! defined( 'RT_TRANSCODER_URL' ) ) {
	/**
	 * The url to the plugin directory
	 */
	define( 'RT_TRANSCODER_URL', plugin_dir_url( __FILE__ ) );
}

if ( ! defined( 'RT_TRANSCODER_BASE_NAME' ) ) {
	/**
	 * The base name of the plugin directory
	 */
	define( 'RT_TRANSCODER_BASE_NAME', plugin_basename( __FILE__ ) );
}

if ( ! defined( 'RT_TRANSCODER_VERSION' ) ) {
	/**
	 * The version of the plugin
	 */
	define( 'RT_TRANSCODER_VERSION', '1.3.6' );
}

if ( ! defined( 'RT_TRANSCODER_NO_MAIL' ) && defined( 'VIP_GO_APP_ENVIRONMENT' ) ) {
	define( 'RT_TRANSCODER_NO_MAIL', true );
}

require_once RT_TRANSCODER_PATH . 'inc/helpers/autoloader.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
require_once RT_TRANSCODER_PATH . 'inc/helpers/custom-functions.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
require_once RT_TRANSCODER_PATH . 'admin/rt-transcoder-functions.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
require_once RT_TRANSCODER_PATH . 'admin/rt-transcoder-admin.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant

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
	if ( plugin_basename( 'transcoder/rt-transcoder.php' ) !== $file ) {
		return $links;
	}

	// Add a few links to the existing links array.
	$settings_url = sprintf(
		'<a href="%1$s">%2$s</a>',
		esc_url( admin_url( 'admin.php?page=rt-transcoder' ) ),
		esc_html__( 'Settings', 'transcoder' )
	);

	$docs_url = sprintf(
		'<a target="_blank" href="https://rtmedia.io/docs/transcoder/">%1$s</a>',
		esc_html__( 'Docs', 'transcoder' )
	);

	return array_merge(
		$links,
		array(
			'settings' => $settings_url,
			'docs'     => $docs_url,
		)
	);
}

add_filter( 'plugin_action_links', 'rtt_action_links', 11, 2 );
add_filter( 'network_admin_plugin_action_links', 'rtt_action_links', 11, 2 );

/**
 * Autoloader for the vendor directory.
 */
require RT_TRANSCODER_PATH . 'vendor/autoload.php';
