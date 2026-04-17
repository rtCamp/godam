<?php
/**
 * Integrations loader.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Integrations.
 */
class Integrations {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		add_action( 'plugins_loaded', array( $this, 'load_integrations' ), 20 );
	}

	/**
	 * Load all integration bootstraps.
	 *
	 * @return void
	 */
	public function load_integrations() {
		if ( ! defined( 'RTGODAM_PATH' ) ) {
			return;
		}

		$base_path = untrailingslashit( RTGODAM_PATH ) . '/integrations';

		if ( ! is_dir( $base_path ) ) {
			return;
		}

		$base_real_path = realpath( $base_path );
		if ( false === $base_real_path ) {
			return;
		}
		$base_real_path = rtrim( $base_real_path, '/\\' ) . DIRECTORY_SEPARATOR;

		$files = array();

		// Common layout: integrations/<integration>/class-bootstrap.php.
		$files = array_merge( $files, glob( $base_path . '/*/class-bootstrap.php' ) ?: array() );

		$files = array_values( array_unique( array_filter( $files ) ) );
		sort( $files );

		foreach ( $files as $file_path ) {
			$real_file_path = realpath( $file_path );
			if ( false === $real_file_path || ! is_file( $real_file_path ) || 0 !== strpos( $real_file_path, $base_real_path ) ) {
				continue;
			}

			require_once $real_file_path; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingVariable
		}
	}
}
