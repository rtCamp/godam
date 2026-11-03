<?php
/**
 * Unit tests for the `no_data` flag on the dashboard-metrics proxy and the widget summary.
 *
 * The analytics service answers a site that has never had a video play with
 * HTTP 200 and `{"dashboard_metrics": null}`. The proxy returns success with
 * zeroed metrics and `no_data: true`, so the GoDAM Dashboard shows the setup
 * checklist and the WP Dashboard widget links to it. Real metrics, even all
 * zeros, never carry the flag, and a malformed answer is still an error.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Analytics;
use RTGODAM\Inc\REST_API\Dashboard_Widget_Summary;

/**
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_dashboard_metrics
 * @covers \RTGODAM\Inc\REST_API\Dashboard_Widget_Summary::assemble_summary
 */
class DashboardNoDataFlagTest extends TestCase {

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
	 * Null metrics mean no data yet: success, zeros, and the flag.
	 */
	public function test_null_metrics_are_flagged_as_no_data() {
		$data = $this->fetch_with( 200, '{"dashboard_metrics":null,"message":"No dashboard data found for the given site."}' );

		$this->assertSame( 'success', $data['status'], 'a no-data site must not be reported as an outage' );
		$this->assertTrue( $data['no_data'] );
		$this->assertSame( 0, $data['dashboard_metrics']['plays'] );
	}

	/**
	 * Real metrics that are all zero are not "no data": the flag comes only from the service.
	 */
	public function test_zero_metrics_are_not_flagged() {
		$data = $this->fetch_with( 200, '{"dashboard_metrics":{"plays":0,"page_load":0}}' );

		$this->assertSame( 'success', $data['status'] );
		$this->assertArrayNotHasKey( 'no_data', $data );
	}

	/**
	 * A 2xx without the metrics key, or with a value that is not an object, is still an error.
	 */
	public function test_malformed_answers_are_errors() {
		foreach ( array( '{"message":"something else"}', '{"dashboard_metrics":"oops"}' ) as $body ) {
			$data = $this->fetch_with( 200, $body );

			$this->assertSame( 'error', $data['status'], $body );
			$this->assertSame( 'microservice_error', $data['errorType'], $body );
			$this->assertArrayNotHasKey( 'no_data', $data, $body );
		}
	}

	/**
	 * The widget summary carries the flag through, and only when the metrics had it.
	 */
	public function test_widget_summary_carries_the_flag() {
		$ok      = array(
			'status'                    => 'success',
			'top_videos'                => array(),
			'dashboard_metrics_history' => array(),
		);
		$metrics = array(
			'status'            => 'success',
			'dashboard_metrics' => array( 'plays' => 0 ),
		);

		$flagged = Dashboard_Widget_Summary::assemble_summary( $metrics + array( 'no_data' => true ), $ok, $ok, 1700000000 );
		$plain   = Dashboard_Widget_Summary::assemble_summary( $metrics, $ok, $ok, 1700000000 );

		$this->assertSame( 'success', $flagged['status'] );
		$this->assertTrue( $flagged['no_data'] );
		$this->assertArrayNotHasKey( 'no_data', $plain );
	}
}
