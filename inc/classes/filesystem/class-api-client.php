<?php
/**
 * GoDAM API Client for Filesystem Stream Wrapper
 * This class provides methods to interact with the GoDAM Filesystem API.
 *
 * @package RTGODAM\Inc\Filesystem
 */

// phpcs:disable Universal.Files.SeparateFunctionsFromOO.Mixed

namespace RTGODAM\Inc\Filesystem;

use WP_Error;

/**
 * Class API_Client
 *
 * This class handles communication with the GoDAM Filesystem API.
 * It provides methods to upload files, check file existence, get file stats,
 * and manage directories.
 *
 * @since n.e.x.t
 */
class API_Client {

	/**
	 * @since n.e.x.t
	 *
	 * @var int Default request timeout in seconds.
	 */
	const DEFAULT_REQUEST_TIMEOUT = 10;

	/**
	 * @since n.e.x.t
	 *
	 * @var string User agent string for API requests.
	 */
	private $user_agent;

	/**
	 * @since n.e.x.t
	 *
	 * @var string Base URL for the API.
	 */
	private $api_base;

	/**
	 * @since n.e.x.t
	 *
	 * @var string Site ID for the Files API.
	 */
	private $site_id;

	/**
	 * @since n.e.x.t
	 *
	 * @var string API token for authentication.
	 */
	private $api_key;

	/**
	 * @since n.e.x.t
	 *
	 * @var API_Cache
	 */
	private $cache;

	/**
	 * API_Client constructor.
	 *
	 * @since n.e.x.t
	 *
	 * @param string    $api_base       Base URL for the API.
	 * @param string    $site_id  Site ID for the Files API.
	 * @param string    $api_key    API token for authentication.
	 * @param API_Cache $cache          Cache instance for storing file stats and paths.
	 */
	public function __construct( $api_base, $site_id, $api_key, $cache ) {
		$this->api_base = untrailingslashit( $api_base );
		$this->site_id  = $site_id;
		$this->api_key  = $api_key;

		// Add some context to the UA to simplify debugging issues.
		if ( defined( 'DOING_CRON' ) && constant( 'DOING_CRON' ) ) {
			// current_filter may not be totally accurate but still better than nothing.
			$current_context = sprintf( 'Cron (%s)', current_filter() );
		} elseif ( defined( 'WP_CLI' ) && constant( 'WP_CLI' ) ) {
			$current_context = 'WP_CLI';
		} else {
			$current_context = add_query_arg( array() );
		}
		$this->user_agent = sprintf( 'GODAM/%s/Files;%s', get_bloginfo( 'version' ), esc_html( $current_context ) );

		// Set the cache instance.
		$this->cache = $cache;
	}

	/**
	 * Trim the path to remove leading slashes and the godam:// protocol.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $path The file path to trim.
	 *
	 * @return string The trimmed path.
	 */
	protected function trim_path( $path ) {
		// Remove leading slashes and backslashes from the path.
		$path = ltrim( $path, '/\\' );

		// Remove godam:// protocol if present.
		if ( str_starts_with( $path, 'godam://' ) ) {
			$path = substr( $path, strlen( 'godam://' ) );
		}

		return $path;
	}

	/**
	 * Check if the given path is a valid file path.
	 * A valid file path must start with 'wp-content/uploads/'.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $path The file path to check.
	 *
	 * @return bool True if the path is valid, false otherwise.
	 */
	protected function is_valid_path( $path ) {
		$path = ltrim( $path, '/\\' );
		return str_starts_with( $path, 'wp-content/uploads/' );
	}

	/**
	 * Get the full API URL for a given path.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $path The file path to append to the API base URL.
	 *
	 * @return string The full API URL.
	 */
	public function get_api_url( $path ) {
		$path = ltrim( $path, '/\\' );
		return $this->api_base . '/' . $path;
	}

	/**
	 * Make an API call to the GoDAM Filesystem API.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $path          The file path for the API request.
	 * @param string $method        The HTTP method to use (GET, PUT, DELETE).
	 * @param array  $request_args  Optional arguments for the request.
	 * @param array  $query_args    Optional query parameters to append to the URL.
	 *
	 * @return WP_Error|array The response from the API or a WP_Error on failure.
	 */
	private function call_api( $path, $method, $request_args = array(), $query_args = array() ) {
		// Remove godam:// protocol if present.
		$path = $this->trim_path( $path );

		$is_valid_path = $this->is_valid_path( $path );
		if ( ! $is_valid_path ) {
			/* translators: 1: file path */
			return new WP_Error( 'invalid-path', sprintf( __( 'The specified file path (`%s`) does not begin with `/wp-content/uploads/`.', 'godam' ), $path ) );
		}

		$request_url = $this->get_api_url( $path );

		if ( ! empty( $query_args ) ) {
			// Add query parameters to the URL for requests.
			$request_url = add_query_arg( $query_args, $request_url );
			unset( $query_args );
		}

		$headers = array(
			'X-Client-Site-ID' => $this->site_id,
			'api-key'          => $this->api_key,
			'site-url'         => home_url(),
		);

		if ( isset( $request_args['headers'] ) ) {
			$headers = array_merge( $headers, $request_args['headers'] );
		}

		$timeout = $request_args['timeout'] ?? self::DEFAULT_REQUEST_TIMEOUT;

		$request_args = array_merge(
			$request_args,
			array(
				'method'     => $method,
				'headers'    => $headers,
				'timeout'    => $timeout,
				'user-agent' => $this->user_agent,
			)
		);

		$response = wp_remote_request( $request_url, $request_args );

		// Debug log.
		if ( defined( 'GODAM_FILESYSTEM_STREAM_WRAPPER_DEBUG' ) &&
			true === constant( 'GODAM_FILESYSTEM_STREAM_WRAPPER_DEBUG' ) ) {
			$this->log_request( $path, $method, $request_args );
		}

		return $response;
	}

	/**
	 * List the contents of a directory.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $path The directory path to list.
	 * @return WP_Error|array The response from the API or a WP_Error on failure.
	 */
	public function listdir( $path ) {
		// Remove godam:// protocol if present.
		$path = $this->trim_path( $path );

		if ( ! $this->is_valid_path( $path ) ) {
			/* translators: 1: directory path */
			return new WP_Error( 'invalid-path', sprintf( __( 'The specified directory path (`%s`) does not begin with `/wp-content/uploads/`.', 'godam' ), $path ) );
		}

		$response = $this->call_api(
			$path,
			'GET',
			array(
				'timeout' => 2,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$response_code = wp_remote_retrieve_response_code( $response );

		if ( 200 !== $response_code ) {
			/* translators: 1: directory path 2: HTTP status code */
			return new WP_Error( 'get_directory-failed', sprintf( __( 'Failed to get directory `%1$s` (response code: %2$d)', 'godam' ), $path, $response_code ) );
		}

		return json_decode( wp_remote_retrieve_body( $response ), true );
	}

	/**
	 * Get file stats from the API.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $path The file path to get stats for.
	 * @param array  &$info Optional variable to store file info.
	 *
	 * @return WP_Error|array|false The response from the API or a WP_Error on failure.
	 */
	public function get_stats( $path, &$info = array() ) {
		// Remove godam:// protocol if present.
		$path = $this->trim_path( $path );

		if ( ! $this->is_valid_path( $path ) ) {
			/* translators: 1: file path */
			return new WP_Error( 'invalid-path', sprintf( __( 'The specified file path (`%s`) does not begin with `/wp-content/uploads/`.', 'godam' ), $path ) );
		}

		$response = $this->call_api(
			$path,
			'GET',
			array(
				'timeout' => 2,
				'headers' => array(
					'X-Action' => 'stats',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			/* Translators: 1: file path */
			return new WP_Error( 'get_stats-failed', sprintf( __( 'Failed to get stats for file `%s`.', 'godam' ), $path ) );
		}

		$response_code = wp_remote_retrieve_response_code( $response );

		if ( 404 === $response_code ) {
			return false;
		}

		$stats = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( $stats ) {
			// Save to cache.
			$this->cache->cache_file_stats( $path, $stats );
			$info = $stats;
		} else {
			/* translators: 1: file path */
			return new WP_Error( 'get_stats-failed-json_decode-error', sprintf( __( 'Failed to process response data for `%s`', 'godam' ), $path ) );
		}

		return $response;
	}

	/**
	 * Upload a file to the API.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $local_path  The local file path to upload.
	 * @param string $upload_path The remote upload path (relative to `/wp-content/uploads/`).
	 *
	 * @return WP_Error|string The remote file path on success, or a WP_Error on failure.
	 */
	public function upload_file( $local_path, $upload_path ) {
		if ( ! file_exists( $local_path ) ) {
			/* translators: 1: local file path 2: remote upload path */
			return new WP_Error( 'upload_file-failed-invalid_path', sprintf( __( 'Failed to upload file `%1$s` to `%2$s`; the file does not exist.', 'godam' ), $local_path, $upload_path ) );
		}

		// Clear stat caches for the file.
		// The various stat-related functions below are cached.
		// The cached values can then lead to unexpected behavior even after the file has changed (e.g. in Curl_Streamer).
		clearstatcache( false, $local_path );

		$file_size = filesize( $local_path );
		$file_mime = self::detect_mime_type( $local_path );

		$request_timeout = $this->calculate_upload_timeout( $file_size );

		$curl_streamer = new Curl_Streamer( $local_path );  // phpcs:ignore WordPress.WP.AlternativeFunctions.curl_curl_streamer
		$curl_streamer->init();

		$response = $this->call_api(
			$upload_path,
			'PUT',
			array(
				'headers' => array(
					'Content-Type'   => $file_mime,
					'Content-Length' => $file_size,
					'Connection'     => 'Keep-Alive',
				),
				'timeout' => $request_timeout,
			)
		);

		$curl_streamer->deinit();

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$response_code = wp_remote_retrieve_response_code( $response );

		if ( 204 === $response_code ) {
			/* translators: 1: local file path 2: remote upload path */
			return new WP_Error( 'upload_file-failed-quota_reached', __( 'Failed to upload file `%1$s` to `%2$s`; file space quota has been exceeded.', 'godam' ), $local_path, $upload_path );
		} elseif ( 200 !== $response_code ) {
			/* translators: 1: local file path 2: remote upload path 3: HTTP status code */
			return new WP_Error( 'upload_file-failed', sprintf( __( 'Failed to upload file `%1$s` to `%2$s` (response code: %3$d)', 'godam' ), $local_path, $upload_path, $response_code ) );
		}

		$response_body = wp_remote_retrieve_body( $response );
		$response_data = json_decode( $response_body );

		if ( ! $response_data ) {
			/* translators: 1: local file path 2: remote upload path 3: response body */
			return new WP_Error( 'upload_file-failed-json_decode-error', sprintf( __( 'Failed to process response data after file upload for `%1$s` to `%2$s` (body: %3$s)', 'godam' ), $local_path, $upload_path, $response_body ) );
		}

		// response looks like {"filename":"/wp-content/uploads/path/to/file.ext"}.
		// save to cache.
		$this->cache->copy_to_cache( $response_data->filename, $local_path );

		// Reset file stats cache, if any.
		// Note: the ltrim is because we store the path without the leading slash but the API returns the path with it.
		$this->cache->remove_stats( ltrim( $response_data->filename, '/' ) );

		return $response_data->filename;
	}

	/**
	 * Calculate the upload timeout based on the file size.
	 *
	 * @since n.e.x.t
	 *
	 * @param int $file_size The size of the file in bytes.
	 *
	 * @return int The calculated timeout in seconds.
	 */
	private function calculate_upload_timeout( $file_size ) {
		// Uploads take longer so we need a custom timeout.
		// Use default timeout plus 1 second per 500kb.
		return self::DEFAULT_REQUEST_TIMEOUT + intval( $file_size / ( 500 * KB_IN_BYTES ) );
	}

	/**
	 * Detect the MIME type of a file.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $filename The file path to check.
	 *
	 * @return string The detected MIME type or an empty string if detection fails.
	 */
	private static function detect_mime_type( string $filename ): string {
		/**
		 * `wp_check_filetype()` indirectly calls `wp_get_current_user()`, which is loaded from `pluggable.php`
		 * `pluggable.php` is loaded after all plugins. Therefore, if a plugin creates a file under `wp-content/uploads`
		 * before `pluggable.php` is loaded, we should not call `wp_check_filetype()` because it will generate
		 * a fatal error.
		 */
		if ( function_exists( 'wp_get_current_user' ) ) {
			$info = wp_check_filetype( $filename );
			$mime = $info['type'] ?? '';
		} else {
			$mime = '';
		}

		if ( empty( $mime ) && extension_loaded( 'fileinfo' ) ) {
			$finfo = finfo_open( FILEINFO_MIME_TYPE );
			$mime  = finfo_file( $finfo, $filename );
			finfo_close( $finfo );
		}

		return is_string( $mime ) ? $mime : '';
	}

	/**
	 * Get a file from the API.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $file_path The file path to retrieve.
	 *
	 * @return WP_Error|string The local file path on success, or a WP_Error on failure.
	 */
	public function get_file( $file_path ) {
		// check in cache first.
		$file = $this->cache->get_file( $file_path );
		if ( $file ) {
			return $file;
		}

		// calculate timeout.
		$info     = array();
		$response = $this->is_file( $file_path, $info );
		if ( is_wp_error( $response ) ) {
			return $response;
		}

		if ( false === $response ) {
			/* translators: 1: file path */
			return new WP_Error( 'file-not-found', sprintf( __( 'The requested file `%1$s` does not exist (response code: 404)', 'godam' ), $file_path ) );
		}

		$request_timeout = $this->calculate_upload_timeout( $info['size'] ?? 0 );
		$tmp_file        = $this->cache->create_tmp_file();

		// Request args for wp_remote_request().
		$request_args = array(
			'stream'   => true,
			'filename' => $tmp_file,
			'timeout'  => $request_timeout,
		);

		// Prevent webp => jpg transform from running.
		if ( str_ends_with( strtok( $file_path, '?' ), '.webp' ) ) {
			$request_args['headers'] = array(
				'Accept' => 'image/webp',
			);
		}

		// not in cache so get from API.
		$response = $this->call_api( $file_path, 'GET', $request_args );

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$response_code = wp_remote_retrieve_response_code( $response );
		if ( 404 === $response_code ) {
			/* translators: 1: file path */
			return new WP_Error( 'file-not-found', sprintf( __( 'The requested file `%1$s` does not exist (response code: 404)', 'godam' ), $file_path ) );
		} elseif ( 200 !== $response_code ) {
			/* translators: 1: file path 2: HTTP status code */
			return new WP_Error( 'get_file-failed', sprintf( __( 'Failed to get file `%1$s` (response code: %2$d)', 'godam' ), $file_path, $response_code ) );
		}

		// save to cache.
		$this->cache->cache_file( $file_path, $tmp_file );

		return $tmp_file;
	}

	/**
	 * Get the content of a file from the API.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $file_path The file path to retrieve content from.
	 *
	 * @return WP_Error|string The file content on success, or a WP_Error on failure.
	 */
	public function get_file_content( $file_path ) {
		$file = $this->get_file( $file_path );

		// phpcs:ignore WordPressVIPMinimum.Performance.FetchingRemoteData.FileGetContentsUnknown -- the file is local.
		return file_get_contents( $file );
	}

	/**
	 * Delete a file from the API.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $file_path The file path to delete.
	 *
	 * @return WP_Error|bool True on success, or a WP_Error on failure.
	 */
	public function delete_file( $file_path ) {
		$response = $this->call_api(
			$file_path,
			'DELETE',
			array(
				'timeout' => 3,
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$response_code = wp_remote_retrieve_response_code( $response );
		if ( 200 !== $response_code ) {
			/* translators: 1: file path 2: HTTP status code */
			return new WP_Error( 'delete_file-failed', sprintf( __( 'Failed to delete file `%1$s` (response code: %2$d)', 'godam' ), $file_path, $response_code ) );
		}

		$this->cache->remove_file( $file_path );

		return true;
	}

	/**
	 * Check if a file exists in the API.
	 *
	 * @since n.e.x.t
	 *
	 * @param string     $file_path File path to check.
	 * @param array|null &$info Optional variable to store file info.
	 * @return WP_Error|bool    true if file exists, false if not, or WP_Error on failure
	 */
	public function is_file( $file_path, &$info = null ) {
		// check in cache first.
		$stats = $this->cache->get_file_stats( $file_path );
		if ( $stats ) {
			$info = $stats;
			return true;
		}

		$response = $this->call_api(
			$file_path,
			'GET',
			array(
				'timeout' => 2,
				'headers' => array(
					'X-Action' => 'file_exists',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$response_code = wp_remote_retrieve_response_code( $response );

		if ( 200 === $response_code ) {
			$response_body = wp_remote_retrieve_body( $response );
			$info          = json_decode( $response_body, true );

			// cache file info.
			$this->cache->cache_file_stats( $file_path, $info );

			return true;
		} elseif ( 404 === $response_code ) {
			return false;
		}

		/* translators: 1: file path 2: HTTP status code */
		return new WP_Error( 'is_file-failed', sprintf( __( 'Failed to check if file `%1$s` exists (response code: %2$d)', 'godam' ), $file_path, $response_code ) );
	}

	/**
	 * Use the filesystem API to generate a unique filename based on
	 * provided file path
	 *
	 * @since n.e.x.t
	 *
	 * @param string $file_path The file path to generate a unique filename for.
	 *
	 * @return string|WP_Error New unique filename
	 */
	public function get_unique_filename( $file_path ) {
		$response = $this->call_api(
			$file_path,
			'GET',
			array(
				'timeout' => 2,
				'headers' => array(
					'X-Action' => 'unique_filename',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return $response;
		}

		$response_code = wp_remote_retrieve_response_code( $response );

		if ( 503 === $response_code ) {
			return new WP_Error(
				'file-service-readonly',
				__( 'Uploads are temporarily disabled due to platform maintenance. Please try again in a few minutes.', 'godam' )
			);
		}

		if ( 200 !== $response_code ) {
			return new WP_Error(
				'invalid-file-type',
				// translators: 1 - file path, 2 - HTTP response code.
				sprintf( __( 'Failed to generate new unique file name `%1$s` (response code: %2$d)', 'godam' ), $file_path, $response_code )
			);
		}

		$content = wp_remote_retrieve_body( $response );
		$obj     = json_decode( $content );

		return $obj->filename;
	}

	/**
	 * Allow E_USER_NOTICE errors to be logged.
	 *
	 * This is used for debugging purposes to log API requests.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	private function allow_e_user_notice() {
		static $updated_error_reporting = false;
		if ( ! $updated_error_reporting ) {
			$current_reporting_level = error_reporting();                            // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.runtime_configuration_error_reporting
			error_reporting( $current_reporting_level | E_USER_NOTICE );    // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.runtime_configuration_error_reporting
			$updated_error_reporting = true;
		}
	}

	/**
	 * Log the API request for debugging purposes.
	 *
	 * This function logs the method, path, and any X-Action header to the error log.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $path          The API path being requested.
	 * @param string $method        The HTTP method used for the request.
	 * @param array  $request_args  The arguments passed to the request.
	 *
	 * @return void
	 */
	private function log_request( $path, $method, $request_args ) {
		$this->allow_e_user_notice();

		$x_action = '';

		if ( isset( $request_args['headers'] ) && isset( $request_args['headers']['X-Action'] ) ) {
			$x_action = ' | X-Action:' . $request_args['headers']['X-Action'];
		}

		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_trigger_error
		trigger_error(
			sprintf(
				'method:%s | path:%s%s #godam-streams-debug',
				esc_html( $method ),
				esc_html( $path ),
				esc_html( $x_action )
			),
			E_USER_NOTICE
		);
	}
}
