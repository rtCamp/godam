<?php
/**
 * Helper functions for GoDAM for Woo.
 *
 * @package GoDAM_Woo
 * @since 1.0.0
 */

defined( 'ABSPATH' ) || exit;

/**
 * Returns the file modification time for versioning, falling back to an asset file version or current time.
 *
 * @param string $filepath Absolute path to the file.
 *
 * @return string|int
 */
function godam_woo_get_asset_version( $filepath ) {
	if ( file_exists( $filepath ) ) {
		return (string) filemtime( $filepath );
	}

	$asset_file = str_replace( array( '.min.js', '.css' ), '', $filepath ) . '.asset.php';

	if ( file_exists( $asset_file ) ) {
		$asset = require $asset_file; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingVariable
		return $asset['version'] ?? time();
	}

	return (string) time();
}
