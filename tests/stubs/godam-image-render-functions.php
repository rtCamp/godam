<?php
/**
 * Narrow stubs for rendering the GoDAM Image block template in unit tests.
 *
 * Used by HotspotLinkSanitizeTest and GodamImageCurrentUrlTest, which include the
 * real render.php and read the markup it prints. Per-test state lives in
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
	 * Records the requested size in `$GLOBALS['rtgodam_stub']['attachment_image_size']`.
	 *
	 * With `$GLOBALS['rtgodam_stub']['attachment_image_url_via_core']` set, it follows
	 * core's path instead: the `image_downsize` filter first, then the `wp_get_attachment_url`
	 * filter on the local URL, so the real GoDAM filters decide the URL.
	 *
	 * @param int          $attachment_id Attachment ID.
	 * @param string|int[] $size          Requested size.
	 * @return string|false `$GLOBALS['rtgodam_stub']['attachment_image_url']`, or '' when
	 *                      not set (the block then uses the URL saved on it).
	 */
	function wp_get_attachment_image_url( $attachment_id = 0, $size = 'thumbnail' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['attachment_image_size'] = $size;

		if ( ! empty( $GLOBALS['rtgodam_stub']['attachment_image_url_via_core'] ) ) {
			$downsize = apply_filters( 'image_downsize', false, $attachment_id, $size ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core hook.
			if ( is_array( $downsize ) ) {
				return $downsize[0];
			}
			return apply_filters( 'wp_get_attachment_url', wp_get_attachment_url( $attachment_id ), $attachment_id ); // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- core hook.
		}

		return $GLOBALS['rtgodam_stub']['attachment_image_url'] ?? '';
	}
}

if ( ! function_exists( 'wp_get_attachment_metadata' ) ) {

	/**
	 * @return array `$GLOBALS['rtgodam_stub']['attachment_metadata']`, or an empty array when not set.
	 */
	function wp_get_attachment_metadata() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return $GLOBALS['rtgodam_stub']['attachment_metadata'] ?? array();
	}
}
