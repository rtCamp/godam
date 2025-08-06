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
		// Defer filesystem initialization until WordPress is fully loaded
		add_action( 'init', array( $this, 'init_file_system' ) );
	}

	/**
	 * To initialize file system.
	 *
	 * @return void
	 */
	public function init_file_system() {

		global $wp_filesystem;

		// Only initialize if we haven't already done so
		if ( ! empty( $wp_filesystem ) && is_a( $wp_filesystem, 'WP_Filesystem_Base' ) ) {
			return;
		}

		require_once ABSPATH . 'wp-admin/includes/file.php';

		// Try to initialize without credentials first (for most hosting environments)
		if ( ! WP_Filesystem() ) {
			// If that fails, check if we're in admin context before requesting credentials
			if ( is_admin() ) {
				$creds = request_filesystem_credentials( site_url() );
				wp_filesystem( $creds );
			}
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

		// Ensure filesystem is initialized
		static::ensure_filesystem_initialized();

		global $wp_filesystem;

		// Fallback to native PHP if filesystem is not available
		if ( empty( $wp_filesystem ) || ! is_a( $wp_filesystem, 'WP_Filesystem_Base' ) ) {
			return file_exists( $file );
		}

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

		// Ensure filesystem is initialized
		static::ensure_filesystem_initialized();

		global $wp_filesystem;

		// Fallback to native PHP if filesystem is not available
		if ( empty( $wp_filesystem ) || ! is_a( $wp_filesystem, 'WP_Filesystem_Base' ) ) {
			return unlink( $file );
		}

		return $wp_filesystem->delete( $file );
	}

	/**
	 * Ensure filesystem is initialized before use.
	 *
	 * @return void
	 */
	protected static function ensure_filesystem_initialized() {
		$instance = static::get_instance();
		$instance->init_file_system();
	}
}
