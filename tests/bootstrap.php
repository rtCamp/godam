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

// Narrow stubs used by Release_Post's feature parser (ReleasePostFeatureParsingTest).
if ( ! function_exists( 'sanitize_text_field' ) ) {

	/**
	 * @param string $str Input.
	 * @return string
	 */
	function sanitize_text_field( $str ) {
		return trim( preg_replace( '/[\r\n\t ]+/', ' ', wp_strip_all_tags( (string) $str ) ) );
	}
}

if ( ! function_exists( 'esc_url' ) ) {

	/**
	 * @param string $url Input.
	 * @return string
	 */
	function esc_url( $url ) {
		return (string) $url;
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

if ( ! function_exists( 'wp_get_upload_dir' ) ) {

	/**
	 * @return array Uploads directory info; only `baseurl` is consumed.
	 */
	function wp_get_upload_dir() {
		$baseurl = isset( $GLOBALS['rtgodam_stub']['uploads_baseurl'] )
			? (string) $GLOBALS['rtgodam_stub']['uploads_baseurl']
			: 'https://example.com/wp-content/uploads';

		return array( 'baseurl' => $baseurl );
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
 * ---------------------------------------------------------------------------
 * Stubs for the Release_Post caller boundary (ReleasePostFeatureParsingTest's
 * get_release_post() test). The HTTP + transient responses are driven by
 * $GLOBALS['rtgodam_stub'] so a test can feed a canned remote payload and force
 * a cache miss, exercising the full fetch -> parse path without WordPress.
 * ---------------------------------------------------------------------------
 */
if ( ! defined( 'RTGODAM_IO_API_BASE' ) ) {
	define( 'RTGODAM_IO_API_BASE', 'https://godam.io' );
}

if ( ! class_exists( 'WP_Error' ) ) {
	class WP_Error { // phpcs:ignore Universal.Files.SeparateFunctionsFromOO.Mixed
		/**
		 * @param mixed $code    Ignored.
		 * @param mixed $message Ignored.
		 * @param mixed $data    Ignored.
		 */
		public function __construct( $code = '', $message = '', $data = '' ) {} // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
	}
}

if ( ! class_exists( 'WP_REST_Response' ) ) {
	class WP_REST_Response { // phpcs:ignore Universal.Files.SeparateFunctionsFromOO.Mixed
		/** @var mixed */
		public $data;

		/**
		 * @param mixed $data   Response payload.
		 * @param int   $status Ignored.
		 */
		public function __construct( $data = null, $status = 200 ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
			$this->data = $data;
		}

		/** @return mixed */
		public function get_data() {
			return $this->data;
		}
	}
}

if ( ! function_exists( 'wp_json_encode' ) ) {

	/**
	 * @param mixed $data Data to encode.
	 * @return string|false
	 */
	function wp_json_encode( $data ) {
		return json_encode( $data ); // phpcs:ignore WordPress.WP.AlternativeFunctions.json_encode_json_encode
	}
}

if ( ! function_exists( 'is_wp_error' ) ) {

	/**
	 * @param mixed $thing Value to test.
	 * @return bool
	 */
	function is_wp_error( $thing ) {
		return $thing instanceof \WP_Error;
	}
}

if ( ! function_exists( 'wp_remote_get' ) ) {

	/**
	 * @param string $url  Requested URL (recorded).
	 * @param array  $args Ignored.
	 * @return mixed
	 */
	function wp_remote_get( $url, $args = array() ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed, WordPress.WP.AlternativeFunctions.wp_remote_get_wp_remote_get
		$GLOBALS['rtgodam_stub']['last_remote_url'] = $url;
		return $GLOBALS['rtgodam_stub']['remote_response'] ?? array();
	}
}

if ( ! function_exists( 'wp_remote_retrieve_response_code' ) ) {

	/**
	 * @param mixed $response Ignored; the code is supplied by the test.
	 * @return int
	 */
	function wp_remote_retrieve_response_code( $response ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
		return (int) ( $GLOBALS['rtgodam_stub']['remote_code'] ?? 200 );
	}
}

if ( ! function_exists( 'wp_remote_retrieve_body' ) ) {

	/**
	 * @param mixed $response Ignored; the body is supplied by the test.
	 * @return string
	 */
	function wp_remote_retrieve_body( $response ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.Found
		return (string) ( $GLOBALS['rtgodam_stub']['remote_body'] ?? '' );
	}
}

if ( ! function_exists( 'get_transient' ) ) {

	/**
	 * @param string $key Transient key.
	 * @return mixed False on a miss.
	 */
	function get_transient( $key ) {
		return $GLOBALS['rtgodam_stub']['transient'][ $key ] ?? false;
	}
}

if ( ! function_exists( 'set_transient' ) ) {

	/**
	 * @param string $key        Transient key.
	 * @param mixed  $value      Value to store.
	 * @param int    $expiration Ignored.
	 * @return true
	 */
	function set_transient( $key, $value, $expiration = 0 ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		$GLOBALS['rtgodam_stub']['transient'][ $key ] = $value;
		return true;
	}
}

/*
 * Hook registry and translation-recording stubs. These let the #465 guards
 * assert behaviour — which hook a callback lands on, and whether anything
 * translates while an early hook runs — rather than the shape of the source.
 */
require_once __DIR__ . '/stubs/hooks.php';
require_once __DIR__ . '/stubs/i18n.php';
// HTTP / REST stubs for the Analytics microservice-proxy tests (fetch_top_videos
// / fetch_top_products): fake wp_remote_* responses + get_option, and minimal
// WP_REST_Request / WP_REST_Response so the proxy's error-vs-empty guard can be
// asserted without a WordPress test install.
require_once __DIR__ . '/stubs/class-wp-rest-request.php';
require_once __DIR__ . '/stubs/class-wp-rest-response.php';
require_once __DIR__ . '/stubs/wp-http-functions.php';

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
require_once dirname( __DIR__ ) . '/inc/classes/rest-api/class-analytics.php';

require_once dirname( __DIR__ ) . '/inc/classes/rest-api/class-onboarding-response.php';

// Loaded for its feature parser (ReleasePostFeatureParsingTest reaches
// parse_features_from_content() through reflection). The class extends the
// stubbed Base and touches WordPress only inside its route callback, so
// requiring the file runs no WP code.
require_once dirname( __DIR__ ) . '/inc/classes/rest-api/class-release-post.php';

// Loaded for its media-type => MIME map, which RetranscodeMediaTypeMapTest reaches
// through reflection. The class extends the stubbed Base above and touches WordPress
// only inside its route callbacks, so requiring the file runs no WP code.
require_once dirname( __DIR__ ) . '/inc/classes/rest-api/class-transcoding.php';

// Helper functions under test (godam_is_supported_document). The file only
// declares functions plus a few guarded define()s, so it is safe to load here.
require_once dirname( __DIR__ ) . '/inc/helpers/custom-functions.php';
