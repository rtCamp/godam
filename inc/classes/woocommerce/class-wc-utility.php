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
}
