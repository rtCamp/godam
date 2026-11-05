<?php
/**
 * Narrow WordPress stubs for LayerCustomCssSaveTest.
 *
 * register_rest_field() records each field's args in
 * `$GLOBALS['rtgodam_stub']['rest_fields']`, keyed by object type and field name
 * (the same shape as tests/stubs/media-visibility-functions.php), so a test can
 * call a field's callbacks the way the REST API does. update_post_meta() records
 * the same way as the one in tests/stubs/video-seo-functions.php.
 *
 * @package GoDAM
 */

if ( ! function_exists( 'register_rest_field' ) ) {

	/**
	 * @param string $object_type Object type.
	 * @param string $field       Field name.
	 * @param array  $args        Field args.
	 * @return void
	 */
	function register_rest_field( $object_type, $field, $args ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['rest_fields'][ $object_type ][ $field ] = $args;
	}
}

if ( ! function_exists( 'register_post_meta' ) ) {

	/**
	 * @return void
	 */
	function register_post_meta() {} // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
}

if ( ! function_exists( 'update_post_meta' ) ) {

	/**
	 * @param int    $post_id Post ID. Unused.
	 * @param string $key     Meta key.
	 * @param mixed  $value   Value.
	 * @return bool
	 */
	function update_post_meta( $post_id, $key, $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['post_meta'][ $key ]   = $value;
		$GLOBALS['rtgodam_stub']['meta_writes'][ $key ] = $value;

		return true;
	}
}
