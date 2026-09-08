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
}
