<?php
/**
 * Narrow WordPress stubs for LearnDashIntegrationTest.
 *
 * Guarded so a real WordPress test bootstrap, or another stub file that
 * already defines them, wins.
 *
 * @package GoDAM
 */

if ( ! function_exists( 'wp_unslash' ) ) {

	/**
	 * @param mixed $value Value.
	 * @return mixed
	 */
	function wp_unslash( $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return $value;
	}
}

if ( ! function_exists( 'untrailingslashit' ) ) {

	/**
	 * @param string $value Value.
	 * @return string
	 */
	function untrailingslashit( $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return rtrim( (string) $value, '/\\' );
	}
}
