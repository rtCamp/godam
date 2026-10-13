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
class Godam_Frappe_Dispatch_Installer {

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

		$this->load_wordpress_upgrader_dependencies();

		// Force the installed folder name to match the resolved slug so that
		// plugin_exists() and activate_plugin() can locate it deterministically,
		// regardless of the top-level folder name inside the downloaded archive.
		$rename_source = $this->get_source_rename_callback( $plugin_slug );
		add_filter( 'upgrader_source_selection', $rename_source, 10, 2 );

		// Let WordPress core handle the download, extraction and install into the
		// plugins directory via the sanctioned upgrader, instead of writing into
		// the plugins folder from this plugin's own code (which Plugin Check flags).
		$skin     = new \Automatic_Upgrader_Skin();
		$upgrader = new \Plugin_Upgrader( $skin );

		$result = $upgrader->install(
			esc_url_raw( $plugin_data->download_link ),
			array( 'overwrite_package' => false )
		);

		remove_filter( 'upgrader_source_selection', $rename_source, 10 );

		if ( is_wp_error( $result ) ) {
			return array(
				'success' => false,
				'message' => 'Failed to install plugin: ' . $result->get_error_message(),
			);
		}

		if ( true !== $result ) {
			$skin_errors = $skin->get_errors();
			$message     = ( is_wp_error( $skin_errors ) && $skin_errors->has_errors() )
				? $skin_errors->get_error_message()
				: 'Plugin installation failed.';

			return array(
				'success' => false,
				'message' => $message,
			);
		}

		return array(
			'success' => true,
			'message' => 'Plugin installed successfully.',
			'path'    => WP_PLUGIN_DIR . DIRECTORY_SEPARATOR . $plugin_slug,
		);
	}

	/**
	 * Build an `upgrader_source_selection` callback that renames the extracted
	 * source folder to the desired slug before WordPress installs it.
	 *
	 * The rename happens inside the upgrader's working directory (not the plugins
	 * directory), so it does not trip the Plugin Check filesystem warnings.
	 *
	 * @param string $desired_slug Folder name the plugin should be installed under.
	 * @return callable
	 */
	private function get_source_rename_callback( $desired_slug ) {
		return function ( $source, $remote_source ) use ( $desired_slug ) {
			global $wp_filesystem;

			if ( empty( $desired_slug ) || is_wp_error( $source ) || ! $wp_filesystem ) {
				return $source;
			}

			$current_name = basename( untrailingslashit( $source ) );

			if ( $current_name === $desired_slug ) {
				return $source;
			}

			$new_source = trailingslashit( $remote_source ) . $desired_slug;

			if ( $wp_filesystem->move( untrailingslashit( $source ), $new_source, true ) ) {
				return trailingslashit( $new_source );
			}

			return $source;
		};
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
			'sslverify' => apply_filters( 'godam_frappe_dispatch_verify_ssl', true ),
			'body'      => $body,
		);

		if ( function_exists( 'vip_safe_wp_remote_post' ) ) {
			return vip_safe_wp_remote_post( $url, false, 3, 3, $timeout, $request_options );
		}

		return wp_remote_post( $url, $request_options ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.wp_remote_get_wp_remote_get
	}

	/**
	 * Load the WordPress core upgrader dependencies used to install plugins.
	 *
	 * @return void
	 */
	private function load_wordpress_upgrader_dependencies() {
		if ( ! function_exists( 'request_filesystem_credentials' ) ) {
			require_once ABSPATH . 'wp-admin/includes/file.php';
		}

		if ( ! class_exists( 'WP_Upgrader' ) ) {
			require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
		}

		if ( ! function_exists( 'get_plugin_data' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
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
	 * Get PHP files directly within a directory.
	 *
	 * @param string $directory Directory path.
	 * @return array
	 */
	private function get_php_files_in_directory( $directory ) {
		$files = glob( trailingslashit( $directory ) . '*.php' );

		return is_array( $files ) ? $files : array();
	}
}
