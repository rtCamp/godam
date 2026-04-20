<?php
/**
 * WooCommerce Utility Class for GoDAM for Woo.
 *
 * @package GoDAM_Woo
 * @since 1.0.0
 */

namespace GoDAM_Woo\Classes;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class WC_Utility
 */
class WC_Utility {

	use Singleton;

	/**
	 * Returns an inline SVG for a partially-filled star at the given fill percentage.
	 *
	 * @param float $percent Fill percentage (0–100).
	 * @return string Sanitized SVG markup.
	 */
	public function get_partial_star_svg( $percent ) {
		$percent   = max( 0, min( 100, (float) $percent ) );
		$unique_id = 'godam-partial-' . wp_unique_id();

		$svg = sprintf(
			'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">'
			. '<defs>'
			. '<linearGradient id="%1$s" x1="0" y1="0" x2="1" y2="0">'
			. '<stop offset="%2$s%%" stop-color="#f0a500"/>'
			. '<stop offset="%2$s%%" stop-color="#cccccc"/>'
			. '</linearGradient>'
			. '</defs>'
			. '<path fill="url(#%1$s)" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>'
			. '</svg>',
			esc_attr( $unique_id ),
			esc_attr( number_format( $percent, 2, '.', '' ) )
		);

		return wp_kses(
			$svg,
			array(
				'svg'            => array(
					'xmlns'       => true,
					'width'       => true,
					'height'      => true,
					'viewbox'     => true,
					'aria-hidden' => true,
				),
				'defs'           => array(),
				'linearGradient' => array(
					'id' => true,
					'x1' => true,
					'y1' => true,
					'x2' => true,
					'y2' => true,
				),
				'stop'           => array(
					'offset'     => true,
					'stop-color' => true,
				),
				'path'           => array(
					'fill' => true,
					'd'    => true,
				),
			)
		);
	}

	/**
	 * Returns the list of allowed SVG tags and attributes for use with wp_kses().
	 *
	 * @return array
	 */
	public function svg_args_on_wp_kses() {
		return array(
			'svg'            => array(
				'class'           => true,
				'aria-hidden'     => true,
				'aria-labelledby' => true,
				'role'            => true,
				'xmlns'           => true,
				'width'           => true,
				'height'          => true,
				'viewbox'         => true,
				'fill'            => true,
				'stroke'          => true,
				'stroke-width'    => true,
				'stroke-linecap'  => true,
				'stroke-linejoin' => true,
			),
			'g'              => array(
				'fill'            => true,
				'stroke'          => true,
				'stroke-width'    => true,
				'stroke-linecap'  => true,
				'stroke-linejoin' => true,
			),
			'title'          => array( 'title' => true ),
			'path'           => array(
				'd'               => true,
				'fill'            => true,
				'stroke'          => true,
				'stroke-width'    => true,
				'stroke-linecap'  => true,
				'stroke-linejoin' => true,
				'transform'       => true,
			),
			'rect'           => array(
				'x'            => true,
				'y'            => true,
				'width'        => true,
				'height'       => true,
				'rx'           => true,
				'ry'           => true,
				'fill'         => true,
				'stroke'       => true,
				'stroke-width' => true,
			),
			'circle'         => array(
				'cx'           => true,
				'cy'           => true,
				'r'            => true,
				'fill'         => true,
				'stroke'       => true,
				'stroke-width' => true,
			),
			'ellipse'        => array(
				'cx'           => true,
				'cy'           => true,
				'rx'           => true,
				'ry'           => true,
				'fill'         => true,
				'stroke'       => true,
				'stroke-width' => true,
			),
			'line'           => array(
				'x1'           => true,
				'y1'           => true,
				'x2'           => true,
				'y2'           => true,
				'stroke'       => true,
				'stroke-width' => true,
			),
			'polyline'       => array(
				'points'       => true,
				'fill'         => true,
				'stroke'       => true,
				'stroke-width' => true,
			),
			'polygon'        => array(
				'points'       => true,
				'fill'         => true,
				'stroke'       => true,
				'stroke-width' => true,
			),
			'text'           => array(
				'x'           => true,
				'y'           => true,
				'dx'          => true,
				'dy'          => true,
				'text-anchor' => true,
				'fill'        => true,
				'stroke'      => true,
				'font-size'   => true,
				'font-family' => true,
				'font-weight' => true,
			),
			'tspan'          => array(
				'x'  => true,
				'y'  => true,
				'dx' => true,
				'dy' => true,
			),
			'defs'           => array(),
			'linearGradient' => array(
				'id'            => true,
				'x1'            => true,
				'y1'            => true,
				'x2'            => true,
				'y2'            => true,
				'gradientUnits' => true,
			),
			'radialGradient' => array(
				'id'            => true,
				'cx'            => true,
				'cy'            => true,
				'r'             => true,
				'fx'            => true,
				'fy'            => true,
				'gradientUnits' => true,
			),
			'stop'           => array(
				'offset'       => true,
				'stop-color'   => true,
				'stop-opacity' => true,
			),
			'use'            => array(
				'href'       => true,
				'xlink:href' => true,
				'x'          => true,
				'y'          => true,
				'width'      => true,
				'height'     => true,
			),
			'symbol'         => array(
				'id'      => true,
				'viewBox' => true,
			),
			'clipPath'       => array( 'id' => true ),
			'mask'           => array( 'id' => true ),
			'pattern'        => array(
				'id'           => true,
				'x'            => true,
				'y'            => true,
				'width'        => true,
				'height'       => true,
				'patternUnits' => true,
			),
			'image'          => array(
				'href'       => true,
				'xlink:href' => true,
				'x'          => true,
				'y'          => true,
				'width'      => true,
				'height'     => true,
			),
		);
	}

	/**
	 * AJAX callback to fetch and return a sidebar single product's HTML content.
	 *
	 * @return void
	 */
	public function godam_get_single_sidebar_product_html_callback() {

		$nonce = isset( $_GET['_wpnonce'] )
			? sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) )
			: '';

		if ( ! wp_verify_nonce( $nonce, 'godam_get_single_sidebar_product_html' ) ) {
			wp_send_json_error( 'Invalid request.', 400 );
		}

		if ( empty( $_GET['product_id'] ) ) {
			wp_send_json_error( 'Missing product ID', 400 );
		}

		$product_id = absint( $_GET['product_id'] );
		$product    = wc_get_product( $product_id );

		if ( ! $product ) {
			wp_send_json_error( 'Invalid product.', 400 );
		}

		ob_start();

		$toggle_label = __( 'Product Details', 'godam-woo' );
		$utility      = $this;

		include GODAM_WOO_PATH . 'templates/sidebar/hero-product.php';
		include GODAM_WOO_PATH . 'templates/sidebar/single-product-details.php';

		$html = ob_get_clean();

		wp_send_json_success( $html );
	}
}
