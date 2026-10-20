<?php
/**
 * Narrow WordPress stubs for FormLayerPreviewIdTest.
 *
 * Just enough of the template tags used by inc/templates/render-video-editor-form-layer.php
 * to render it outside WordPress. Query vars come from `$GLOBALS['rtgodam_stub']['query_vars']`
 * and every shortcode string handed to do_shortcode() is recorded in
 * `$GLOBALS['rtgodam_stub']['shortcodes']`.
 *
 * @package GoDAM
 */

if ( ! function_exists( 'get_query_var' ) ) {

	/**
	 * @param string $var_name Query var name.
	 * @return mixed
	 */
	function get_query_var( $var_name ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return $GLOBALS['rtgodam_stub']['query_vars'][ $var_name ] ?? '';
	}
}

if ( ! function_exists( 'sanitize_key' ) ) {

	/**
	 * @param string $key Input.
	 * @return string
	 */
	function sanitize_key( $key ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $key ) );
	}
}

if ( ! function_exists( 'do_shortcode' ) ) {

	/**
	 * Record the shortcode string instead of running it.
	 *
	 * @param string $content Shortcode content.
	 * @return string
	 */
	function do_shortcode( $content ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['shortcodes'][] = $content;
		return '';
	}
}

foreach ( array( 'language_attributes', 'wp_head', 'wp_body_open', 'wp_footer', 'body_class' ) as $rtgodam_noop ) {
	if ( ! function_exists( $rtgodam_noop ) ) {
		eval( 'function ' . $rtgodam_noop . '() {}' ); // phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only no-op template tags.
	}
}

if ( ! function_exists( 'bloginfo' ) ) {

	/**
	 * @param string $show Ignored.
	 * @return void
	 */
	function bloginfo( $show = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found -- stub mirroring the WP function.
		echo 'UTF-8';
	}
}
