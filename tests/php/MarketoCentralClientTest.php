<?php
/**
 * The plugin -> GoDAM Central call maps Central's replies to WP_Error.
 *
 * `Marketo_Integration::call_central()` is the one server-to-server client the
 * Marketo tab uses. These cover the cases a caller branches on: no licence key,
 * an error body (HTTP >= 400, carrying Central's message and `error_type`), and a
 * success that unwraps Frappe's `message` envelope.
 *
 * call_central() reaches for get_site_url() and the "safe" HTTP wrappers, which
 * another test (ApiKeyVerificationResilienceTest) also defines globally with
 * different behaviour. PHP functions cannot be redefined, so this class runs in a
 * separate process and installs its own stubs there, free of that collision.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Marketo_Integration;

require_once dirname( __DIR__, 2 ) . '/inc/classes/class-marketo.php';
require_once dirname( __DIR__, 2 ) . '/inc/helpers/class-api-key.php';

// Once the HubSpot work lands, Marketo_Integration gets call_central() from the
// shared Central_Client trait; load it when present (it does not exist on the
// Marketo-only branch, where call_central is a private method on the class).
$godam_central_client_trait = dirname( __DIR__, 2 ) . '/inc/traits/trait-central-client.php';
if ( file_exists( $godam_central_client_trait ) ) {
	require_once $godam_central_client_trait;
}

require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-marketo-integration.php';

/**
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 * @covers \RTGODAM\Inc\REST_API\Marketo_Integration::call_central
 */
class MarketoCentralClientTest extends TestCase {

	/**
	 * A verified licence key, and the HTTP / site-url stubs call_central needs.
	 * The stubs read the per-case fake reply from
	 * $GLOBALS['rtgodam_stub']['safe_remote_response'].
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array(
			'options' => array( 'rtgodam-api-key' => 'licence-key' ),
		);

		$stubs = array(
			'get_site_url'        => 'function get_site_url() { return "https://example.test"; }',
			'wp_safe_remote_get'  => 'function wp_safe_remote_get( $url = "", $args = array() ) { return $GLOBALS["rtgodam_stub"]["safe_remote_response"] ?? array(); }',
			'wp_safe_remote_post' => 'function wp_safe_remote_post( $url = "", $args = array() ) { return $GLOBALS["rtgodam_stub"]["safe_remote_response"] ?? array(); }',
		);

		foreach ( $stubs as $name => $code ) {
			if ( ! function_exists( $name ) ) {
				eval( $code ); // phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
			}
		}
	}

	/**
	 * Leave no stub state behind.
	 */
	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Call the private client on a constructor-less instance (Base's constructor
	 * registers WP hooks).
	 *
	 * @param string $method      Dotted godam-core method.
	 * @param array  $args        Request params.
	 * @param string $http_method GET or POST.
	 * @return array|\WP_Error
	 */
	private function call( string $method, array $args = array(), string $http_method = 'GET' ) {
		$ref    = new \ReflectionClass( Marketo_Integration::class );
		$object = $ref->newInstanceWithoutConstructor();
		$call   = $ref->getMethod( 'call_central' );
		$call->setAccessible( true );

		return $call->invoke( $object, $method, $args, $http_method );
	}

	/**
	 * No licence key: a 403 WP_Error, and no HTTP call is attempted.
	 */
	public function test_without_licence_key_returns_error(): void {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key'] = '';

		$result = $this->call( 'godam_core.api.map_wordpress.get_status' );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'godam_no_api_key', $result->get_error_code() );
		$this->assertSame( 403, $result->get_error_data()['status'] );
	}

	/**
	 * An error body carries Central's message and error_type through to WP_Error.
	 */
	public function test_error_body_maps_to_wp_error(): void {
		$GLOBALS['rtgodam_stub']['safe_remote_response'] = array(
			'code' => 404,
			'body' => wp_json_encode(
				array(
					'message' => array(
						'message'    => 'Marketo is not connected.',
						'error_type' => 'ResourceNotFound',
					),
				)
			),
		);

		$result = $this->call( 'godam_core.api.map_wordpress.get_forms', array( 'provider' => 'marketo' ) );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'godam_central_error', $result->get_error_code() );
		$this->assertSame( 'Marketo is not connected.', $result->get_error_message() );
		$data = $result->get_error_data();
		$this->assertSame( 404, $data['status'] );
		$this->assertSame( 'ResourceNotFound', $data['error_type'] );
	}

	/**
	 * A success unwraps Frappe's `message` envelope and returns the inner payload.
	 */
	public function test_success_unwraps_message_envelope(): void {
		$GLOBALS['rtgodam_stub']['safe_remote_response'] = array(
			'code' => 200,
			'body' => wp_json_encode(
				array(
					'message' => array(
						'status' => 'success',
						'forms'  => array(
							array(
								'id'   => '1001',
								'name' => 'Demo request',
							),
						),
					),
				)
			),
		);

		$result = $this->call( 'godam_core.api.map_wordpress.get_forms', array( 'provider' => 'marketo' ) );

		$this->assertIsArray( $result );
		$this->assertSame( 'success', $result['status'] );
		$this->assertSame( '1001', $result['forms'][0]['id'] );
	}

	/**
	 * A transport failure becomes a 503 "could not reach" WP_Error.
	 */
	public function test_transport_error_maps_to_unreachable(): void {
		$GLOBALS['rtgodam_stub']['safe_remote_response'] = new \WP_Error( 'http_request_failed', 'down' );

		$result = $this->call( 'godam_core.api.map_wordpress.get_status' );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 'godam_central_unreachable', $result->get_error_code() );
		$this->assertSame( 503, $result->get_error_data()['status'] );
	}
}
