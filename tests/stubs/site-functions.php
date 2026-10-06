<?php
/**
 * Narrow site / user / cache stubs for the pure (no-WordPress) unit suite.
 *
 * Used by SiteOriginTest to drive the Analytics and Engagement read handlers.
 * Each stub reads per-test state from `$GLOBALS['rtgodam_stub']`, matching the
 * convention in bootstrap.php, and is guarded so a real WP test bootstrap wins.
 *
 * @package GoDAM
 */

// Base URL the engagement likes/comments reads build on. Defined in the main
// plugin file at runtime.
if ( ! defined( 'RTGODAM_API_BASE' ) ) {
	define( 'RTGODAM_API_BASE', 'https://api.test' );
}

if ( ! function_exists( 'home_url' ) ) {

	/**
	 * @return string The home URL the test set, or https://example.test.
	 */
	function home_url() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return isset( $GLOBALS['rtgodam_stub']['home_url'] ) ? (string) $GLOBALS['rtgodam_stub']['home_url'] : 'https://example.test';
	}
}

if ( ! function_exists( 'is_user_logged_in' ) ) {

	/**
	 * @return bool False unless a test sets $GLOBALS['rtgodam_stub']['user'].
	 */
	function is_user_logged_in() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return ! empty( $GLOBALS['rtgodam_stub']['user'] );
	}
}

if ( ! function_exists( 'wp_using_ext_object_cache' ) ) {

	/**
	 * @return bool Always false, so rtgodam_cache_get/set use the transient stubs.
	 */
	function wp_using_ext_object_cache() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return false;
	}
}

if ( ! function_exists( 'wp_parse_args' ) ) {

	/**
	 * Array form only: $args wins over $defaults.
	 *
	 * @param array $args     Values to use.
	 * @param array $defaults Fallback values.
	 * @return array
	 */
	function wp_parse_args( $args, $defaults = array() ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return array_merge( (array) $defaults, (array) $args );
	}
}
