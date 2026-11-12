<?php
/**
 * Stubs and loaders for the Vimeo migration unit tests.
 *
 * @package GoDAM
 */

if ( ! function_exists( 'untrailingslashit' ) ) {

	/**
	 * WordPress core's untrailingslashit().
	 *
	 * @param string $value Value.
	 *
	 * @return string
	 */
	function untrailingslashit( $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return rtrim( $value, '/\\' );
	}
}

require_once __DIR__ . '/video-seo-functions.php';
require_once __DIR__ . '/shortcode-functions.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/class-seo.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-video-migration.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/vimeo-migration/class-vimeo-url.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/vimeo-migration/class-vimeo-resolver.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/vimeo-migration/class-elementor-source.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/vimeo-migration/class-wpbakery-source.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/vimeo-migration/class-acf-source.php';
