<?php
/**
 * Option stubs not covered elsewhere. get_option() lives in wp-http-functions.php
 * and update_option() in video-seo-functions.php; both use
 * $GLOBALS['rtgodam_stub']['options'].
 *
 * @package GoDAM
 */

if ( ! function_exists( 'delete_option' ) ) {

	/**
	 * Remove an option from $GLOBALS['rtgodam_stub']['options'].
	 *
	 * @param string $option Option name.
	 * @return bool
	 */
	function delete_option( $option ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		unset( $GLOBALS['rtgodam_stub']['options'][ $option ] );
		return true;
	}
}
