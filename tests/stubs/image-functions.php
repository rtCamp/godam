<?php
/**
 * Image-size stubs for the pure (no-WordPress) unit suite.
 *
 * Copies of core's wp_image_matches_ratio() and the width-only part of
 * wp_constrain_dimensions() it uses, for CdnImageSrcsetTest. Guarded so a real
 * WP test bootstrap wins.
 *
 * @package GoDAM
 */

if ( ! function_exists( 'wp_image_matches_ratio' ) ) {

	/**
	 * Copy of core's wp_image_matches_ratio() (wp-includes/media.php).
	 *
	 * @param int $source_width  The width of the first image.
	 * @param int $source_height The height of the first image.
	 * @param int $target_width  The width of the second image.
	 * @param int $target_height The height of the second image.
	 * @return bool Whether the two images have the same shape, within a pixel.
	 */
	function wp_image_matches_ratio( $source_width, $source_height, $target_width, $target_height ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		if ( $source_width > $target_width ) {
			$constrained_size = wp_constrain_dimensions( $source_width, $source_height, $target_width );
			$expected_size    = array( $target_width, $target_height );
		} else {
			$constrained_size = wp_constrain_dimensions( $target_width, $target_height, $source_width );
			$expected_size    = array( $source_width, $source_height );
		}

		$matched = ( abs( $constrained_size[0] - $expected_size[0] ) <= 1 && abs( $constrained_size[1] - $expected_size[1] ) <= 1 );

		return $matched;
	}
}

if ( ! function_exists( 'wp_constrain_dimensions' ) ) {

	/**
	 * Width-only version of core's wp_constrain_dimensions(), all the stub above needs.
	 *
	 * @param int $current_width  Current width.
	 * @param int $current_height Current height.
	 * @param int $max_width      Maximum width.
	 * @return int[] Width and height.
	 */
	function wp_constrain_dimensions( $current_width, $current_height, $max_width ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		if ( ! $current_width || ! $current_height || $current_width <= $max_width ) {
			return array( (int) $current_width, (int) $current_height );
		}
		$ratio = $max_width / $current_width;
		return array( (int) round( $current_width * $ratio ), (int) round( $current_height * $ratio ) );
	}
}
