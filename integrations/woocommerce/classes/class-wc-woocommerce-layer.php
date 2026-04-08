<?php
/**
 * WooCommerce Layer Integration
 *
 * This class is responsible for synchronizing WooCommerce product data
 * with video hotspots stored in attachments. Whenever a product is
 * updated or its stock changes, the relevant product details in all
 * related video hotspots are updated automatically.
 *
 * @package RTGODAM
 */

namespace RTGODAM\Inc\WooCommerce;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class WC_Woocommerce_Layer
 */
class WC_Woocommerce_Layer {

	use Singleton;

	/**
	 * Constructor - hook into enqueue scripts.
	 */
	public function __construct() {
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_frontend_assets' ) );
	}

	/**
	 * Enqueue frontend JavaScript assets for the WooCommerce Layer Product Hotspots.
	 *
	 * The script is enqueued only on the cart page
	 *
	 * @since 1.0.0
	 *
	 * @return void
	 */
	public function enqueue_frontend_assets() {
		if ( ! function_exists( 'is_cart' ) || ! is_cart() ) {
			return;
		}

		$script_path = RTGODAM_PATH . 'assets/build/integrations/woocommerce/js/wc-woo-layer-cart-url-editor.min.js';

		if ( ! file_exists( $script_path ) ) {
			return;
		}

		wp_enqueue_script(
			'rtgodam-wc-woo-layer-cart-url-editor',
			RTGODAM_URL . 'assets/build/integrations/woocommerce/js/wc-woo-layer-cart-url-editor.min.js',
			array( 'jquery' ),
			rtgodam_wc_get_asset_version( $script_path ),
			true
		);
	}
}
