<?php
/**
 * Plugin Name: GoDAM for Woo
 * Plugin URI: https://godam.io
 * Description: WooCommerce integration add-on for GoDAM. Adds product video galleries, featured video support, product hotspot layers, and video-product gallery blocks to your WooCommerce store.
 * Version: 1.0.0
 * Requires at least: 6.5
 * Requires PHP: 7.4
 * Text Domain: godam-woo
 * Author: rtCamp
 * Author URI: https://rtcamp.com/?utm_source=dashboard&utm_medium=plugin&utm_campaign=godam-woo
 * Domain Path: /languages
 * License: GPLv2 or later
 * License URI: http://www.gnu.org/licenses/gpl-2.0.html
 * Requires Plugins: godam, woocommerce
 *
 * @package GoDAM_Woo
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'GODAM_WOO_VERSION' ) ) {
	define( 'GODAM_WOO_VERSION', '1.0.0' );
}

if ( ! defined( 'GODAM_WOO_PATH' ) ) {
	define( 'GODAM_WOO_PATH', plugin_dir_path( __FILE__ ) );
}

if ( ! defined( 'GODAM_WOO_URL' ) ) {
	define( 'GODAM_WOO_URL', plugin_dir_url( __FILE__ ) );
}

if ( ! defined( 'GODAM_WOO_BASE_NAME' ) ) {
	define( 'GODAM_WOO_BASE_NAME', plugin_basename( __FILE__ ) );
}

if ( ! defined( 'GODAM_WOO_MIN_GODAM_VERSION' ) ) {
	define( 'GODAM_WOO_MIN_GODAM_VERSION', '1.7.0' );
}

/**
 * Register the add-on with GoDAM's add-on system.
 *
 * @param \RTGODAM\Inc\Addons\Addon_Registry $registry The add-on registry instance.
 */
function godam_woo_register_addon( $registry ) {
	require_once GODAM_WOO_PATH . 'inc/class-godam-woo-addon.php';
	$registry->register( new \GoDAM_Woo\Godam_Woo_Addon() );
}

add_action( 'godam_register_addons', 'godam_woo_register_addon' );

/**
 * Show admin notice if GoDAM is not active.
 */
function godam_woo_missing_godam_notice() {
	if ( ! class_exists( 'RTGODAM\Inc\Addons\Addon_Registry' ) ) {
		printf(
			'<div class="notice notice-error"><p>%s</p></div>',
			wp_kses_post(
				sprintf(
					/* translators: 1: Opening link tag, 2: Closing link tag */
					__( '<strong>GoDAM for Woo</strong> requires the %1$sGoDAM%2$s plugin to be installed and activated.', 'godam-woo' ),
					'<a href="https://wordpress.org/plugins/godam/" target="_blank" rel="noopener noreferrer">',
					'</a>'
				)
			)
		);
	}
}

add_action( 'admin_notices', 'godam_woo_missing_godam_notice' );

/**
 * Plugin activation hook.
 */
function godam_woo_activate() {
	flush_rewrite_rules( true );
}

register_activation_hook( __FILE__, 'godam_woo_activate' );

/**
 * Plugin deactivation hook.
 */
function godam_woo_deactivate() {
	flush_rewrite_rules( true );
}

register_deactivation_hook( __FILE__, 'godam_woo_deactivate' );
