<?php
/**
 * Narrow WordPress HTTP and file stubs for the tests of what GoDAM does with the
 * files GoDAM Central sends back (TranscodedFileDownloadTest, Mp4ReplacementTest).
 *
 * Each stub reads or records through `$GLOBALS['rtgodam_stub']`, as the other stubs
 * do. All are guarded, so a real WP test bootstrap or an earlier definition wins.
 *
 * @package GoDAM
 */

if ( ! function_exists( 'wp_safe_remote_get' ) ) {

	/**
	 * Records the URL in `safe_get_urls` and answers with `http_by_url[ $url ]`,
	 * else `http`, else a 404.
	 *
	 * @param string $url  URL.
	 * @param array  $args Ignored.
	 * @return array
	 */
	function wp_safe_remote_get( $url, $args = array() ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['safe_get_urls'][] = $url;

		return $GLOBALS['rtgodam_stub']['http_by_url'][ $url ] ?? $GLOBALS['rtgodam_stub']['http'] ?? array(
			'code' => 404,
			'body' => '',
		);
	}
}

if ( ! function_exists( 'wp_tempnam' ) ) {

	/**
	 * @param string $filename Ignored.
	 * @return string|false Path of a new, empty temp file.
	 */
	function wp_tempnam( $filename = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found -- stub mirroring the WP function.
		return tempnam( sys_get_temp_dir(), 'godam-test-' );
	}
}

if ( ! function_exists( 'wp_delete_file' ) ) {

	/**
	 * @param string $file File to delete.
	 */
	function wp_delete_file( $file ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		if ( is_file( $file ) ) {
			unlink( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink -- this stub is what wp_delete_file() wraps.
		}
	}
}

if ( ! function_exists( 'wp_check_filetype_and_ext' ) ) {

	/**
	 * Takes the type from the name's extension, and drops it when the content is
	 * a text document, which is what WordPress does when the real type of an
	 * audio or video file is not audio or video. Only the types these tests use.
	 *
	 * @param string $file     Path of the file.
	 * @param string $filename Name the file has or would have.
	 * @return array
	 */
	function wp_check_filetype_and_ext( $file, $filename ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$types = array(
			'mp4' => 'video/mp4',
			'mp3' => 'audio/mpeg',
			'txt' => 'text/plain',
			'php' => false,
		);
		$ext   = strtolower( pathinfo( $filename, PATHINFO_EXTENSION ) );
		$type  = $types[ $ext ] ?? false;

		if ( $type && 0 !== strpos( $type, 'text/' ) && 0 === strpos( (string) file_get_contents( $file ), '<' ) ) { // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reading a local temp file in a stub.
			$type = false;
		}

		return array(
			'ext'             => $type ? $ext : false,
			'type'            => $type,
			'proper_filename' => false,
		);
	}
}
