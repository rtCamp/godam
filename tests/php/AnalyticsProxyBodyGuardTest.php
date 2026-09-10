<?php
/**
 * Unit tests for the Analytics proxy's "200 with a bad body" guard.
 *
 * fetch_top_videos and fetch_top_products forward to the analytics microservice
 * and then decode the JSON body. A 200 response whose body is NOT valid JSON
 * (e.g. an HTML error page from an intermediary) decodes to null. Without the
 * `! is_array( $body )` half of the guard, that null would fall through and be
 * rendered as an empty "no data" table, silently hiding a real failure. These
 * tests assert the guard returns a status:error response in that case, mirroring
 * fetch_placement_funnels.
 *
 * The methods are exercised on a constructor-less instance (Base's constructor
 * registers WP hooks we don't want here); the WP HTTP / REST surface is stubbed
 * in tests/stubs/wp-http.php and driven per-case via $GLOBALS['rtgodam_stub'].
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Analytics;

/**
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_top_videos
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_top_products
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_placement_funnels
 */
class AnalyticsProxyBodyGuardTest extends TestCase {

	/**
	 * Reset the per-test stub state, with a verified account so the methods reach
	 * the HTTP call rather than returning early on the API-key check.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_translated'] = array();
		$GLOBALS['rtgodam_stub']       = array(
			'options' => array(
				'rtgodam-account-token' => 'verified-account',
				'rtgodam-api-key'       => 'test-key',
			),
		);
	}

	/**
	 * Build an Analytics instance without running Base's constructor.
	 *
	 * @return Analytics
	 */
	private function analytics() {
		return ( new \ReflectionClass( Analytics::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * Set the fake upstream HTTP response the wp_remote_* stubs return.
	 *
	 * @param int    $code HTTP status code.
	 * @param string $body Response body.
	 */
	private function set_http_response( $code, $body ) {
		$GLOBALS['rtgodam_stub']['http'] = array(
			'code' => $code,
			'body' => $body,
		);
	}

	/**
	 * A 200 whose body is not JSON (decodes to null) must be surfaced as an error
	 * by fetch_top_videos, not rendered as an empty "no videos" table.
	 */
	public function test_fetch_top_videos_treats_200_with_non_json_body_as_error() {
		$this->set_http_response( 200, '<html><body>502 Bad Gateway</body></html>' );

		$request = new \WP_REST_Request(
			array(
				'site_url' => 'https://example.test',
				'search'   => '',
			)
		);

		$response = $this->analytics()->fetch_top_videos( $request );

		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		$data = $response->get_data();
		$this->assertSame( 'error', $data['status'], 'a 200 with a non-JSON body must be status:error' );
		$this->assertSame( 'microservice_error', $data['errorType'] );
	}

	/**
	 * The same guard on fetch_top_products.
	 */
	public function test_fetch_top_products_treats_200_with_non_json_body_as_error() {
		$this->set_http_response( 200, 'not json at all' );

		$request = new \WP_REST_Request(
			array(
				'site_url' => 'https://example.test',
				'search'   => '',
			)
		);

		$response = $this->analytics()->fetch_top_products( $request );

		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		$data = $response->get_data();
		$this->assertSame( 'error', $data['status'], 'a 200 with a non-JSON body must be status:error' );
		$this->assertSame( 'microservice_error', $data['errorType'] );
	}

	/**
	 * Guard rail: a well-formed 200 JSON body is NOT treated as an error, so the
	 * new `! is_array( $body )` clause has not made valid responses fail. An empty
	 * `top_videos` array skips the WP enrichment loop, so no further stubs are
	 * needed to reach the success return.
	 */
	public function test_fetch_top_videos_accepts_a_valid_json_body() {
		$this->set_http_response( 200, '{"top_videos":[],"total_pages":1,"total_items":0}' );

		$request = new \WP_REST_Request(
			array(
				'site_url' => 'https://example.test',
				'search'   => '',
			)
		);

		$response = $this->analytics()->fetch_top_videos( $request );
		$data     = $response->get_data();

		$this->assertSame( 'success', $data['status'], 'a valid body should not be flagged as an error' );
		$this->assertArrayHasKey( 'top_videos', $data );
		$this->assertSame( array(), $data['top_videos'] );
	}

	/**
	 * A no-search request (search === '') param map, shared by the cases below.
	 * An empty search resolves the id-filter to null, so the proxy uses
	 * wp_remote_get (the stubbed path) rather than POSTing an include-filter.
	 *
	 * @return \WP_REST_Request
	 */
	private function no_search_request() {
		return new \WP_REST_Request(
			array(
				'site_url' => 'https://example.test',
				'search'   => '',
			)
		);
	}

	/**
	 * A non-2xx upstream (e.g. 503 service down) must be surfaced as status:error
	 * by fetch_top_videos, not rendered as an empty "no videos" success. The 503
	 * is not a 400, so the errorType is the generic microservice_error.
	 */
	public function test_fetch_top_videos_treats_non_2xx_as_error() {
		$this->set_http_response( 503, '{"detail":"Service Unavailable"}' );

		$response = $this->analytics()->fetch_top_videos( $this->no_search_request() );

		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		$data = $response->get_data();
		$this->assertSame( 'error', $data['status'], 'a 503 must be status:error, not an empty success' );
		$this->assertSame( 'microservice_error', $data['errorType'], 'a non-400 upstream failure is a generic microservice_error' );
	}

	/**
	 * The same non-2xx guard on fetch_top_products.
	 */
	public function test_fetch_top_products_treats_non_2xx_as_error() {
		$this->set_http_response( 503, '{"detail":"Service Unavailable"}' );

		$response = $this->analytics()->fetch_top_products( $this->no_search_request() );

		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		$data = $response->get_data();
		$this->assertSame( 'error', $data['status'], 'a 503 must be status:error, not an empty success' );
		$this->assertSame( 'microservice_error', $data['errorType'], 'a non-400 upstream failure is a generic microservice_error' );
	}

	/**
	 * The same non-2xx guard on fetch_placement_funnels. Unlike the two proxies
	 * above, this method's error branch returns status + message only (no
	 * errorType), so the assertion is that it is an error carrying the upstream
	 * detail rather than an empty `placement_funnels` success.
	 */
	public function test_fetch_placement_funnels_treats_non_2xx_as_error() {
		$this->set_http_response( 503, '{"detail":"Service Unavailable"}' );

		$response = $this->analytics()->fetch_placement_funnels( $this->no_search_request() );

		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		$data = $response->get_data();
		$this->assertSame( 'error', $data['status'], 'a 503 must be status:error, not an empty success' );
		$this->assertArrayNotHasKey( 'placement_funnels', $data, 'a failed request must not be rendered as an empty funnels list' );
		$this->assertSame( 'Service Unavailable', $data['message'], 'the upstream detail is surfaced as the message' );
	}

	/**
	 * A 400 with a JSON `detail` from the microservice must be flagged with
	 * errorType='bad_request' (not the generic microservice_error) so the
	 * frontend can distinguish a bad request from a service outage. The upstream
	 * detail is passed through as the message.
	 */
	public function test_fetch_top_videos_sets_bad_request_error_type_on_400() {
		$this->set_http_response( 400, '{"detail":"Invalid date range"}' );

		$response = $this->analytics()->fetch_top_videos( $this->no_search_request() );

		$data = $response->get_data();
		$this->assertSame( 'error', $data['status'] );
		$this->assertSame( 'bad_request', $data['errorType'], 'a 400 must be classified as bad_request' );
		$this->assertSame( 'Invalid date range', $data['message'], 'the upstream detail is surfaced as the message' );
	}

	/**
	 * The same 400 -> bad_request classification on fetch_top_products.
	 */
	public function test_fetch_top_products_sets_bad_request_error_type_on_400() {
		$this->set_http_response( 400, '{"detail":"Invalid date range"}' );

		$response = $this->analytics()->fetch_top_products( $this->no_search_request() );

		$data = $response->get_data();
		$this->assertSame( 'error', $data['status'] );
		$this->assertSame( 'bad_request', $data['errorType'], 'a 400 must be classified as bad_request' );
		$this->assertSame( 'Invalid date range', $data['message'], 'the upstream detail is surfaced as the message' );
	}

	/**
	 * A 200 whose body is not JSON (decodes to null) must be surfaced as an error
	 * by fetch_placement_funnels, not rendered as an empty funnels list. Mirrors
	 * the existing top_videos / top_products guard tests, which this method's
	 * error branch had no equivalent for.
	 */
	public function test_fetch_placement_funnels_treats_200_with_non_json_body_as_error() {
		$this->set_http_response( 200, '<html><body>502 Bad Gateway</body></html>' );

		$response = $this->analytics()->fetch_placement_funnels( $this->no_search_request() );

		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		$data = $response->get_data();
		$this->assertSame( 'error', $data['status'], 'a 200 with a non-JSON body must be status:error' );
		$this->assertArrayNotHasKey( 'placement_funnels', $data, 'an unparseable body must not be rendered as an empty funnels list' );
	}
}
