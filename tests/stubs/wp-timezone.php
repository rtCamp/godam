<?php
/**
 * Stub for wp_timezone(), driven per case by $GLOBALS['rtgodam_stub']['timezone'].
 *
 * @package GoDAM
 */

if ( ! function_exists( 'wp_timezone' ) ) {

	/**
	 * @return DateTimeZone The zone the test set, else UTC.
	 */
	function wp_timezone() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return $GLOBALS['rtgodam_stub']['timezone'] ?? new DateTimeZone( 'UTC' );
	}
}
