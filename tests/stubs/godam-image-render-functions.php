<?php
/**
 * Narrow stubs for rendering the GoDAM Image block template in unit tests.
 *
 * Used by HotspotLinkSanitizeTest, which includes the real render.php and reads the
 * layers it hands to the front end. Per-test state lives in
 * `$GLOBALS['rtgodam_stub']`, as elsewhere in the suite: `post_meta` is read by the
 * bootstrap's get_post_meta() stub.
 *
 * @package GoDAM
 */

if ( ! defined( 'RTGODAM_PATH' ) ) {
	define( 'RTGODAM_PATH', dirname( __DIR__, 2 ) . '/' );
}

if ( ! defined( 'RTGODAM_URL' ) ) {
	define( 'RTGODAM_URL', 'https://example.test/wp-content/plugins/godam/' );
}

if ( ! defined( 'RTGODAM_VERSION' ) ) {
	define( 'RTGODAM_VERSION', '0.0.0-test' );
}

if ( ! function_exists( 'esc_attr' ) ) {

	/**
	 * @param string $text Text to escape.
	 * @return string
	 */
	function esc_attr( $text ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
	}
}

if ( ! function_exists( 'wp_kses_data' ) ) {

	/**
	 * @param string $data Markup.
	 * @return string Returned as is: the wrapper attributes are built by the stub below.
	 */
	function wp_kses_data( $data ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return (string) $data;
	}
}

if ( ! function_exists( 'get_block_wrapper_attributes' ) ) {

	/**
	 * @param array $extra Extra attributes.
	 * @return string
	 */
	function get_block_wrapper_attributes( $extra = array() ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return 'class="wp-block-godam-image ' . ( $extra['class'] ?? '' ) . '"';
	}
}

if ( ! function_exists( 'wp_script_is' ) ) {

	/**
	 * @return bool Scripts are never registered in these tests.
	 */
	function wp_script_is() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return false;
	}
}

if ( ! function_exists( 'wp_register_script' ) ) {

	/**
	 * @return bool
	 */
	function wp_register_script() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return true;
	}
}

if ( ! function_exists( 'wp_enqueue_script' ) ) {

	/**
	 * @return void
	 */
	function wp_enqueue_script() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
	}
}

if ( ! function_exists( 'wp_get_attachment_image_url' ) ) {

	/**
	 * @return string The block carries its own URL in these tests.
	 */
	function wp_get_attachment_image_url() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return '';
	}
}

if ( ! function_exists( 'wp_get_attachment_metadata' ) ) {

	/**
	 * @return array
	 */
	function wp_get_attachment_metadata() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return array();
	}
}
