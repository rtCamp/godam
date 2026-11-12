<?php
/**
 * Stubs for rendering a block's render.php outside WordPress.
 *
 * @package GoDAM
 */

// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter -- stubs mirroring the WP functions.

if ( ! function_exists( 'get_block_wrapper_attributes' ) ) {

	/**
	 * @param array $extra_attributes Extra attributes, e.g. `class`.
	 * @return string
	 */
	function get_block_wrapper_attributes( $extra_attributes = array() ) {
		return 'class="' . htmlspecialchars( $extra_attributes['class'] ?? '', ENT_QUOTES, 'UTF-8' ) . '"';
	}
}

if ( ! function_exists( 'wp_kses_data' ) ) {

	/**
	 * @param string $data Content to filter.
	 * @return string
	 */
	function wp_kses_data( $data ) {
		return (string) $data;
	}
}
