<?php
/**
 * API Cache Class
 * This class is responsible for caching API files and their stats locally.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Filesystem;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class API_Cache
 *
 * This class handles the caching of API files and their stats.
 * It creates temporary files in the system's temp directory and manages them.
 *
 * @since n.e.x.t
 */
class API_Cache {

	use Singleton;

	/**
	 * @var array   Array of created local cache files
	 *
	 * @since n.e.x.t
	 */
	private $files = array();

	/**
	 * @var array   Array of cached file stats
	 *
	 * @since n.e.x.t
	 */
	private $file_stats = array();

	/**
	 * @var string  Temp directory to cache file in
	 *
	 * @since n.e.x.t
	 */
	private $tmp_dir = '/tmp';

	/**
	 * API_Cache constructor.
	 *
	 * @since n.e.x.t
	 */
	protected function __construct() {
		$this->tmp_dir = get_temp_dir();

		add_action( 'shutdown', array( $this, 'clear_tmp_files' ) );
	}

	/**
	 * Clear temporary files created by this class.
	 *
	 * This method is called on shutdown to ensure that temporary files are cleaned up.
	 * It will remove all cached files and empty the file stats cache.
	 *
	 * @since n.e.x.t
	 */
	public function clear_tmp_files() {
		if ( empty( $this->files ) && empty( $this->file_stats ) ) {
			return;
		}

		foreach ( $this->files as $name => $path ) {
			unlink( $path );                // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_unlink
			unset( $this->files[ $name ] );
		}

		// empty file stats cache.
		$this->file_stats = array();
	}

	/**
	 * Get a cached file by its path.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $filepath The path of the file.
	 *
	 * @return string|false The local file path if available, false otherwise.
	 */
	public function get_file( $filepath ) {
		if ( isset( $this->files[ $filepath ] ) ) {
			return $this->files[ $filepath ];
		}

		return false;
	}

	/**
	 * Get cached file stats for a specific file.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $filepath The path of the file.
	 *
	 * @return array|false An associative array containing file stats if available, false otherwise.
	 */
	public function get_file_stats( $filepath ) {
		if ( isset( $this->file_stats[ $filepath ] ) ) {
			return $this->file_stats[ $filepath ];
		}

		return false;
	}

	/**
	 * Cache a file with its local path.
	 *
	 * This will overwrite existing file if any.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $filepath   The path of the file.
	 * @param string $local_file The local file path to cache.
	 */
	public function cache_file( $filepath, $local_file ) {
		$this->files[ $filepath ] = $local_file;
	}

	/**
	 * Cache file stats for a specific file.
	 *
	 * This will overwrite existing stats if any.
	 *
	 * @param string $filepath The path of the file.
	 * @param array  $info     An associative array containing file stats (e.g., size, type, etc.).
	 */
	public function cache_file_stats( $filepath, $info ) {
		// This will overwrite existing stats if any.
		$this->file_stats[ $filepath ] = $info;
	}

	/**
	 * Copy a file to the cache directory.
	 *
	 * If the destination file does not exist, it will create a temporary file
	 * with a unique name in the system's temp directory.

	 * @since n.e.x.t
	 *
	 * @param string $dst The destination path in the cache.
	 * @param string $src The source file path to copy from.
	 */
	public function copy_to_cache( $dst, $src ) {
		if ( ! isset( $this->files[ $dst ] ) ) {
			// create file with unique filename.
			$tmp_file = $this->create_tmp_file();

			$this->files[ $dst ] = $tmp_file;
		}

		// This will overwrite existing file if any.
		copy( $src, $this->files[ $dst ] );
	}

	/**
	 * Remove a file from the cache and delete it from the filesystem.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $filepath The path of the file to be removed.
	 */
	public function remove_file( $filepath ) {
		if ( isset( $this->files[ $filepath ] ) ) {
			// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_unlink
			unlink( $this->files[ $filepath ] );
			unset( $this->files[ $filepath ] );
		}

		// Remove cached stats too if any.
		unset( $this->file_stats[ $filepath ] );
	}

	/**
	 * Remove cached stats for a specific file.
	 *
	 * @since n.e.x.t
	 *
	 * @param string $filepath The path of the file whose stats should be removed.
	 */
	public function remove_stats( $filepath ) {
		// Remove cached stats if any.
		unset( $this->file_stats[ $filepath ] );
	}

	/**
	 * Create a temporary file in the system's temp directory.
	 *
	 * @since n.e.x.t
	 *
	 * @return string Path to the created temporary file.
	 */
	public function create_tmp_file() {
		// phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.file_ops_tempnam
		return tempnam( $this->tmp_dir, 'godam-uploads' );
	}
}
