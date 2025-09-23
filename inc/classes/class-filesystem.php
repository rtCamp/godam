<?php
/**
 * Class to handle file system.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class FileSystem
 */
class FileSystem {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$instance = \RTGODAM\Inc\Filesystem\Plugin::get_instance();
		// Always enable URL replacement when the plugin is active.
		$instance->setup_url_filters();

		$rtgodam_settings = get_option( 'rtgodam-settings', array() );
		$offload_enabled  = ! empty( $rtgodam_settings['uploads'] ) && ! empty( $rtgodam_settings['uploads']['offload_media'] );

		if ( rtgodam_is_api_key_valid() && $offload_enabled ) {
			$instance->setup();
		}

		$this->init_filesystem();
	}

	/**
	 * To initialize filesystem.
	 *
	 * @return void
	 */
	protected function init_filesystem() {

		global $wp_filesystem;

		require_once ABSPATH . 'wp-admin/includes/file.php';

		if ( empty( $wp_filesystem ) || ! is_a( $wp_filesystem, 'WP_Filesystem_Base' ) ) {
			$creds = request_filesystem_credentials( site_url() );
			wp_filesystem( $creds );
		}
	}

	/**
	 * Check if file exists in upload directory or not.
	 *
	 * @param string $file File path to check. Either absolute or relative path.
	 *
	 * @return bool True if file is exists, Otherwise False.
	 */
	public static function file_exists( $file ) {

		if ( empty( $file ) ) {
			return false;
		}

		global $wp_filesystem;

		return $wp_filesystem->exists( $file );
	}

	/**
	 * To delete file within upload directory directory.
	 *
	 * @param string $file File path.
	 *
	 * @return bool True on success otherwise False.
	 */
	public static function delete_file( $file ) {

		if ( ! static::file_exists( $file ) ) {
			return false;
		}

		global $wp_filesystem;

		return $wp_filesystem->delete( $file );
	}
}
