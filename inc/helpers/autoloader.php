<?php
/**
 * Autoloader file for plugin.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\Helpers;

/**
 * Auto loader function.
 *
 * @param string $resource Source namespace.
 *
 * @return void
 */
function autoloader( $resource = '' ) {

	$resource_path  = false;
	$namespace_root = 'Transcoder\\';
	$resource       = trim( $resource, '\\' );

	if ( empty( $resource ) || strpos( $resource, '\\' ) === false || strpos( $resource, $namespace_root ) !== 0 ) {
		// Not our namespace, bail out.
		return;
	}

	// Remove our root namespace.
	$resource = str_replace( $namespace_root, '', $resource );

	$path = explode(
		'\\',
		str_replace( '_', '-', strtolower( $resource ) )
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
			case 'providers':
			case 'meta-boxes': // phpcs:ignore
			case 'rest-controller': // phpcs:ignore
			case 'taxonomies': // phpcs:ignore
			case 'rest-api': // phpcs:ignore
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

		$resource_path = sprintf( '%s/inc/%s/%s.php', untrailingslashit( RT_TRANSCODER_PATH ), $directory, $file_name );

	}

	$resource_path_valid = validate_file( $resource_path );

	if ( ! empty( $resource_path ) && file_exists( $resource_path ) && ( 0 === $resource_path_valid || 2 === $resource_path_valid ) ) {
		// We already making sure that file is exists and valid.
		require_once $resource_path; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingVariable
	}
}

spl_autoload_register( __NAMESPACE__ . '\autoloader' );
