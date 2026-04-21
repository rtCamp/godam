<?php
/**
 * Frappe Dispatch - First Install Client
 *
 * @package FrappeDispatch\Client
 * @author  rtCamp
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * A client class to handle first-time plugin installations
 * directly from your Frappe Dispatch backend.
 */
class Frappe_Dispatch_Installer {

	/**
	 * The URL to the Frappe API endpoint.
	 *
	 * @var string
	 */
	private $api_url;

	/**
	 * The license key for authentication.
	 *
	 * @var string
	 */
	private $license_key;

	/**
	 * Plugin installation arguments.
	 *
	 * @var array
	 */
	private $args;

	/**
	 * HTTP timeout for metadata requests.
	 *
	 * @var int
	 */
	const REQUEST_TIMEOUT = 30;

	/**
	 * HTTP timeout for downloads.
	 *
	 * @var int
	 */
	const DOWNLOAD_TIMEOUT = 60;

	/**
	 * Constructor.
	 *
	 * @param string $api_url Base URL for Frappe Dispatch.
	 * @param string $license_key License key for authentication.
	 * @param array  $args    Optional installation arguments.
	 */
	public function __construct( $api_url, $license_key, $args = array() ) {
		// Allow wp-config.php to globally override the install server URL.
		if ( defined( 'FRAPPE_DISPATCH_SITE_URL' ) ) {
			$api_url = FRAPPE_DISPATCH_SITE_URL;
		}

		// Auto-append the exact API endpoint if only the base domain was provided.
		$api_url = rtrim( $api_url, '/' );
		if ( false === strpos( $api_url, '/api/method/' ) ) {
			$api_url .= '/api/method/frappe_dispatch.api.dispatch.get_plugin_for_install';
		}

		$this->api_url     = esc_url_raw( $api_url );
		$this->license_key = $license_key;
		$this->args        = wp_parse_args(
			$args,
			array(
				'plugin_slug'   => '',
				'license'       => $license_key,
				'auto_activate' => false,
			)
		);
	}

	/**
	 * Install a plugin by slug using the Frappe Dispatch API.
	 *
	 * @param string $plugin_slug The plugin slug to install.
	 * @param bool   $auto_activate Whether to auto-activate after install.
	 * @return array Installation result.
	 */
	public function install_plugin( $plugin_slug, $auto_activate = false ) {
		$plugin_slug = sanitize_title( $plugin_slug );

		if ( empty( $plugin_slug ) ) {
			return array(
				'success' => false,
				'message' => 'Invalid plugin slug.',
			);
		}

		$plugin_data = $this->fetch_plugin_data( $plugin_slug );

		if ( ! $plugin_data ) {
			return array(
				'success' => false,
				'message' => 'Failed to fetch plugin data from server.',
			);
		}

		if ( isset( $plugin_data->error ) ) {
			return array(
				'success' => false,
				'message' => $plugin_data->error,
			);
		}

		$install_slug = $this->get_install_slug( $plugin_slug, $plugin_data );

		// Check if plugin already exists.
		if ( $this->plugin_exists( $install_slug ) ) {
			return array(
				'success' => false,
				'message' => 'Plugin already exists.',
			);
		}

		// Download and install the plugin.
		$install_result = $this->download_and_install_plugin( $plugin_data, $install_slug );

		if ( ! $install_result['success'] ) {
			return $install_result;
		}

		// Auto-activate if requested.
		if ( $auto_activate ) {
			$activate_result             = $this->activate_plugin( $install_slug );
			$install_result['activated'] = $activate_result;
		}

		return $install_result;
	}

	/**
	 * Fetches plugin metadata from the Frappe server.
	 *
	 * @param string $plugin_slug The plugin slug.
	 * @return object|false
	 */
	private function fetch_plugin_data( $plugin_slug ) {
		$request_args = array(
			'plugin_slug' => $plugin_slug,
			'license'     => $this->license_key,
			'url'         => home_url(),
		);

		$response = $this->post_request( $this->api_url, $request_args, self::REQUEST_TIMEOUT );

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return false;
		}

		$plugin_data = json_decode( wp_remote_retrieve_body( $response ) );

		if ( ! is_object( $plugin_data ) ) {
			return false;
		}

		return $plugin_data;
	}

	/**
	 * Get the download link for a plugin without installing it.
	 *
	 * Calls the same `get_plugin_for_install` endpoint used by `install_plugin()`
	 * and returns only the download URL.
	 *
	 * @param string $plugin_slug The plugin slug.
	 * @return string|null The download URL, or null on failure.
	 */
	public function get_download_link( $plugin_slug ) {
		$plugin_data = $this->fetch_plugin_data( sanitize_title( $plugin_slug ) );

		if ( ! $plugin_data || isset( $plugin_data->error ) || empty( $plugin_data->download_link ) ) {
			return null;
		}

		return esc_url_raw( $plugin_data->download_link );
	}

	/**
	 * Download and install the plugin from the secure download link.
	 *
	 * @param object $plugin_data Plugin data from API.
	 * @param string $plugin_slug Plugin slug.
	 * @return array Installation result.
	 */
	private function download_and_install_plugin( $plugin_data, $plugin_slug ) {
		if ( ! isset( $plugin_data->download_link ) ) {
			return array(
				'success' => false,
				'message' => 'No download link provided.',
			);
		}

		// Download the plugin file.
		$download_response = $this->get_request( $plugin_data->download_link, self::DOWNLOAD_TIMEOUT );

		if ( is_wp_error( $download_response ) || 200 !== wp_remote_retrieve_response_code( $download_response ) ) {
			return array(
				'success' => false,
				'message' => 'Failed to download plugin file.',
			);
		}

		$plugin_zip = wp_remote_retrieve_body( $download_response );

		if ( empty( $plugin_zip ) ) {
			return array(
				'success' => false,
				'message' => 'Downloaded plugin file is empty.',
			);
		}

		// Create temporary file.
		$temp_file = wp_tempnam( $plugin_slug . '.zip' );

		if ( empty( $temp_file ) ) {
			return array(
				'success' => false,
				'message' => 'Could not create a temporary file for the download.',
			);
		}

		global $wp_filesystem;

		if ( ! $wp_filesystem ) {
			$this->load_wordpress_filesystem_dependencies();
			WP_Filesystem();
		}

		$bytes_written = $wp_filesystem->put_contents( $temp_file, $plugin_zip, FS_CHMOD_FILE );

		if ( false === $bytes_written ) {
			if ( $wp_filesystem->exists( $temp_file ) ) {
				$wp_filesystem->delete( $temp_file );
			}

			return array(
				'success' => false,
				'message' => 'Could not write the downloaded plugin archive to disk.',
			);
		}

		// Extract to plugins directory.
		$extract_result = $this->extract_plugin( $temp_file, $plugin_slug );

		// Clean up temp file.
		if ( $wp_filesystem->exists( $temp_file ) ) {
			$wp_filesystem->delete( $temp_file );
		}

		return $extract_result;
	}

	/**
	 * Extract plugin zip to plugins directory.
	 * Handles nested folder structures properly.
	 *
	 * @param string $zip_file    Path to zip file.
	 * @param string $plugin_slug Plugin slug.
	 * @return array Extraction result.
	 */
	private function extract_plugin( $zip_file, $plugin_slug ) {
		$this->load_wordpress_filesystem_dependencies();

		WP_Filesystem();
		global $wp_filesystem;

		if ( ! $wp_filesystem ) {
			return array(
				'success' => false,
				'message' => 'WordPress filesystem could not be initialized.',
			);
		}

		$plugins_dir      = WP_PLUGIN_DIR;
		$final_plugin_dir = $plugins_dir . DIRECTORY_SEPARATOR . $plugin_slug;

		// Ensure plugins directory is writable.
		if ( ! $wp_filesystem->is_writable( $plugins_dir ) ) {
			return array(
				'success' => false,
				'message' => 'Plugins directory is not writable.',
			);
		}

		// Create a temporary extraction directory.
		$temp_extract_dir = $plugins_dir . DIRECTORY_SEPARATOR . $plugin_slug . '_temp_' . wp_generate_password( 8, false );

		// Extract zip file to temporary directory.
		$unzip_result = unzip_file( $zip_file, $temp_extract_dir );

		if ( is_wp_error( $unzip_result ) ) {
			// Clean up temp directory if it was created.
			if ( is_dir( $temp_extract_dir ) ) {
				$wp_filesystem->rmdir( $temp_extract_dir, true );
			}
			return array(
				'success' => false,
				'message' => 'Failed to extract plugin: ' . $unzip_result->get_error_message(),
			);
		}

		// Check the extracted structure.
		$extracted_items = $this->get_directory_entries( $temp_extract_dir );

		// If there's only one directory, we likely have a nested structure.
		if ( count( $extracted_items ) === 1 ) {
			$single_item      = reset( $extracted_items );
			$single_item_path = $temp_extract_dir . DIRECTORY_SEPARATOR . $single_item;

			if ( is_dir( $single_item_path ) ) {
				// Check if this directory contains plugin files (*.php files).
				if ( $this->directory_contains_php_files( $single_item_path ) ) {
					$source_dir = $single_item_path;
				} else {
					$source_dir = $temp_extract_dir;
				}
			} else {
				$source_dir = $temp_extract_dir;
			}
		} else {
			$source_dir = $temp_extract_dir;
		}

		// Remove existing plugin directory if it exists.
		if ( is_dir( $final_plugin_dir ) ) {
			$wp_filesystem->rmdir( $final_plugin_dir, true );
		}

		// Move the source directory to final location.
		$move_result = $wp_filesystem->move( $source_dir, $final_plugin_dir );

		if ( ! $move_result ) {
			// If move failed, try copying.
			$copy_result = copy_dir( $source_dir, $final_plugin_dir );
			if ( is_wp_error( $copy_result ) ) {
				$wp_filesystem->rmdir( $temp_extract_dir, true );
				return array(
					'success' => false,
					'message' => 'Failed to move plugin to plugins directory: ' . $copy_result->get_error_message(),
				);
			}
		}

		// Clean up temp directory.
		if ( is_dir( $temp_extract_dir ) ) {
			$wp_filesystem->rmdir( $temp_extract_dir, true );
		}

		// Verify the plugin was installed correctly by checking for PHP files.
		if ( ! $this->directory_contains_php_files( $final_plugin_dir ) ) {
			return array(
				'success' => false,
				'message' => 'Plugin installation failed: No PHP files found in extracted plugin.',
			);
		}

		return array(
			'success' => true,
			'message' => 'Plugin installed successfully.',
			'path'    => $final_plugin_dir,
		);
	}

	/**
	 * Check if plugin already exists.
	 *
	 * @param string $plugin_slug Plugin slug to check.
	 * @return bool True if plugin exists.
	 */
	private function plugin_exists( $plugin_slug ) {
		$plugin_dir = WP_PLUGIN_DIR . DIRECTORY_SEPARATOR . $plugin_slug;
		return is_dir( $plugin_dir );
	}

	/**
	 * Activate a plugin after installation.
	 *
	 * @param string $plugin_slug Plugin slug to activate.
	 * @return bool True if activated successfully.
	 */
	private function activate_plugin( $plugin_slug ) {
		$this->load_wordpress_plugin_dependencies();

		// Find the main plugin file.
		$plugin_files = $this->get_php_files_in_directory( WP_PLUGIN_DIR . DIRECTORY_SEPARATOR . $plugin_slug );

		foreach ( $plugin_files as $plugin_file ) {
			$plugin_data = get_plugin_data( $plugin_file );
			if ( ! empty( $plugin_data['Name'] ) ) {
				$plugin_basename = plugin_basename( $plugin_file );
				$result          = activate_plugin( $plugin_basename );
				return ! is_wp_error( $result );
			}
		}

		return false;
	}

	/**
	 * Validate license key with server.
	 *
	 * @return bool True if license key is valid.
	 */
	public function validate_license_key() {
		$api_url = str_replace( 'get_plugin_for_install', 'validate_license_key', $this->api_url );

		$request_args = array(
			'license' => $this->license_key,
			'url'     => home_url(),
		);

		$response = $this->post_request( $api_url, $request_args, 10 );

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return false;
		}

		$validation_data = json_decode( wp_remote_retrieve_body( $response ) );

		return isset( $validation_data->valid ) && true === $validation_data->valid;
	}

	/**
	 * Resolve the final slug used for installation.
	 *
	 * @param string $requested_slug Requested plugin slug.
	 * @param object $plugin_data    Plugin metadata response.
	 * @return string
	 */
	private function get_install_slug( $requested_slug, $plugin_data ) {
		if ( isset( $plugin_data->slug ) && is_string( $plugin_data->slug ) ) {
			$resolved_slug = sanitize_title( $plugin_data->slug );

			if ( ! empty( $resolved_slug ) ) {
				return $resolved_slug;
			}
		}

		return $requested_slug;
	}

	/**
	 * Execute a POST request with shared defaults.
	 *
	 * @param string $url     Request URL.
	 * @param array  $body    Request body.
	 * @param int    $timeout Timeout in seconds.
	 * @return array|\WP_Error
	 */
	private function post_request( $url, $body, $timeout ) {
		$request_options = array(
			'timeout'   => $timeout,
			'sslverify' => apply_filters( 'frappe_dispatch_verify_ssl', true ),
			'body'      => $body,
		);

		if ( function_exists( 'vip_safe_wp_remote_post' ) ) {
			return vip_safe_wp_remote_post( $url, false, 3, 3, $timeout, $request_options );
		}

		return wp_remote_post( $url, $request_options ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.wp_remote_get_wp_remote_get
	}

	/**
	 * Execute a GET request with shared defaults.
	 *
	 * @param string $url     Request URL.
	 * @param int    $timeout Timeout in seconds.
	 * @return array|\WP_Error
	 */
	private function get_request( $url, $timeout ) {
		$request_options = array(
			'timeout'   => $timeout,
			'sslverify' => apply_filters( 'frappe_dispatch_verify_ssl', true ),
		);

		if ( function_exists( 'vip_safe_wp_remote_get' ) ) {
			return vip_safe_wp_remote_get( $url, false, 3, 3, $timeout, $request_options );
		}

		return wp_remote_get( $url, $request_options ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.wp_remote_get_wp_remote_get
	}

	/**
	 * Load WordPress filesystem dependencies.
	 *
	 * @return void
	 */
	private function load_wordpress_filesystem_dependencies() {
		if ( ! function_exists( 'unzip_file' ) || ! class_exists( 'WP_Filesystem' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}
	}

	/**
	 * Load WordPress plugin dependencies.
	 *
	 * @return void
	 */
	private function load_wordpress_plugin_dependencies() {
		if ( ! function_exists( 'get_plugin_data' ) || ! function_exists( 'activate_plugin' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}
	}

	/**
	 * Get directory entries excluding dotfiles.
	 *
	 * @param string $directory Directory path.
	 * @return array
	 */
	private function get_directory_entries( $directory ) {
		$entries = scandir( $directory ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.directory_listing_scandir

		if ( false === $entries ) {
			return array();
		}

		return array_values( array_diff( $entries, array( '.', '..' ) ) );
	}

	/**
	 * Get PHP files directly within a directory.
	 *
	 * @param string $directory Directory path.
	 * @return array
	 */
	private function get_php_files_in_directory( $directory ) {
		$files = glob( trailingslashit( $directory ) . '*.php' );

		return is_array( $files ) ? $files : array();
	}

	/**
	 * Determine whether a directory contains PHP files.
	 *
	 * @param string $directory Directory path.
	 * @return bool
	 */
	private function directory_contains_php_files( $directory ) {
		return ! empty( $this->get_php_files_in_directory( $directory ) );
	}
}
