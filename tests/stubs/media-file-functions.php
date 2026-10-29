<?php
/**
 * Narrow WordPress file, upload and media stubs for the media file path tests.
 *
 * Used by MediaFilePathsTest, which deletes, exports and stores media files under a
 * temporary uploads folder. Each stub is guarded so a real WP test bootstrap or another
 * stub file that already defines it wins. Per-test state lives in
 * `$GLOBALS['rtgodam_stub']`, matching the convention in tests/bootstrap.php.
 *
 * @package GoDAM
 */

if ( ! defined( 'FS_CHMOD_FILE' ) ) {
	define( 'FS_CHMOD_FILE', 0644 );
}

if ( ! function_exists( 'path_join' ) ) {

	/**
	 * Same rule as core: an absolute second path wins, otherwise the two are joined.
	 *
	 * @param string $base Base path.
	 * @param string $path Path relative to the base, or an absolute path.
	 * @return string
	 */
	function path_join( $base, $path ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		if ( '' !== $path && ( '/' === $path[0] || '\\' === $path[0] || 1 === preg_match( '#^[a-zA-Z]:[\\\\/]#', $path ) ) ) {
			return $path;
		}

		return rtrim( $base, '/\\' ) . '/' . ltrim( $path, '/\\' );
	}
}

if ( ! function_exists( 'wp_normalize_path' ) ) {

	/**
	 * Forward slashes only, no repeated slashes.
	 *
	 * @param string $path Path.
	 * @return string
	 */
	function wp_normalize_path( $path ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$wrapper = '';

		if ( wp_is_stream( $path ) ) {
			list( $wrapper, $path ) = explode( '://', $path, 2 );
			$wrapper               .= '://';
		}

		$path = str_replace( '\\', '/', $path );
		return $wrapper . preg_replace( '|(?<=.)/+|', '/', $path );
	}
}

if ( ! function_exists( 'trailingslashit' ) ) {

	/**
	 * @param string $value Path or URL.
	 * @return string
	 */
	function trailingslashit( $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return rtrim( (string) $value, '/\\' ) . '/';
	}
}

if ( ! function_exists( 'wp_is_stream' ) ) {

	/**
	 * Same test as core: the path starts with a registered stream wrapper scheme.
	 *
	 * @param string $path Path.
	 * @return bool
	 */
	function wp_is_stream( $path ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$wrappers = implode( '|', array_map( 'preg_quote', stream_get_wrappers() ) );
		return 1 === preg_match( "!^($wrappers)://!", $path );
	}
}

if ( ! function_exists( 'wp_http_validate_url' ) ) {

	/**
	 * A narrow stand-in for core, without the DNS lookup: http and https only, no
	 * credentials, no loopback, private or unspecified IPv4 literal, and no port other
	 * than 80, 443 or 8080.
	 *
	 * @param string $url URL.
	 * @return string|false The URL, or false when core would refuse it.
	 */
	function wp_http_validate_url( $url ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$parsed = is_string( $url ) ? parse_url( $url ) : false; // phpcs:ignore WordPress.WP.AlternativeFunctions.parse_url_parse_url -- this stub is what wp_parse_url() wraps.

		if ( ! $parsed || empty( $parsed['host'] ) || ! in_array( strtolower( $parsed['scheme'] ?? '' ), array( 'http', 'https' ), true ) ) {
			return false;
		}

		if ( isset( $parsed['user'] ) || isset( $parsed['pass'] ) || false !== strpbrk( $parsed['host'], ':#?[]' ) ) {
			return false;
		}

		if ( preg_match( '#^\d+\.\d+\.\d+\.\d+$#', $parsed['host'] ) ) {
			$parts = array_map( 'intval', explode( '.', $parsed['host'] ) );

			if ( in_array( $parts[0], array( 0, 10, 127 ), true )
				|| ( 172 === $parts[0] && $parts[1] >= 16 && $parts[1] <= 31 )
				|| ( 192 === $parts[0] && 168 === $parts[1] )
			) {
				return false;
			}
		}

		if ( isset( $parsed['port'] ) && ! in_array( $parsed['port'], array( 80, 443, 8080 ), true ) ) {
			return false;
		}

		return $url;
	}
}

if ( ! function_exists( 'wp_basename' ) ) {

	/**
	 * Core's multibyte-safe basename(), which also splits on backslashes.
	 *
	 * @param string $path   Path.
	 * @param string $suffix Suffix to remove.
	 * @return string
	 */
	function wp_basename( $path, $suffix = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return urldecode( basename( str_replace( array( '%2F', '%5C' ), '/', urlencode( $path ) ), $suffix ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.urlencode_urlencode -- mirrors core.
	}
}

if ( ! function_exists( 'sanitize_file_name' ) ) {

	/**
	 * A narrow stand-in for core: drops the characters core drops, turns spaces into
	 * dashes and trims leading and trailing dots, dashes and underscores.
	 *
	 * @param string $filename File name.
	 * @return string
	 */
	function sanitize_file_name( $filename ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$filename = preg_replace( '/[\x00-\x1f\x7f?\[\]\/\\\\=<>:;,\'"&$#*()|~`!{}%+]/', '', $filename );
		$filename = preg_replace( '/[\s-]+/', '-', $filename );
		return trim( $filename, '.-_' );
	}
}

if ( ! function_exists( 'sanitize_mime_type' ) ) {

	/**
	 * @param string $mime_type MIME type.
	 * @return string
	 */
	function sanitize_mime_type( $mime_type ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return preg_replace( '/[^-+*.a-zA-Z0-9\/]/', '', $mime_type );
	}
}

if ( ! function_exists( 'sanitize_email' ) ) {

	/**
	 * @param string $email Email address.
	 * @return string
	 */
	function sanitize_email( $email ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return (string) $email;
	}
}

if ( ! function_exists( 'esc_url_raw' ) ) {

	/**
	 * @param string $url URL.
	 * @return string
	 */
	function esc_url_raw( $url ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return (string) $url;
	}
}

if ( ! function_exists( 'get_post' ) ) {

	/**
	 * @param int $post_id Post ID.
	 * @return object|null Post from $GLOBALS['rtgodam_stub']['posts'][ $post_id ].
	 */
	function get_post( $post_id = 0 ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return $GLOBALS['rtgodam_stub']['posts'][ (int) $post_id ] ?? null;
	}
}

if ( ! function_exists( 'update_post_meta' ) ) {

	/**
	 * Records every write on `post_meta` (latest value per key) and `meta_writes`.
	 *
	 * @param int    $post_id Ignored; one post per test.
	 * @param string $key     Meta key.
	 * @param mixed  $value   Value.
	 * @return bool
	 */
	function update_post_meta( $post_id, $key, $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found -- stub mirroring the WP function; $post_id is ignored.
		$GLOBALS['rtgodam_stub']['post_meta'][ $key ]   = $value;
		$GLOBALS['rtgodam_stub']['meta_writes'][ $key ] = $value;
		return true;
	}
}

if ( ! function_exists( 'delete_post_meta' ) ) {

	/**
	 * Removes the key from `post_meta` and records it in `meta_deletes`.
	 *
	 * @param int    $post_id Ignored; one post per test.
	 * @param string $key     Meta key.
	 * @return bool
	 */
	function delete_post_meta( $post_id, $key ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found -- stub mirroring the WP function; $post_id is ignored.
		unset( $GLOBALS['rtgodam_stub']['post_meta'][ $key ] );
		$GLOBALS['rtgodam_stub']['meta_deletes'][] = $key;
		return true;
	}
}

if ( ! function_exists( 'remove_action' ) ) {

	/**
	 * @param string   $hook     Hook name.
	 * @param callable $callback Callback.
	 * @param int      $priority Priority.
	 * @return bool
	 */
	function remove_action( $hook, $callback, $priority = 10 ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return remove_filter( $hook, $callback, $priority );
	}
}

if ( ! function_exists( 'wp_insert_attachment' ) ) {

	/**
	 * @param array  $args  Attachment post data; recorded in `inserted_attachment`.
	 * @param string $file  Ignored.
	 * @return int The ID the test set in `new_attachment_id`.
	 */
	function wp_insert_attachment( $args, $file = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- stub mirroring the WP function; $file is ignored.
		$GLOBALS['rtgodam_stub']['inserted_attachment'] = $args;
		return (int) ( $GLOBALS['rtgodam_stub']['new_attachment_id'] ?? 99 );
	}
}

if ( ! function_exists( 'get_attached_file' ) ) {

	/**
	 * @param int $attachment_id Attachment ID.
	 * @return string|false Path from $GLOBALS['rtgodam_stub']['attached_files'][ $attachment_id ].
	 */
	function get_attached_file( $attachment_id ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return $GLOBALS['rtgodam_stub']['attached_files'][ (int) $attachment_id ] ?? false;
	}
}

if ( ! function_exists( 'wp_mkdir_p' ) ) {

	/**
	 * @param string $target Directory to create.
	 * @return bool
	 */
	function wp_mkdir_p( $target ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return is_dir( $target ) || mkdir( $target, 0777, true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_mkdir
	}
}

if ( ! function_exists( 'wp_delete_file' ) ) {

	/**
	 * @param string $file File to delete.
	 * @return void
	 */
	function wp_delete_file( $file ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		if ( is_file( $file ) ) {
			unlink( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink
		}
	}
}

if ( ! function_exists( 'wp_reset_postdata' ) ) {

	/**
	 * @return void
	 */
	function wp_reset_postdata() {} // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
}

if ( ! function_exists( 'wp_schedule_single_event' ) ) {

	/**
	 * @param int    $timestamp Ignored.
	 * @param string $hook      Ignored.
	 * @param array  $args      Ignored.
	 * @return bool
	 */
	function wp_schedule_single_event( $timestamp, $hook, $args = array() ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- stub mirroring the WP function; the arguments are ignored.
		return true;
	}
}

if ( ! class_exists( 'WP_Query' ) ) {

	/**
	 * WP_Query that serves the folder's attachment IDs from
	 * `$GLOBALS['rtgodam_stub']['folder_attachment_ids']`, honouring offset and limit,
	 * and reports no posts for any other query (the virtual media lookup).
	 */
	// phpcs:ignore Universal.Files.SeparateFunctionsFromOO.Mixed, Generic.Files.OneObjectStructurePerFile.MultipleFound -- test stub.
	class WP_Query {

		/** @var array */
		public $posts = array();

		/**
		 * @param array $args Query arguments.
		 */
		public function __construct( $args = array() ) {
			if ( isset( $args['tax_query'] ) ) {
				$ids         = $GLOBALS['rtgodam_stub']['folder_attachment_ids'] ?? array();
				$this->posts = array_slice( $ids, (int) ( $args['offset'] ?? 0 ), (int) ( $args['posts_per_page'] ?? count( $ids ) ) );
			}
		}

		/**
		 * @return bool
		 */
		public function have_posts() {
			return ! empty( $this->posts );
		}
	}
}

if ( ! class_exists( 'WP_Filesystem_Base' ) ) {

	/**
	 * Stand-in for the WP_Filesystem object GoDAM reads from the `$wp_filesystem` global.
	 * Plain PHP file functions, which is what WP_Filesystem_Direct does.
	 */
	// phpcs:ignore Universal.Files.SeparateFunctionsFromOO.Mixed, Generic.Files.OneObjectStructurePerFile.MultipleFound -- test stub.
	class WP_Filesystem_Base {

		/**
		 * @param string $path Path.
		 * @return bool
		 */
		public function exists( $path ) {
			return file_exists( $path );
		}

		/**
		 * @param string $file Path.
		 * @return bool
		 */
		public function delete( $file ) {
			return is_file( $file ) && unlink( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink
		}

		/**
		 * @param string $file     Path.
		 * @param string $contents Contents.
		 * @return bool
		 */
		public function put_contents( $file, $contents ) {
			return false !== file_put_contents( $file, $contents ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
		}
	}
}

if ( ! class_exists( 'RtgodamTestStream' ) ) {

	/**
	 * Minimal stream wrapper that serves files from a folder on disk, standing in for an
	 * uploads folder on a stream wrapper such as an object-storage plugin's. Register it
	 * as `rtgodamtest` and point `$root` at the folder `rtgodamtest://bucket` maps to.
	 */
	// phpcs:ignore Universal.Files.SeparateFunctionsFromOO.Mixed, Generic.Files.OneObjectStructurePerFile.MultipleFound -- test stub.
	class RtgodamTestStream {

		/**
		 * Folder on disk that `rtgodamtest://bucket` maps to.
		 *
		 * @var string
		 */
		public static $root = '';

		/**
		 * Required by PHP for stream wrappers.
		 *
		 * @var resource|null
		 */
		public $context;

		/**
		 * @param string $path  Stream path.
		 * @param int    $flags Ignored.
		 * @return array|false
		 */
		public function url_stat( $path, $flags ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed, WordPress.NamingConventions.ValidFunctionName.MethodNameInvalid -- stream wrapper API.
			$local = self::$root . substr( $path, strlen( 'rtgodamtest://bucket' ) );

			return file_exists( $local ) ? stat( $local ) : false;
		}
	}
}
