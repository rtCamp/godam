<?php
/**
 * Narrow template-tag stubs for the pure (no-WordPress) unit suite.
 *
 * Used by the tests that call rtgodam_get_localize_array(), which reads the
 * current request's post, page type and site. Each stub returns a fixed
 * front-end page and is guarded against redeclaring a function another stub
 * file already defines. Load this file from a test's setUp() in a separate
 * process (see ViewerEmailNotInPageTest), so the stubs do not reach other tests.
 *
 * @package GoDAM
 */

if ( ! defined( 'RTGODAM_ANALYTICS_BASE' ) ) {
	define( 'RTGODAM_ANALYTICS_BASE', 'https://analytics.test' );
}

if ( ! function_exists( 'is_single' ) ) {

	/**
	 * @return bool
	 */
	function is_single() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return false;
	}
}

if ( ! function_exists( 'is_page' ) ) {

	/**
	 * @return bool
	 */
	function is_page() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return true;
	}
}

if ( ! function_exists( 'is_archive' ) ) {

	/**
	 * @return bool
	 */
	function is_archive() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return false;
	}
}

if ( ! function_exists( 'get_the_title' ) ) {

	/**
	 * @return string
	 */
	function get_the_title() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return 'Host Page';
	}
}

if ( ! function_exists( 'get_current_blog_id' ) ) {

	/**
	 * @return int
	 */
	function get_current_blog_id() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return 1;
	}
}

if ( ! function_exists( 'get_post_type' ) ) {

	/**
	 * @return string
	 */
	function get_post_type() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return 'page';
	}
}

if ( ! function_exists( 'get_the_ID' ) ) {

	/**
	 * @return int
	 */
	function get_the_ID() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound,WordPress.NamingConventions.ValidFunctionName.FunctionNameInvalid -- stub mirroring the WP function.
		return 500;
	}
}

if ( ! function_exists( 'get_the_author' ) ) {

	/**
	 * @return string
	 */
	function get_the_author() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return 'someone';
	}
}

if ( ! function_exists( 'get_the_category' ) ) {

	/**
	 * @return array
	 */
	function get_the_category() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return array();
	}
}

if ( ! function_exists( 'get_the_tags' ) ) {

	/**
	 * @return bool
	 */
	function get_the_tags() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return false;
	}
}
