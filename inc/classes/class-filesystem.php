<?php
/**
 * Class to handle file system.
 *
 * @package transcoder
 */

namespace Transcoder\Inc;

use Transcoder\Inc\Traits\Singleton;

/**
 * Class FileSystem
 */
class FileSystem {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {

		$this->init_file_system();
	}

	/**
	 * To initialize file system.
	 *
	 * @return void
	 */
	protected function init_file_system() {

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
