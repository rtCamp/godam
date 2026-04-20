<?php
/**
 * GoDAM Woo Add-on class.
 *
 * Extends the GoDAM add-on abstract class to provide WooCommerce integration.
 *
 * @package GoDAM_Woo
 * @since 1.0.0
 */

namespace GoDAM_Woo;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Addons\Abstract_Addon;

/**
 * Class Godam_Woo_Addon.
 */
class Godam_Woo_Addon extends Abstract_Addon {

	/**
	 * Get add-on slug.
	 *
	 * @return string
	 */
	public function get_slug() {
		return 'godam-woo';
	}

	/**
	 * Get add-on name.
	 *
	 * @return string
	 */
	public function get_name() {
		return __( 'GoDAM for Woo', 'godam-woo' );
	}

	/**
	 * Get add-on version.
	 *
	 * @return string
	 */
	public function get_version() {
		return GODAM_WOO_VERSION;
	}

	/**
	 * Get add-on path.
	 *
	 * @return string
	 */
	public function get_path() {
		return GODAM_WOO_PATH;
	}

	/**
	 * Get add-on URL.
	 *
	 * @return string
	 */
	public function get_url() {
		return GODAM_WOO_URL;
	}

	/**
	 * Minimum required GoDAM version.
	 *
	 * @return string
	 */
	public function get_minimum_godam_version() {
		return GODAM_WOO_MIN_GODAM_VERSION;
	}

	/**
	 * Dependency checks.
	 *
	 * @return array
	 */
	public function get_dependencies() {
		return array(
			array(
				'name'    => 'WooCommerce',
				'check'   => function () {
					return class_exists( 'WooCommerce' );
				},
				'message' => sprintf(
					/* translators: 1: Opening link tag, 2: Closing link tag */
					__( '<strong>GoDAM for Woo</strong> requires %1$sWooCommerce%2$s to be installed and activated.', 'godam-woo' ),
					'<a href="https://wordpress.org/plugins/woocommerce/" target="_blank" rel="noopener noreferrer">',
					'</a>'
				),
			),
		);
	}

	/**
	 * Boot the add-on: load files, register hooks, etc.
	 *
	 * @return void
	 */
	public function boot() {
		// Check if the admin has disabled the WooCommerce integration in GoDAM settings.
		$settings = get_option( 'rtgodam-settings', array() );
		$enabled  = $settings['integrations']['woocommerce']['enable'] ?? true;

		if ( false === $enabled ) {
			return;
		}

		require_once GODAM_WOO_PATH . 'inc/class-bootstrap.php';
		Bootstrap::get_instance();
	}
}
