<?php
/**
 * Autoloader file for plugin.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Helpers;

defined( 'ABSPATH' ) || exit;

/**
 * Auto loader function.
 *
 * @param string $file_resource Source namespace.
 *
 * @return void
 */
function autoloader( $file_resource = '' ) {

	$resource_path  = false;
	$namespace_root = 'RTGODAM\\';
	$file_resource  = trim( $file_resource, '\\' );

	if ( empty( $file_resource ) || strpos( $file_resource, '\\' ) === false || strpos( $file_resource, $namespace_root ) !== 0 ) {
		// Not our namespace, bail out.
		return;
	}

	// Remove our root namespace.
	$file_resource = str_replace( $namespace_root, '', $file_resource );

	$path = explode(
		'\\',
		str_replace( '_', '-', strtolower( $file_resource ) )
	);

	/**
	 * Time to determine which type of resource path it is,
	 * so that we can deduce the correct file path for it.
	 */
	if ( empty( $path[0] ) || empty( $path[1] ) ) {
		return;
	}

	$directory = '';
	$file_name = '';

	if ( 'inc' === $path[0] ) {

		switch ( $path[1] ) {
			case 'traits':
				$directory = 'traits';
				$file_name = sprintf( 'trait-%s', trim( strtolower( $path[2] ) ) );
				break;
			case 'helpers':
				$directory = 'helpers';
				$file_name = sprintf( 'class-%s', trim( strtolower( $path[2] ) ) );
				break;
			case 'providers':
			case 'media-library': // phpcs:ignore
			case 'meta-boxes': // phpcs:ignore
			case 'filesystem': // phpcs:ignore
			case 'rest-controller': // phpcs:ignore
			case 'post-types': // phpcs:ignore
			case 'taxonomies': // phpcs:ignore
			case 'rest-api': // phpcs:ignore
			case 'gravity-forms': // phpcs:ignore
			case 'sureforms':
			case 'fluentforms':
			case 'shortcodes': // phpcs:ignore
			case 'cron-jobs': // phpcs:ignore
			case 'elementor-widgets': // phpcs:ignore
			case 'elementor-controls': // phpcs:ignore
			case 'wpforms': // phpcs:ignore
			case 'ninja-forms': // phpcs:ignore
			case 'everest-forms': // phpcs:ignore
			case 'metform': // phpcs:ignore
			case 'lifter-lms': // phpcs:ignore
				/**
				 * If there is class name provided for specific directory then load that.
				 * otherwise find in inc/ directory.
				 */
				if ( ! empty( $path[2] ) ) {
					$sub_directories = implode( '/', array_slice( $path, 2, -1 ) ); // Handle nested items.
					$directory       = sprintf( 'classes/%s/%s', $path[1], $sub_directories );
					$file_name       = sprintf( 'class-%s', trim( strtolower( end( $path ) ) ) );
					break;
				}
			default:
				$directory = 'classes';
				$file_name = sprintf( 'class-%s', trim( strtolower( $path[1] ) ) );
				break;
		}

		$resource_path = sprintf( '%s/inc/%s/%s.php', untrailingslashit( RTGODAM_PATH ), $directory, $file_name );

	}

	$resource_path_valid = validate_file( $resource_path );

	if ( ! empty( $resource_path ) && file_exists( $resource_path ) && ( 0 === $resource_path_valid || 2 === $resource_path_valid ) ) {
		// We already making sure that file is exists and valid.
		require_once $resource_path; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingVariable
	}
}

spl_autoload_register( __NAMESPACE__ . '\autoloader' );
