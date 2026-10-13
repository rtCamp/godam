<?php
/**
 * Narrow WordPress option / URL stubs for the Analytics microservice-proxy tests.
 *
 * These let the pure (no-WordPress) suite exercise Analytics::fetch_top_videos
 * and Analytics::fetch_top_products without a full WP install. Each stub reads
 * per-test state from `$GLOBALS['rtgodam_stub']`, matching the convention in
 * bootstrap.php: the test sets the option values and the fake HTTP response,
 * then asserts on the WP_REST_Response the method returns. All guarded so a real
 * WP test bootstrap (or another stub file) that already defines these wins.
 *
 * @package GoDAM
 */

// Base URL the proxy builds its microservice endpoint from. Defined in the main
// plugin file at runtime; stubbed here so add_query_arg has something to build on.
if ( ! defined( 'RTGODAM_ANALYTICS_BASE' ) ) {
	define( 'RTGODAM_ANALYTICS_BASE', 'https://analytics.test' );
}

if ( ! function_exists( 'get_option' ) ) {

	/**
	 * @param string $option        Option name.
	 * @param mixed  $default_value Returned when the test did not set the option.
	 * @return mixed
	 */
	function get_option( $option, $default_value = false ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$options = isset( $GLOBALS['rtgodam_stub']['options'] ) && is_array( $GLOBALS['rtgodam_stub']['options'] )
			? $GLOBALS['rtgodam_stub']['options']
			: array();
		return array_key_exists( $option, $options ) ? $options[ $option ] : $default_value;
	}
}

// is_wp_error() and the wp_remote_* stubs live in tests/bootstrap.php, which
// defines them first. A test fakes the upstream response by setting
// $GLOBALS['rtgodam_stub']['http'] = array( 'code' => ..., 'body' => ... ).

if ( ! function_exists( 'add_query_arg' ) ) {

	/**
	 * Minimal 2-arg array form: append the params as a query string. The exact URL
	 * is irrelevant to these tests, which stub the HTTP response regardless.
	 *
	 * @param array  $args Query args.
	 * @param string $url  Base URL.
	 * @return string
	 */
	function add_query_arg( $args, $url = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$query = is_array( $args ) ? http_build_query( $args ) : (string) $args;
		return '' === $query ? (string) $url : (string) $url . '?' . $query;
	}
}

if ( ! function_exists( 'rest_sanitize_boolean' ) ) {

	/**
	 * @param mixed $value Value to coerce.
	 * @return bool
	 */
	function rest_sanitize_boolean( $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return filter_var( $value, FILTER_VALIDATE_BOOLEAN );
	}
}
