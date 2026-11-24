<?php
/**
 * Stubs for the AI agents notice tests. Loaded inside that test's own process
 * only, because other tests define fuller versions of these functions.
 *
 * @package GoDAM
 */

if ( ! function_exists( 'rest_ensure_response' ) ) {

	/**
	 * Returns the data as is.
	 *
	 * @param mixed $response Response data.
	 * @return mixed
	 */
	function rest_ensure_response( $response ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return $response;
	}
}

if ( ! function_exists( 'admin_url' ) ) {

	/**
	 * Builds a wp-admin URL on the test site.
	 *
	 * @param string $path Path inside wp-admin.
	 * @return string
	 */
	function admin_url( $path = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return 'https://site.example/wp-admin/' . $path;
	}
}
