<?php
/**
 * Narrow WordPress stubs for the media library REST handlers (MediaLibraryAttachmentAccessTest).
 *
 * Meta is held in `$GLOBALS['rtgodam_stub']['post_meta']`, which the get_post_meta() stub in
 * tests/bootstrap.php reads: one attachment per test, keyed by meta key. Every write and
 * delete is also recorded, in `meta_writes` and `meta_deletes`, so a test can tell a read
 * that saved nothing from one that did.
 *
 * @package GoDAM
 */

if ( ! function_exists( 'update_post_meta' ) ) {

	/**
	 * Same shape as tests/stubs/video-seo-functions.php, so results match whichever loads first.
	 *
	 * @param int    $post_id Post ID.
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

if ( ! function_exists( 'delete_post_meta' ) ) {

	/**
	 * @param int    $post_id Post ID.
	 * @param string $key     Meta key.
	 * @return bool
	 */
	function delete_post_meta( $post_id, $key ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found -- stub mirroring the WP function.
		unset( $GLOBALS['rtgodam_stub']['post_meta'][ $key ] );
		$GLOBALS['rtgodam_stub']['meta_deletes'][] = $key;
		return true;
	}
}

if ( ! function_exists( 'get_post_field' ) ) {

	/**
	 * @param string $field Field name.
	 * @param mixed  $post  Ignored; the value is supplied by the test in `post_fields`.
	 * @return string
	 */
	function get_post_field( $field, $post = null ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed, Universal.NamingConventions.NoReservedKeywordParameterNames.postFound -- stub mirroring the WP function.
		return $GLOBALS['rtgodam_stub']['post_fields'][ $field ] ?? '';
	}
}

if ( ! function_exists( 'esc_url_raw' ) ) {

	/**
	 * Same as tests/stubs/video-seo-functions.php: the URL comes back as given.
	 *
	 * @param string $url       URL.
	 * @param array  $protocols Ignored.
	 * @return string
	 */
	function esc_url_raw( $url, $protocols = null ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- stub mirroring the WP function.
		return (string) $url;
	}
}

if ( ! function_exists( 'rest_ensure_response' ) ) {

	/**
	 * @param mixed $response Payload or response.
	 * @return mixed
	 */
	function rest_ensure_response( $response ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		if ( is_wp_error( $response ) || $response instanceof WP_REST_Response ) {
			return $response;
		}
		return new WP_REST_Response( $response );
	}
}

if ( ! function_exists( 'is_ssl' ) ) {

	/**
	 * @return bool
	 */
	function is_ssl() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return ! empty( $GLOBALS['rtgodam_stub']['ssl'] );
	}
}

if ( ! function_exists( 'set_url_scheme' ) ) {

	/**
	 * @param string $url    URL.
	 * @param string $scheme Scheme to use.
	 * @return string
	 */
	function set_url_scheme( $url, $scheme = null ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return preg_replace( '#^https?://#', $scheme . '://', $url );
	}
}

if ( ! function_exists( 'wp_safe_remote_post' ) ) {

	/**
	 * Answers GoDAM Central with `http` and records the call in `central_posts`.
	 *
	 * @param string $url  Requested URL.
	 * @param array  $args Ignored.
	 * @return mixed
	 */
	function wp_safe_remote_post( $url, $args = array() ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['central_posts'][] = $url;
		return $GLOBALS['rtgodam_stub']['http'] ?? array(
			'code' => 404,
			'body' => '',
		);
	}
}
