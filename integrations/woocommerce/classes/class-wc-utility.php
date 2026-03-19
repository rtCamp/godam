<?php
/**
 * WooCommerce Utility Class
 *
 * Provides helper methods related to WooCommerce functionality.
 *
 * This class follows the Singleton pattern and is part of the RTGODAM plugin's WooCommerce integration.
 *
 * @package RTGODAM
 * @since 1.5.0
 */

namespace RTGODAM\Inc\WooCommerce;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class WC_Utility
 *
 * A utility class for WooCommerce-integration-related helper functions.
 */
class WC_Utility {

	use Singleton;

	/**
	 * Helper function: Converts a hex color code to an RGB or RGBA string.
	 *
	 * This function handles hex codes in the following formats:
	 * - 8-digit hex (e.g., #RRGGBBAA) → returns `rgba(r, g, b, a)`
	 * - 6-digit hex (e.g., #RRGGBB)   → returns `rgb(r, g, b)`
	 * - If the input is already in `rgb(...)` or `rgba(...)` format, it is returned as-is.
	 * - Any other format is returned with the '#' prefix unchanged.
	 *
	 * @param string $hex The color value in hex, rgb, or rgba format.
	 * @return string The color value converted to `rgb(...)`, `rgba(...)`, or unchanged.
	 */
	public function hex_to_rgba( $hex ) {

		// If already in rgba or rgb format, return as is.
		if ( strpos( $hex, 'rgba' ) === 0 || strpos( $hex, 'rgb' ) === 0 ) {
			return $hex;
		}

		$hex = str_replace( '#', '', $hex );

		if ( strlen( $hex ) === 8 ) {
			$r = hexdec( substr( $hex, 0, 2 ) );
			$g = hexdec( substr( $hex, 2, 2 ) );
			$b = hexdec( substr( $hex, 4, 2 ) );
			$a = hexdec( substr( $hex, 6, 2 ) ) / 255;
			return "rgba({$r}, {$g}, {$b}, {$a})";
		}

		if ( strlen( $hex ) === 6 ) {
			$r = hexdec( substr( $hex, 0, 2 ) );
			$g = hexdec( substr( $hex, 2, 2 ) );
			$b = hexdec( substr( $hex, 4, 2 ) );
			return "rgb({$r}, {$g}, {$b})";
		}

		return "#{$hex}";
	}

	/**
	 * Sanitize a CSS unit value.
	 *
	 * Allows only numeric values with valid CSS units:
	 * px, em, rem, %
	 *
	 * Prevents CSS injection by rejecting arbitrary strings.
	 *
	 * Examples of allowed values:
	 * - 1px
	 * - 0.5rem
	 * - 100%
	 * - 2em
	 *
	 * @param string $value   The CSS value to sanitize.
	 *
	 * @return string Sanitized CSS unit value or default fallback.
	 */
	public function sanitize_css_unit( $value ) {
		return preg_match( '/^\d+(\.\d+)?(px|em|rem|%)$/', $value )
			? $value
			: '1px';
	}

	/**
	 * Sanitize a CSS color value.
	 *
	 * Supports the following formats:
	 * - 3-digit hex  (#fff)
	 * - 4-digit hex  (#ffff)
	 * - 6-digit hex  (#ffffff)
	 * - 8-digit hex  (#ffffffff)
	 * - rgb()        (rgb(255,255,255))
	 * - rgba()       (rgba(255,255,255,0.5))
	 *
	 * Prevents invalid CSS injection by validating allowed color formats only.
	 *
	 * @param string $color   The color value to sanitize.
	 *
	 * @return string Sanitized color value or default fallback.
	 */
	public function sanitize_color( $color ) {
		$color = trim( $color );

		// Hex.
		if ( preg_match( '/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/', $color ) ) {
			return $color;
		}

		// rgb / rgba.
		if ( preg_match(
			'/^rgba?\(\s*' .
			'(\d{1,3})\s*,\s*' .
			'(\d{1,3})\s*,\s*' .
			'(\d{1,3})' .
			'(\s*,\s*(0|1|0?\.\d+))?' .
			'\s*\)$/',
			$color
		) ) {
			return $color;
		}

		return 'rgba(0,0,0,1)';
	}

	/**
	 * Generates an SVG markup string for a partially filled star.
	 *
	 * This method creates a star icon where the fill is determined by the
	 * given percentage. A linear gradient is applied, filling the star
	 * with gold (#FFC107) up to the specified percentage and light gray
	 * (#e0e0e0) for the remaining portion.
	 *
	 * @param int|float $percentage Percentage of the star to fill (0–100).
	 * @return string SVG markup for the partially filled star.
	 */
	public function get_partial_star_svg( $percentage ) {
		return '
		<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24">
			<defs>
				<linearGradient id="partialGradient" x1="0" y1="0" x2="100%" y2="0">
					<stop offset="' . esc_attr( $percentage ) . '%" stop-color="#FFC107"/>
					<stop offset="' . esc_attr( $percentage ) . '%" stop-color="#e0e0e0"/>
				</linearGradient>
			</defs>
			<path fill="url(#partialGradient)" d="M12 .587l3.668 7.568L24 9.423l-6 5.858L19.335 24 12 20.01 4.665 24l1.335-8.719-6-5.858 8.332-1.268z"/>
		</svg>';
	}

	/**
	 * Returns the list of allowed SVG tags and attributes for use with wp_kses().
	 *
	 * This method defines a whitelist of commonly used and safe SVG elements and
	 * their permitted attributes so that inline SVG markup can pass through
	 * WordPress KSES sanitization (e.g., when used in post content or block output).
	 *
	 * The returned array is intended to be merged with the existing allowed HTML
	 * tags via the `wp_kses_allowed_html` filter.
	 *
	 * @return array An associative array of SVG elements and their allowed attributes.
	 */
	public function svg_args_on_wp_kses() {
		$svg_args = array(
			'svg'            => array(
				'class'           => true,
				'aria-hidden'     => true,
				'aria-labelledby' => true,
				'role'            => true,
				'xmlns'           => true,
				'width'           => true,
				'height'          => true,
				'viewbox'         => true, // <= Must be lower case!
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
			'clipPath'       => array(
				'id' => true,
			),
			'mask'           => array(
				'id' => true,
			),
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

		return $svg_args;
	}

	/**
	 * Generate WooCommerce CSS variables.
	 *
	 * @return string
	 */
	public static function get_woocommerce_video_modal_css_variables() {

		if ( ! class_exists( 'WooCommerce' ) ) {
			return '';
		}

		$settings = get_option( 'rtgodam-settings', array() );
		$woo      = $settings['integrations']['woocommerce'] ?? array();

		$css = ':root {';

		foreach ( $woo as $key => $value ) {

			if ( empty( $value ) ) {
				continue;
			}

			$css_key = '--rtgodam-woo-video-modal-' . sanitize_key( $key );

			// Handle border array.
			if ( is_array( $value ) ) {

				$width = isset( $value['width'] ) ? $value['width'] : '1px';
				$style = isset( $value['style'] ) ? $value['style'] : 'solid';
				$color = isset( $value['color'] ) ? $value['color'] : '#000';

				$value = "{$width} {$style} {$color}";
			} elseif ( is_numeric( $value ) ) {
				// Handle numeric values (like radius).
				$value = $value . 'px';
			}

			$css .= $css_key . ':' . esc_attr( $value ) . ';';
		}

		$css .= '}';

		return $css;
	}

	/**
	 * AJAX callback to fetch and return a sidebar single product's HTML content.
	 *
	 * This function is triggered via an AJAX request and returns rendered HTML for a single product,
	 * typically used in quick views, sidebars, or modal popups.
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

		$video_id     = isset( $_GET['video_id'] ) ? absint( $_GET['video_id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- nonce already verified above
		$toggle_label = __( 'Product Details', 'godam' );
		$utility      = $this;

		include RTGODAM_PATH . 'integrations/woocommerce/templates/sidebar/hero-product.php';
		include RTGODAM_PATH . 'integrations/woocommerce/templates/sidebar/single-product-details.php';

		$html = ob_get_clean();

		wp_send_json_success( $html );
	}

	/**
	 * AJAX callback to fetch and return a sidebar multiple product's HTML content.
	 *
	 * This function is triggered via an AJAX request and returns rendered HTML for a multiple products,
	 * typically used in quick views, sidebars, or modal popups.
	 *
	 * @return void
	 */
	public function godam_get_multiple_sidebar_product_html_callback() {

		$nonce = isset( $_GET['_wpnonce'] )
		? sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) )
		: '';

		if ( ! wp_verify_nonce( $nonce, 'godam_get_multiple_sidebar_product_html' ) ) {
			wp_send_json_error( 'Invalid request.', 400 );
		}

		if ( empty( $_GET['products'] ) ) {
			wp_send_json_error( 'Missing products array.', 400 );
		}

		// Expect comma separated IDs.
		$raw_ids = sanitize_text_field( wp_unslash( $_GET['products'] ) );

		$ids = array_filter(
			array_map(
				'absint',
				explode( ',', $raw_ids )
			)
		);

		if ( empty( $ids ) ) {
			wp_send_json_error( 'Invalid product IDs.', 400 );
		}

		$hero_product = wc_get_product( $ids[0] );

		if ( ! $hero_product ) {
			wp_send_json_error( 'Hero product not found.', 400 );
		}

		$additional_products = array();

		if ( count( $ids ) > 1 ) {
			foreach ( $ids as $id ) {
				$per_product = wc_get_product( $id );
				if ( $per_product ) {
					$additional_products[] = $per_product;
				}
			}
		}

		ob_start();

		$video_id     = isset( $_GET['video_id'] ) ? absint( $_GET['video_id'] ) : 0; // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- nonce already verified above
		$toggle_label = __( 'All Attached Products', 'godam' );
		$utility      = $this;
		$products     = $additional_products;
		$product      = $hero_product;

		include RTGODAM_PATH . 'integrations/woocommerce/templates/sidebar/hero-product.php';
		include RTGODAM_PATH . 'integrations/woocommerce/templates/sidebar/multiple-products-list.php';

		$html = ob_get_clean();

		wp_send_json_success( $html );
	}
}
