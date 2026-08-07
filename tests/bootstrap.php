<?php
/**
 * PHPUnit bootstrap for GoDAM pure (no-WordPress) unit tests.
 *
 * These cover dependency-free logic that can run without a WordPress test
 * install. Full WP-integration tests (HTTP mocking, route registration) need a
 * wp-phpunit bootstrap — a separate follow-up once the harness is wired into CI.
 *
 * Where a unit under test reaches for a small, well-understood slice of the WP
 * API (e.g. Video_Editor's per-type thumbnail resolution), we define narrow
 * stubs below driven by `$GLOBALS['rtgodam_stub']`, which the test sets per
 * case. This keeps those tests pure without pulling in a full WP install.
 *
 * @package GoDAM
 */

if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

// WP core time constants, needed by the cache-TTL defines in custom-functions.php.
if ( ! defined( 'MINUTE_IN_SECONDS' ) ) {
	define( 'MINUTE_IN_SECONDS', 60 );
}
if ( ! defined( 'HOUR_IN_SECONDS' ) ) {
	define( 'HOUR_IN_SECONDS', 60 * MINUTE_IN_SECONDS );
}
if ( ! defined( 'DAY_IN_SECONDS' ) ) {
	define( 'DAY_IN_SECONDS', 24 * HOUR_IN_SECONDS );
}
if ( ! defined( 'WEEK_IN_SECONDS' ) ) {
	define( 'WEEK_IN_SECONDS', 7 * DAY_IN_SECONDS );
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

/*
 * ---------------------------------------------------------------------------
 * Narrow WP stubs for Video_Editor unit tests.
 *
 * Each reads from $GLOBALS['rtgodam_stub'], which VideoEditorTest populates
 * before invoking the method under test (single-value `get_post_meta`
 * semantics — every caller passes $single = true).
 * ---------------------------------------------------------------------------
 */
if ( ! function_exists( 'wp_prepare_attachment_for_js' ) ) {

	/**
	 * @param mixed $post Ignored; the prepared payload is supplied by the test.
	 * @return array
	 */
	function wp_prepare_attachment_for_js( $post ) { // phpcs:ignore Universal.NamingConventions.NoReservedKeywordParameterNames.postFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found -- signature mirrors the WP function; args are ignored.
		return isset( $GLOBALS['rtgodam_stub']['prepared'] ) && is_array( $GLOBALS['rtgodam_stub']['prepared'] )
			? $GLOBALS['rtgodam_stub']['prepared']
			: array();
	}
}

if ( ! function_exists( 'get_post_meta' ) ) {

	/**
	 * @param int    $post_id Ignored (single post per test).
	 * @param string $key     Meta key.
	 * @param bool   $single  Ignored; always single-value semantics.
	 * @return mixed
	 */
	function get_post_meta( $post_id, $key = '', $single = false ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- signature mirrors the WP function; $post_id/$single are ignored.
		$meta = isset( $GLOBALS['rtgodam_stub']['post_meta'] ) && is_array( $GLOBALS['rtgodam_stub']['post_meta'] )
			? $GLOBALS['rtgodam_stub']['post_meta']
			: array();
		return array_key_exists( $key, $meta ) ? $meta[ $key ] : '';
	}
}

if ( ! function_exists( 'get_post_mime_type' ) ) {

	/**
	 * @param mixed $post Ignored; the mime type is supplied by the test.
	 * @return string
	 */
	function get_post_mime_type( $post = null ) { // phpcs:ignore Universal.NamingConventions.NoReservedKeywordParameterNames.postFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found -- signature mirrors the WP function; args are ignored.
		return isset( $GLOBALS['rtgodam_stub']['mime'] ) ? (string) $GLOBALS['rtgodam_stub']['mime'] : '';
	}
}

if ( ! function_exists( 'wp_get_attachment_url' ) ) {

	/**
	 * @param int $post_id Ignored; the URL is supplied by the test.
	 * @return string
	 */
	function wp_get_attachment_url( $post_id = 0 ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found -- signature mirrors the WP function; $post_id is ignored.
		return isset( $GLOBALS['rtgodam_stub']['attachment_url'] ) ? (string) $GLOBALS['rtgodam_stub']['attachment_url'] : '';
	}
}

if ( ! function_exists( 'get_the_title' ) ) {

	/**
	 * @param mixed $post Ignored; the title is supplied by the test.
	 * @return string
	 */
	function get_the_title( $post = 0 ) { // phpcs:ignore Universal.NamingConventions.NoReservedKeywordParameterNames.postFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found -- signature mirrors the WP function; args are ignored.
		return isset( $GLOBALS['rtgodam_stub']['title'] ) ? (string) $GLOBALS['rtgodam_stub']['title'] : '';
	}
}

if ( ! function_exists( 'date_i18n' ) ) {

	/**
	 * @param string   $format    Date format.
	 * @param int|null $timestamp Unix timestamp.
	 * @return string
	 */
	function date_i18n( $format, $timestamp = null ) {
		return gmdate( $format, null === $timestamp ? 0 : (int) $timestamp );
	}
}

if ( ! function_exists( 'absint' ) ) {

	/**
	 * @param mixed $maybeint Value to convert.
	 * @return int
	 */
	function absint( $maybeint ) {
		return abs( (int) $maybeint );
	}
}

if ( ! function_exists( 'wp_parse_url' ) ) {

	/**
	 * @param string $url       URL to parse.
	 * @param int    $component Component to retrieve, per parse_url().
	 * @return mixed
	 */
	function wp_parse_url( $url, $component = -1 ) {
		return parse_url( $url, $component ); // phpcs:ignore WordPress.WP.AlternativeFunctions.parse_url_parse_url -- this stub is what wp_parse_url() wraps.
	}
}

// Empty stand-in for the WP core base so Video_Editor's parent chain resolves
// without a WordPress install; the constructor is never run (tests build the
// object with ReflectionClass::newInstanceWithoutConstructor()).
if ( ! class_exists( 'WP_REST_Controller' ) ) {
	class WP_REST_Controller {} // phpcs:ignore Universal.Files.SeparateFunctionsFromOO.Mixed
}

/*
 * Hook registry and translation-recording stubs. These let the #465 guards
 * assert behaviour — which hook a callback lands on, and whether anything
 * translates while an early hook runs — rather than the shape of the source.
 */
require_once __DIR__ . '/stubs/hooks.php';
require_once __DIR__ . '/stubs/i18n.php';

// Version-compatibility checks read this. High enough that any add-on minimum
// passes, so tests exercising the incompatible branch raise their own minimum.
if ( ! defined( 'RTGODAM_VERSION' ) ) {
	define( 'RTGODAM_VERSION', '99.0.0' );
}

require_once dirname( __DIR__ ) . '/inc/traits/trait-singleton.php';
require_once dirname( __DIR__ ) . '/inc/classes/addons/class-abstract-addon.php';
require_once dirname( __DIR__ ) . '/inc/classes/addons/class-addon-registry.php';
require_once dirname( __DIR__ ) . '/inc/classes/wpforms/class-wpforms-integration.php';
require_once dirname( __DIR__ ) . '/inc/classes/fluentforms/class-init.php';
require_once dirname( __DIR__ ) . '/inc/classes/rest-api/class-base.php';
require_once dirname( __DIR__ ) . '/inc/classes/rest-api/class-video-editor.php';
require_once dirname( __DIR__ ) . '/inc/classes/rest-api/class-gf.php';
// Polls::shape_poll_answers is static and pure; loading the class needs only the
// REST base above plus the wp_strip_all_tags / absint stubs.
require_once dirname( __DIR__ ) . '/inc/classes/rest-api/class-polls.php';

require_once dirname( __DIR__ ) . '/inc/classes/rest-api/class-onboarding-response.php';

// Helper functions under test (godam_is_supported_document). The file only
// declares functions plus a few guarded define()s, so it is safe to load here.
require_once dirname( __DIR__ ) . '/inc/helpers/custom-functions.php';
