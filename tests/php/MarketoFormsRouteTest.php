<?php
/**
 * The Marketo form-list route behind the layer editor's "Select Form" picker.
 *
 * `GET godam/v1/marketo/forms` is the only Marketo route the Media Editor calls,
 * so it needs `upload_files` like the other form-list routes, while the rest of
 * the Marketo tab stays admin-only. It answers the editor's `[{ id, title }]`
 * shape, and an empty list whenever Central cannot list forms (a forms-only
 * connection, or any error), so the editor falls back to a typed form ID.
 *
 * Like MarketoCentralClientTest, this runs in a separate process: call_central()
 * needs get_site_url() and the "safe" HTTP wrappers, which another test defines
 * globally with different behaviour.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Marketo_Integration;

require_once dirname( __DIR__, 2 ) . '/inc/classes/class-marketo.php';
require_once dirname( __DIR__, 2 ) . '/inc/helpers/class-api-key.php';
require_once dirname( __DIR__, 2 ) . '/inc/traits/trait-central-client.php';
require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-marketo-integration.php';
require_once dirname( __DIR__ ) . '/stubs/class-wp-rest-request.php';

/**
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 * @covers \RTGODAM\Inc\REST_API\Marketo_Integration::get_forms
 * @covers \RTGODAM\Inc\REST_API\Marketo_Integration::get_rest_routes
 */
class MarketoFormsRouteTest extends TestCase {

	/**
	 * A verified licence key, a connected and enabled Marketo, and the HTTP /
	 * site-url stubs call_central needs. The HTTP stubs count their calls in
	 * $GLOBALS['rtgodam_stub']['remote_calls'] and answer with
	 * $GLOBALS['rtgodam_stub']['safe_remote_response'].
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array(
			'options'      => array(
				'rtgodam-api-key'   => 'licence-key',
				'rtgodam-settings'  => array(
					'integrations' => array( 'marketo' => array( 'enable' => true ) ),
				),
				'rtgodam_user_data' => array(
					'user_data' => array( 'map' => array( 'marketo' => array( 'munchkin_id' => '123-ABC-456' ) ) ),
				),
			),
			'remote_calls' => 0,
		);

		$stubs = array(
			'get_site_url'       => 'function get_site_url() { return "https://example.test"; }',
			'wp_safe_remote_get' => 'function wp_safe_remote_get( $url = "", $args = array() ) { $GLOBALS["rtgodam_stub"]["remote_calls"]++; return $GLOBALS["rtgodam_stub"]["safe_remote_response"] ?? array(); }',
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
	 * An instance without the constructor (Base's constructor registers WP hooks).
	 *
	 * @return Marketo_Integration
	 */
	private function route(): Marketo_Integration {
		return ( new \ReflectionClass( Marketo_Integration::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * The route's data for the current stub state.
	 *
	 * @return mixed
	 */
	private function forms() {
		return $this->route()->get_forms( new \WP_REST_Request() )->get_data();
	}

	/**
	 * Central's reply, wrapped in Frappe's `message` envelope.
	 *
	 * @param int   $code    HTTP status.
	 * @param array $message The `message` payload.
	 */
	private function central_replies( int $code, array $message ): void {
		$GLOBALS['rtgodam_stub']['safe_remote_response'] = array(
			'code' => $code,
			'body' => wp_json_encode( array( 'message' => $message ) ),
		);
	}

	/**
	 * Permission callbacks keyed by route, e.g. '/marketo/forms'.
	 *
	 * @return array
	 */
	private function permission_callbacks(): array {
		$callbacks = array();
		foreach ( $this->route()->get_rest_routes() as $route ) {
			$callbacks[ $route['route'] ] = $route['args']['permission_callback'];
		}
		return $callbacks;
	}

	/**
	 * Central's `{ id, name }` forms become the editor's `{ id, title }` options.
	 */
	public function test_maps_central_forms_to_editor_options(): void {
		$this->central_replies(
			200,
			array(
				'status' => 'success',
				'forms'  => array(
					array(
						'id'   => '1001',
						'name' => 'Demo request',
					),
					array( 'id' => '1002' ),
				),
			)
		);

		$this->assertSame(
			array(
				array(
					'id'    => '1001',
					'title' => 'Demo request',
				),
				array(
					'id'    => '1002',
					'title' => '1002',
				),
			),
			$this->forms()
		);
	}

	/**
	 * A forms-only connection (Central answers 400) gives an empty list.
	 */
	public function test_forms_only_connection_returns_empty_list(): void {
		$this->central_replies(
			400,
			array(
				'message'    => 'Marketo is connected for forms only.',
				'error_type' => 'ValidationError',
			)
		);

		$this->assertSame( array(), $this->forms() );
	}

	/**
	 * An unreachable Central gives an empty list, not an error.
	 */
	public function test_unreachable_central_returns_empty_list(): void {
		$GLOBALS['rtgodam_stub']['safe_remote_response'] = new \WP_Error( 'http_request_failed', 'down' );

		$this->assertSame( array(), $this->forms() );
	}

	/**
	 * With Marketo turned off on the site, Central is not asked at all.
	 */
	public function test_not_configured_skips_central(): void {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-settings']['integrations']['marketo']['enable'] = false;

		$this->assertSame( array(), $this->forms() );
		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['remote_calls'] );
	}

	/**
	 * Authors can open the Media Editor, so the form list answers them; a
	 * contributor cannot.
	 */
	public function test_forms_route_needs_upload_files(): void {
		$check = $this->permission_callbacks()['/marketo/forms'];

		$GLOBALS['rtgodam_stub']['caps'] = array( 'read', 'edit_posts', 'upload_files' );
		$this->assertTrue( $check() );

		$GLOBALS['rtgodam_stub']['caps'] = array( 'read', 'edit_posts' );
		$this->assertFalse( $check() );
	}

	/**
	 * The connection routes stay admin-only.
	 */
	public function test_connection_routes_stay_admin_only(): void {
		$callbacks = $this->permission_callbacks();

		foreach ( array( '/marketo/status', '/marketo/connect', '/marketo/test' ) as $route ) {
			$GLOBALS['rtgodam_stub']['caps'] = array( 'read', 'edit_posts', 'upload_files' );
			$this->assertFalse( $callbacks[ $route ](), "$route as an author" );

			$GLOBALS['rtgodam_stub']['caps'] = array( 'manage_options' );
			$this->assertTrue( $callbacks[ $route ](), "$route as an admin" );
		}
	}
}
