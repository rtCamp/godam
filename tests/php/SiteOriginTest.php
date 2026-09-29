<?php
/**
 * Analytics and engagement reads use this site's own origin.
 *
 * The player records analytics events under `window.location.origin` (scheme,
 * host and port, never a path). Every read the plugin makes on the site's
 * behalf sends that same value, built on the server from home_url(); a
 * `site_url` sent with the REST request is not used.
 *
 * The handlers run on constructor-less instances (Base's constructor registers
 * WP hooks), with the WP surface stubbed in tests/bootstrap.php and tests/stubs/.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Analytics;
use RTGODAM\Inc\REST_API\Engagement;

/**
 * @covers ::rtgodam_get_site_origin
 * @covers \RTGODAM\Inc\REST_API\Analytics
 * @covers \RTGODAM\Inc\REST_API\Engagement::get_activities
 */
class SiteOriginTest extends TestCase {

	/**
	 * A site_url a REST request might carry that is not this site.
	 */
	const REQUEST_SITE_URL = 'https://another-site.test';

	/**
	 * A verified account on https://example.test, and an empty 200 upstream.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_translated'] = array();
		$GLOBALS['rtgodam_stub']       = array(
			'home_url' => 'https://example.test',
			'options'  => array(
				'rtgodam-account-token' => 'verified-account',
				'rtgodam-api-key'       => 'test-key',
			),
			'http'     => array(
				'code' => 200,
				'body' => '{}',
			),
		);
	}

	/**
	 * @dataProvider home_urls
	 *
	 * @param string $home_url The site's home URL.
	 * @param string $expected The origin analytics reads should use.
	 */
	public function test_site_origin_is_built_from_home_url( $home_url, $expected ) {
		$GLOBALS['rtgodam_stub']['home_url'] = $home_url;

		$this->assertSame( $expected, rtgodam_get_site_origin() );
	}

	/**
	 * Home URLs and the origin each should give, matching what a browser reports
	 * as window.location.origin on that site.
	 *
	 * @return array<string, array{0: string, 1: string}>
	 */
	public function home_urls() {
		return array(
			'plain'                          => array( 'https://example.test', 'https://example.test' ),
			'trailing slash'                 => array( 'https://example.test/', 'https://example.test' ),
			'subdirectory multisite subsite' => array( 'https://example.test/site-1', 'https://example.test' ),
			'non-default port kept'          => array( 'http://localhost:8080/wp', 'http://localhost:8080' ),
			'default https port dropped'     => array( 'https://example.test:443', 'https://example.test' ),
			'default http port dropped'      => array( 'http://example.test:80', 'http://example.test' ),
			'host and scheme lowercased'     => array( 'HTTPS://Example.TEST', 'https://example.test' ),
			'unparseable home URL'           => array( '', '' ),
		);
	}

	/**
	 * @dataProvider analytics_reads
	 *
	 * @param string               $method Analytics handler.
	 * @param array<string, mixed> $params Other request params the handler needs.
	 */
	public function test_analytics_read_sends_this_sites_origin( $method, $params ) {
		$request = new \WP_REST_Request( array_merge( array( 'site_url' => self::REQUEST_SITE_URL ), $params ) );

		$this->analytics()->$method( $request );

		$this->assertSame( 'https://example.test', $this->site_url_sent() );
	}

	/**
	 * Every Analytics handler that forwards a site_url to the microservice.
	 *
	 * @return array<string, array{0: string, 1: array<string, mixed>}>
	 */
	public function analytics_reads() {
		return array(
			'layer analytics'   => array(
				'fetch_layer_analytics',
				array(
					'video_id'   => 7,
					'layer_type' => 'cta',
				),
			),
			'video analytics'   => array( 'fetch_analytics_data', array( 'video_id' => 7 ) ),
			'video history'     => array(
				'fetch_analytics_history',
				array(
					'video_id' => 7,
					'days'     => 7,
				),
			),
			'dashboard metrics' => array( 'fetch_dashboard_metrics', array() ),
			'dashboard history' => array( 'fetch_dashboard_history', array( 'days' => 7 ) ),
			'top videos'        => array( 'fetch_top_videos', array( 'search' => '' ) ),
			'placement funnels' => array( 'fetch_placement_funnels', array() ),
			'revenue summary'   => array( 'fetch_revenue_summary', array() ),
			'video funnel'      => array( 'fetch_video_funnel', array() ),
			'top products'      => array( 'fetch_top_products', array( 'search' => '' ) ),
		);
	}

	/**
	 * The views count on the player comes from the same analytics read. Likes and
	 * comments are served from their caches here, so the only request made is the
	 * views read.
	 */
	public function test_engagement_views_read_sends_this_sites_origin() {
		$GLOBALS['rtgodam_stub']['transient'] = array(
			'rtgodam-engagements-likes-transcoder-job-id-job-1-user-email-anonymous@example.test' => array(
				'likes'             => 0,
				'has_liked_by_user' => false,
			),
			'rtgodam-engagements-comments-transcoder-job-id-job-1' => array(
				'comments' => array(),
				'total'    => 0,
			),
		);

		$request = new \WP_REST_Request(
			array(
				'video_id' => 'cmmid_job-1',
				'site_url' => self::REQUEST_SITE_URL,
			)
		);

		$this->engagement()->get_activities( $request );

		$this->assertSame( 'https://example.test', $this->site_url_sent() );
	}

	/**
	 * The site_url query arg on the last request the wp_remote_get stub saw.
	 *
	 * @return string|null
	 */
	private function site_url_sent() {
		$url = isset( $GLOBALS['rtgodam_stub']['last_remote_url'] ) ? (string) $GLOBALS['rtgodam_stub']['last_remote_url'] : '';
		$this->assertNotSame( '', $url, 'the handler should have called the microservice' );

		parse_str( (string) wp_parse_url( $url, PHP_URL_QUERY ), $query );

		return $query['site_url'] ?? null;
	}

	/**
	 * @return Analytics
	 */
	private function analytics() {
		return ( new \ReflectionClass( Analytics::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * @return Engagement
	 */
	private function engagement() {
		return ( new \ReflectionClass( Engagement::class ) )->newInstanceWithoutConstructor();
	}
}
