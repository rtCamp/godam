<?php
/**
 * Unit tests for the store's UTC offset the Analytics proxy sends with the funnel reads.
 *
 * The analytics microservice counts plays, adds and orders on the store's own day
 * when a request carries `store_utc_offset_minutes`. Every proxy route that serves
 * the Video-to-Cart, Video-to-Purchase or funnel figures has to send it, from the
 * timezone WordPress is set to, and the routes that do not serve those figures have
 * to be left as they were. The HTTP and REST surface is stubbed (see
 * tests/stubs/wp-http-functions.php); the URL each route requests is read back from
 * $GLOBALS['rtgodam_stub']['last_remote_url'].
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

require_once dirname( __DIR__ ) . '/stubs/wp-timezone.php';

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Analytics;

/**
 * @covers \RTGODAM\Inc\REST_API\Analytics::append_store_offset_param
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_analytics_data
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_dashboard_metrics
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_placement_funnels
 * @covers \RTGODAM\Inc\REST_API\Analytics::fetch_video_funnel
 */
class AnalyticsStoreOffsetTest extends TestCase {

	/**
	 * Every proxy handler that reaches a funnel figure, with the service path it calls.
	 *
	 * @return array<string, array{0: string, 1: string}>
	 */
	public function funnel_routes() {
		return array(
			'per-video read'    => array( 'fetch_analytics_data', '/processed-analytics/fetch/' ),
			'dashboard metrics' => array( 'fetch_dashboard_metrics', '/dashboard/metrics/fetch/' ),
			'placement funnels' => array( 'fetch_placement_funnels', '/dashboard/placement-funnels/' ),
			'video funnel'      => array( 'fetch_video_funnel', '/dashboard/video-funnel/' ),
		);
	}

	/**
	 * Handlers that read other figures from the same microservice and must not send it.
	 *
	 * @return array<string, array{0: string, 1: string}>
	 */
	public function other_routes() {
		return array(
			'revenue summary'   => array( 'fetch_revenue_summary', '/dashboard/revenue-summary/' ),
			'dashboard history' => array( 'fetch_dashboard_history', '/dashboard/metrics/history/' ),
			'analytics history' => array( 'fetch_analytics_history', '/processed-analytics/history/' ),
		);
	}

	/**
	 * Reset the per-test stub state, with a verified account so the handlers reach
	 * the HTTP call rather than returning early on the API-key check.
	 */
	protected function setUp(): void {
		parent::setUp();

		if ( ! defined( 'RTGODAM_ANALYTICS_BASE' ) ) {
			define( 'RTGODAM_ANALYTICS_BASE', 'https://analytics.example.test' );
		}

		$GLOBALS['rtgodam_translated'] = array();
		$GLOBALS['rtgodam_stub']       = array(
			'options' => array(
				'rtgodam-account-token' => 'verified-account',
				'rtgodam-api-key'       => 'test-key',
			),
			'http'    => array(
				'code' => 200,
				'body' => '{}',
			),
		);
	}

	/**
	 * Set the timezone WordPress reports.
	 *
	 * @param string $zone A timezone name or a UTC offset such as '-07:00'.
	 */
	private function set_timezone( $zone ) {
		$GLOBALS['rtgodam_stub']['timezone'] = new \DateTimeZone( $zone );
	}

	/**
	 * Call a handler on a constructor-less instance and return the query the
	 * request it made carried, as an array (null when it made none).
	 *
	 * @param string $handler Handler method name.
	 * @param array  $params  Request params.
	 * @return array|null The requested URL's query args.
	 */
	private function requested_query( $handler, array $params = array() ) {
		$analytics = ( new \ReflectionClass( Analytics::class ) )->newInstanceWithoutConstructor();
		$request   = new \WP_REST_Request(
			array_merge(
				array(
					'site_url'   => 'https://example.test',
					'video_id'   => 42,
					'start_date' => '2026-09-20',
					'end_date'   => '2026-09-20',
				),
				$params
			)
		);

		unset( $GLOBALS['rtgodam_stub']['last_remote_url'] );
		$analytics->$handler( $request );

		if ( ! isset( $GLOBALS['rtgodam_stub']['last_remote_url'] ) ) {
			return null;
		}
		parse_str( (string) wp_parse_url( $GLOBALS['rtgodam_stub']['last_remote_url'], PHP_URL_QUERY ), $query );
		return $query;
	}

	/**
	 * A store west of UTC and one east of it, on the offset each has now.
	 *
	 * @dataProvider funnel_routes
	 *
	 * @param string $handler Handler method name.
	 * @param string $path    The microservice path it calls.
	 */
	public function test_funnel_route_sends_the_store_offset( $handler, $path ) {
		$this->set_timezone( '-07:00' );
		$query = $this->requested_query( $handler );
		$this->assertNotNull( $query, "$handler made no request" );
		$this->assertStringContainsString( $path, $GLOBALS['rtgodam_stub']['last_remote_url'] );
		$this->assertSame( '-420', $query['store_utc_offset_minutes'], "$handler must send UTC-7 as -420" );
		$this->assertSame( '2026-09-20', $query['start_date'], 'the range is still forwarded' );
		$this->assertSame( '2026-09-20', $query['end_date'] );

		$this->set_timezone( '+05:30' );
		$query = $this->requested_query( $handler );
		$this->assertSame( '330', $query['store_utc_offset_minutes'], "$handler must send UTC+5:30 as 330" );

		$this->set_timezone( 'UTC' );
		$query = $this->requested_query( $handler );
		$this->assertSame( '0', $query['store_utc_offset_minutes'], 'a UTC store sends 0, not nothing' );
	}

	/**
	 * The offset is sent without a date range too (the service then has nothing to
	 * bucket and ignores it), so a route never depends on the picker being set.
	 *
	 * @dataProvider funnel_routes
	 *
	 * @param string $handler Handler method name.
	 */
	public function test_funnel_route_sends_the_offset_for_an_all_time_request( $handler ) {
		$this->set_timezone( '+05:30' );
		$query = $this->requested_query(
			$handler,
			array(
				'start_date' => '',
				'end_date'   => '',
			)
		);
		$this->assertSame( '330', $query['store_utc_offset_minutes'] );
		$this->assertArrayNotHasKey( 'start_date', $query );
	}

	/**
	 * Named zones resolve to their offset now: Asia/Kolkata and America/Phoenix
	 * never change, so the expected value holds all year.
	 *
	 * @dataProvider funnel_routes
	 *
	 * @param string $handler Handler method name.
	 */
	public function test_named_zones_resolve_to_their_offset( $handler ) {
		$this->set_timezone( 'Asia/Kolkata' );
		$this->assertSame( '330', $this->requested_query( $handler )['store_utc_offset_minutes'] );

		$this->set_timezone( 'America/Phoenix' );
		$this->assertSame( '-420', $this->requested_query( $handler )['store_utc_offset_minutes'] );

		$this->set_timezone( 'Asia/Kathmandu' );
		$this->assertSame( '345', $this->requested_query( $handler )['store_utc_offset_minutes'], 'a quarter-hour zone keeps its minutes' );
	}

	/**
	 * The microservice refuses anything outside -12:00..+14:00, so the plugin never
	 * sends a value past it.
	 *
	 * @dataProvider funnel_routes
	 *
	 * @param string $handler Handler method name.
	 */
	public function test_offset_stays_inside_the_microservice_range( $handler ) {
		$this->set_timezone( '+15:00' );
		$this->assertSame( '840', $this->requested_query( $handler )['store_utc_offset_minutes'] );

		$this->set_timezone( '-13:00' );
		$this->assertSame( '-720', $this->requested_query( $handler )['store_utc_offset_minutes'] );

		$this->set_timezone( '+14:00' );
		$this->assertSame( '840', $this->requested_query( $handler )['store_utc_offset_minutes'] );
		$this->set_timezone( '-12:00' );
		$this->assertSame( '-720', $this->requested_query( $handler )['store_utc_offset_minutes'] );
	}

	/**
	 * Routes that do not serve a funnel figure are left exactly as they were.
	 *
	 * @dataProvider other_routes
	 *
	 * @param string $handler Handler method name.
	 * @param string $path    The microservice path it calls.
	 */
	public function test_other_routes_do_not_send_the_offset( $handler, $path ) {
		$this->set_timezone( '-07:00' );
		$query = $this->requested_query( $handler );
		$this->assertNotNull( $query, "$handler made no request" );
		$this->assertStringContainsString( $path, $GLOBALS['rtgodam_stub']['last_remote_url'] );
		$this->assertArrayNotHasKey( 'store_utc_offset_minutes', $query );
	}
}
