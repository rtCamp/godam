<?php
/**
 * PHPUnit bootstrap for GoDAM pure (no-WordPress) unit tests.
 *
 * These cover dependency-free logic that can run without a WordPress test
 * install. Full WP-integration tests (HTTP mocking, route registration) need a
 * wp-phpunit bootstrap — a separate follow-up once the harness is wired into CI.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

// Minimal stub so the parsing helper can run outside WordPress.
if ( ! function_exists( 'wp_strip_all_tags' ) ) {

	/**
	 * @param string $text Input.
	 * @return string
	 */
	function wp_strip_all_tags( $text ) {
		return trim( preg_replace( '/<[^>]*>/', '', (string) $text ) );
	}
}

require_once dirname( __DIR__ ) . '/inc/classes/rest-api/class-onboarding-response.php';
