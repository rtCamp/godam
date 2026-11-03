<?php
/**
 * Unit tests for how the dashboard-metrics proxy reads a site with no data yet.
 *
 * The analytics service answers a site that has never had a video play with
 * HTTP 200 and `{"dashboard_metrics": null, "message": "No dashboard data ..."}`.
 * That is a real "nothing yet", so fetch_dashboard_metrics must return success
 * with zeroed tiles instead of the error that shows the "Analytics is
 * temporarily unavailable" notice. A 2xx with the key missing, or with a value
 * that is not an object, is still an error.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Analytics;

/**
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_dashboard_metrics
 */
class DashboardMetricsNoDataTest extends TestCase {

	/**
	 * Reset the stub state with a verified account so the call reaches the HTTP request.
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
	 * Call fetch_dashboard_metrics against a fake upstream response.
	 *
	 * @param int    $code HTTP status code.
	 * @param string $body Response body.
	 * @return array Response data.
	 */
	private function fetch_with( $code, $body ) {
		$GLOBALS['rtgodam_stub']['http'] = array(
			'code' => $code,
			'body' => $body,
		);

		$analytics = ( new \ReflectionClass( Analytics::class ) )->newInstanceWithoutConstructor();
		$request   = new \WP_REST_Request( array( 'site_url' => 'https://example.test' ) );

		return $analytics->fetch_dashboard_metrics( $request )->get_data();
	}

	/**
	 * A site with no data yet gets success and zeroed metrics, not an outage error.
	 */
	public function test_null_metrics_mean_no_data_yet() {
		$data = $this->fetch_with( 200, '{"dashboard_metrics":null,"message":"No dashboard data found for the given site."}' );

		$this->assertSame( 'success', $data['status'], 'a no-data site must not be reported as an outage' );
		$this->assertSame( 0, $data['dashboard_metrics']['plays'] );
		$this->assertSame( 0, $data['dashboard_metrics']['unique_viewers'] );
		$this->assertSame( array(), $data['dashboard_metrics']['country_views'] );
	}

	/**
	 * A 2xx without the metrics key is still a failed call.
	 */
	public function test_missing_metrics_key_is_an_error() {
		$data = $this->fetch_with( 200, '{"message":"something else"}' );

		$this->assertSame( 'error', $data['status'] );
		$this->assertSame( 'microservice_error', $data['errorType'] );
	}

	/**
	 * A metrics value that is neither null nor an object is still a failed call.
	 */
	public function test_non_object_metrics_value_is_an_error() {
		$data = $this->fetch_with( 200, '{"dashboard_metrics":"oops"}' );

		$this->assertSame( 'error', $data['status'] );
		$this->assertSame( 'microservice_error', $data['errorType'] );
	}

	/**
	 * Real metrics still come through, merged over the zero defaults.
	 */
	public function test_real_metrics_pass_through() {
		$data = $this->fetch_with( 200, '{"dashboard_metrics":{"plays":12,"page_load":40}}' );

		$this->assertSame( 'success', $data['status'] );
		$this->assertSame( 12, $data['dashboard_metrics']['plays'] );
		$this->assertSame( 40, $data['dashboard_metrics']['page_load'] );
		$this->assertSame( 0, $data['dashboard_metrics']['unique_viewers'] );
	}
}
