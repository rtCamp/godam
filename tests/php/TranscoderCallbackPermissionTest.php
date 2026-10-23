<?php
/**
 * Who may call the transcoder and transcription callbacks.
 *
 * GoDAM Central calls both with the site's API key in the form-encoded request body. The key is
 * read from the body only, a URL that carries it is not accepted, and it is compared in
 * constant time.
 *
 * The WP_REST_Request stand-in in the suite only answers get_param(), so each test builds a
 * request double that keeps the body, the JSON body and the query string apart, as the real
 * request does.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * @covers \RTGODAM_Transcoder_Rest_Routes::verify_callback_permission
 * @covers \RTGODAM_Transcoder_Rest_Routes::get_callback_api_key
 * @covers \RTGODAM_Transcoder_Rest_Routes::register_routes
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class TranscoderCallbackPermissionTest extends TestCase {

	/**
	 * The key stored on the site.
	 */
	const SITE_KEY = 'made-up-site-key-0123456789abcdef';

	/**
	 * Load the routes class and put a key on the site.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array( 'options' => array( 'rtgodam-api-key' => self::SITE_KEY ) );

		require_once dirname( __DIR__, 2 ) . '/admin/class-rtgodam-transcoder-rest-routes.php';
	}

	/**
	 * The key in the form body, as GoDAM Central sends it, is accepted.
	 */
	public function test_the_key_in_the_form_body_is_accepted() {
		$this->assertTrue( $this->routes()->verify_callback_permission( $this->request( array( 'api_key' => self::SITE_KEY ) ) ) );
	}

	/**
	 * A JSON body carries the key as well.
	 */
	public function test_the_key_in_a_json_body_is_accepted() {
		$this->assertTrue( $this->routes()->verify_callback_permission( $this->request( array(), array(), array( 'api_key' => self::SITE_KEY ) ) ) );
	}

	/**
	 * The key is cleaned the way the route's api_key argument always cleaned it, so surrounding space does not matter.
	 */
	public function test_the_key_is_cleaned_before_it_is_compared() {
		$this->assertTrue( $this->routes()->verify_callback_permission( $this->request( array( 'api_key' => '  ' . self::SITE_KEY . "\n" ) ) ) );
	}

	/**
	 * A key in the query string is not looked at.
	 */
	public function test_the_key_in_the_query_string_is_not_accepted() {
		$result = $this->routes()->verify_callback_permission( $this->request( array(), array( 'api_key' => self::SITE_KEY ) ) );

		$this->assertForbidden( $result, 'API key is required.' );
	}

	/**
	 * With a key in both places, the query string cannot stand in for the body.
	 */
	public function test_a_correct_key_in_the_query_string_does_not_rescue_a_wrong_one_in_the_body() {
		$result = $this->routes()->verify_callback_permission(
			$this->request( array( 'api_key' => 'wrong-key' ), array( 'api_key' => self::SITE_KEY ) )
		);

		$this->assertForbidden( $result, 'Invalid API key.' );
	}

	/**
	 * A wrong key, a prefix of the real key, and a key that differs in its last character are all refused.
	 *
	 * @dataProvider wrong_keys
	 *
	 * @param string $key Key a caller sends.
	 */
	public function test_a_wrong_key_is_refused( $key ) {
		$this->assertForbidden( $this->routes()->verify_callback_permission( $this->request( array( 'api_key' => $key ) ) ), 'Invalid API key.' );
	}

	/**
	 * Keys that are not the site's.
	 *
	 * @return array<string, array>
	 */
	public function wrong_keys() {
		return array(
			'unrelated'            => array( 'wrong-key' ),
			'prefix of the key'    => array( substr( self::SITE_KEY, 0, -1 ) ),
			'key plus a character' => array( self::SITE_KEY . 'x' ),
			'last character off'   => array( substr( self::SITE_KEY, 0, -1 ) . 'X' ),
			'same key, other case' => array( strtoupper( self::SITE_KEY ) ),
		);
	}

	/**
	 * No key at all is refused, and so is a key sent as something other than text.
	 *
	 * @dataProvider missing_keys
	 *
	 * @param array $body Form body of the request.
	 */
	public function test_a_missing_key_is_refused( array $body ) {
		$this->assertForbidden( $this->routes()->verify_callback_permission( $this->request( $body ) ), 'API key is required.' );
	}

	/**
	 * Bodies without a usable key.
	 *
	 * @return array<string, array>
	 */
	public function missing_keys() {
		return array(
			'no key'               => array( array() ),
			'empty key'            => array( array( 'api_key' => '' ) ),
			'zero'                 => array( array( 'api_key' => '0' ) ),
			'key as a list'        => array( array( 'api_key' => array( self::SITE_KEY ) ) ),
			'key as a nested list' => array( array( 'api_key' => array( 'x' => array( self::SITE_KEY ) ) ) ),
		);
	}

	/**
	 * A site with no key stored accepts no callback, even one that sends an empty-looking key.
	 */
	public function test_a_site_without_a_key_accepts_nothing() {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key'] = '';

		$result = $this->routes()->verify_callback_permission( $this->request( array( 'api_key' => self::SITE_KEY ) ) );

		$this->assertForbidden( $result, 'API key not configured on the site.' );
	}

	/**
	 * Both callback routes are guarded by the same check.
	 */
	public function test_both_callback_routes_use_the_key_check() {
		$GLOBALS['rtgodam_stub']['routes'] = array();

		// phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
		eval( 'function register_rest_route( $ns, $route, $args ) { $GLOBALS["rtgodam_stub"]["routes"][ $route ] = $args; }' );

		$routes = $this->routes();
		$routes->register_routes();

		$this->assertSame( array( '/transcoder-callback', '/transcription-callback' ), array_keys( $GLOBALS['rtgodam_stub']['routes'] ) );

		foreach ( $GLOBALS['rtgodam_stub']['routes'] as $args ) {
			$this->assertSame( array( $routes, 'verify_callback_permission' ), $args['permission_callback'] );
		}
	}

	/**
	 * Assert a permission result is the 403 the callbacks answer with.
	 *
	 * @param mixed  $result  Result of verify_callback_permission().
	 * @param string $message Expected error message.
	 */
	private function assertForbidden( $result, $message ) {
		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'forbidden', $result->get_error_code() );
		$this->assertSame( $message, $result->get_error_message() );
		$this->assertSame( array( 'status' => 403 ), $result->get_error_data() );
	}

	/**
	 * The routes class without its constructor, which builds the transcoder handler.
	 *
	 * @return \RTGODAM_Transcoder_Rest_Routes
	 */
	private function routes() {
		return ( new \ReflectionClass( \RTGODAM_Transcoder_Rest_Routes::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * A request that keeps its form body, JSON body and query string apart.
	 *
	 * @param array      $body  Form-encoded body.
	 * @param array      $query Query string.
	 * @param array|null $json  Decoded JSON body, or null when the body is not JSON.
	 *
	 * @return \WP_REST_Request
	 */
	private function request( array $body = array(), array $query = array(), $json = null ) {
		return new class( $body, $query, $json ) extends \WP_REST_Request {

			/**
			 * @var array
			 */
			private $body;

			/**
			 * @var array
			 */
			private $query;

			/**
			 * @var array|null
			 */
			private $json;

			/**
			 * @param array      $body  Form-encoded body.
			 * @param array      $query Query string.
			 * @param array|null $json  Decoded JSON body.
			 */
			public function __construct( array $body, array $query, $json ) {
				$this->body  = $body;
				$this->query = $query;
				$this->json  = $json;
			}

			/**
			 * Like the real request: the body is looked at before the query string.
			 *
			 * @param string $key Param name.
			 * @return mixed
			 */
			public function get_param( $key ) {
				return $this->json[ $key ] ?? $this->body[ $key ] ?? $this->query[ $key ] ?? null;
			}

			/**
			 * @return array
			 */
			public function get_body_params() {
				return $this->body;
			}

			/**
			 * @return array|null
			 */
			public function get_json_params() {
				return $this->json;
			}
		};
	}
}
