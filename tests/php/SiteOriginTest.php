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
		$GLOBALS['rtgodam_hooks']      = array();
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
	 * For sites whose home_url() differs from what visitors' browsers report (a proxy
	 * that ends TLS without setting the HTTPS flag, several domains on one site).
	 */
	public function test_filter_can_replace_the_origin() {
		$GLOBALS['rtgodam_stub']['home_url'] = 'http://example.test';
		add_filter(
			'rtgodam_site_origin',
			function () {
				return 'https://example.test';
			}
		);

		$this->assertSame( 'https://example.test', rtgodam_get_site_origin() );
	}

	public function test_filter_receives_the_computed_origin_and_home_url() {
		$GLOBALS['rtgodam_stub']['home_url'] = 'https://example.test/site-1';
		$seen                                = array();
		add_filter(
			'rtgodam_site_origin',
			function ( $origin, $home_url ) use ( &$seen ) {
				$seen = array( $origin, $home_url );
				return $origin;
			},
			10,
			2
		);

		rtgodam_get_site_origin();

		$this->assertSame( array( 'https://example.test', 'https://example.test/site-1' ), $seen );
	}

	/**
	 * @dataProvider unusable_filter_results
	 *
	 * @param mixed $result What the filter returned.
	 */
	public function test_unusable_filter_result_keeps_the_computed_origin( $result ) {
		add_filter(
			'rtgodam_site_origin',
			function () use ( $result ) {
				return $result;
			}
		);

		$this->assertSame( 'https://example.test', rtgodam_get_site_origin() );
	}

	/**
	 * @return array<string, array{0: mixed}>
	 */
	public function unusable_filter_results() {
		return array(
			'null'                         => array( null ),
			'empty string'                 => array( '' ),
			'array'                        => array( array( 'https://example.test' ) ),
			'no scheme'                    => array( 'example.test' ),
			'has a path'                   => array( 'https://example.test/site-1' ),
			'userinfo'                     => array( 'https://user@example.test' ),
			'user and pass'                => array( 'https://user:secret@example.test' ),
			'empty host with a port'       => array( 'http://:80' ),
			'empty label'                  => array( 'http://ex..com' ),
			'non-numeric port'             => array( 'http://host:abc' ),
			'port above 65535'             => array( 'http://host:65536' ),
			'port zero'                    => array( 'http://host:0' ),
			'trailing dot'                 => array( 'http://example.test.' ),
			'label starting with a hyphen' => array( 'http://-a.test' ),
			'label ending with a hyphen'   => array( 'http://a-.test' ),
			'label over 63 characters'     => array( 'http://' . str_repeat( 'a', 64 ) . '.test' ),
			'invalid IPv6'                 => array( 'http://[zz]' ),
			'invalid UTF-8'                => array( "http://ex\xC3.test" ),
			'a lone dot'                   => array( 'http://.' ),
		);
	}

	/**
	 * Browsers report the origin as punycode, lowercase, and without a default port.
	 *
	 * @dataProvider normalised_filter_results
	 *
	 * @param string $result   What the filter returned.
	 * @param string $expected The origin that is used.
	 */
	public function test_filter_result_is_normalised_like_a_browser_origin( $result, $expected ) {
		add_filter(
			'rtgodam_site_origin',
			function () use ( $result ) {
				return $result;
			}
		);

		$this->assertSame( $expected, rtgodam_get_site_origin() );
	}

	/**
	 * @return array<string, array{0: string, 1: string}>
	 */
	public function normalised_filter_results() {
		return array(
			'unicode host becomes punycode' => array( 'https://bücher.example', 'https://xn--bcher-kva.example' ),
			'upper case unicode host'       => array( 'HTTPS://BÜCHER.example', 'https://xn--bcher-kva.example' ),
			'unicode label with a port'     => array( 'https://bücher.example:8443', 'https://xn--bcher-kva.example:8443' ),
			'already punycode'              => array( 'https://xn--bcher-kva.example', 'https://xn--bcher-kva.example' ),
			'IPv4 with a port'              => array( 'http://127.0.0.1:8080', 'http://127.0.0.1:8080' ),
			'IPv6 with a port'              => array( 'http://[::1]:8080', 'http://[::1]:8080' ),
			'localhost'                     => array( 'http://localhost', 'http://localhost' ),
			'default http port dropped'     => array( 'http://example.test:80', 'http://example.test' ),
			'default https port dropped'    => array( 'https://example.test:443', 'https://example.test' ),
			'other scheme default kept'     => array( 'https://example.test:80', 'https://example.test:80' ),
			'leading zeros in a port'       => array( 'http://example.test:08080', 'http://example.test:8080' ),
			'underscore in a label'         => array( 'http://my_host.test', 'http://my_host.test' ),
		);
	}

	/**
	 * Browsers report a lowercase origin, so a filter result is lowercased to match.
	 */
	public function test_filter_result_is_lowercased() {
		add_filter(
			'rtgodam_site_origin',
			function () {
				return 'HTTPS://Example.TEST:8080';
			}
		);

		$this->assertSame( 'https://example.test:8080', rtgodam_get_site_origin() );
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
			'unicode host in home URL'       => array( 'https://bücher.example/', 'https://xn--bcher-kva.example' ),
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
	 * When home_url() has no scheme or host the origin is '', and the analytics
	 * service reads an empty site_url as "all sites for the account". The handlers
	 * refuse to ask instead of widening the read.
	 *
	 * @dataProvider analytics_reads
	 *
	 * @param string               $method Analytics handler.
	 * @param array<string, mixed> $params Other request params the handler needs.
	 */
	public function test_analytics_read_makes_no_request_without_a_site_origin( $method, $params ) {
		$GLOBALS['rtgodam_stub']['home_url'] = '';

		$response = $this->analytics()->$method( new \WP_REST_Request( array_merge( array( 'site_url' => self::REQUEST_SITE_URL ), $params ) ) );

		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		$data = $response->get_data();
		$this->assertSame( 'error', $data['status'] );
		$this->assertSame( 'site_origin_unavailable', $data['errorType'] );
		$this->assertArrayNotHasKey( 'last_remote_url', $GLOBALS['rtgodam_stub'], 'no request should reach the microservice' );
	}

	public function test_engagement_makes_no_request_without_a_site_origin() {
		$GLOBALS['rtgodam_stub']['home_url'] = '';

		$response = $this->engagement()->get_activities( new \WP_REST_Request( array( 'video_id' => 'cmmid_job-1' ) ) );

		$this->assertInstanceOf( \WP_REST_Response::class, $response );
		$this->assertSame( 'site_origin_unavailable', $response->get_data()['errorType'] );
		$this->assertArrayNotHasKey( 'last_remote_url', $GLOBALS['rtgodam_stub'], 'no request should reach the microservice' );
	}

	/**
	 * Behind a proxy that ends TLS, home_url() can say http while the admin's
	 * browser is on https. Only that case, same host and port with the scheme as
	 * the sole difference, takes the request's value; anything else keeps the
	 * site's own origin.
	 *
	 * @dataProvider request_origins
	 *
	 * @param string      $home_url  The site's home URL.
	 * @param string|null $requested The site_url the admin page sent.
	 * @param string      $expected  The origin the read should send.
	 */
	public function test_analytics_read_trusts_only_a_scheme_only_difference( $home_url, $requested, $expected ) {
		$GLOBALS['rtgodam_stub']['home_url'] = $home_url;
		$params                              = null === $requested ? array() : array( 'site_url' => $requested );

		$this->analytics()->fetch_dashboard_metrics( new \WP_REST_Request( $params ) );

		$this->assertSame( $expected, $this->site_url_sent() );
	}

	/**
	 * @return array<string, array{0: string, 1: string|null, 2: string}>
	 */
	public function request_origins() {
		return array(
			'https request, http home'   => array( 'http://example.test', 'https://example.test', 'https://example.test' ),
			'http request, https home'   => array( 'https://example.test', 'http://example.test', 'http://example.test' ),
			'same scheme'                => array( 'https://example.test', 'https://example.test', 'https://example.test' ),
			'no site_url sent'           => array( 'http://example.test', null, 'http://example.test' ),
			'different host'             => array( 'http://example.test', 'https://another-site.test', 'http://example.test' ),
			'www against apex'           => array( 'https://example.test', 'https://www.example.test', 'https://example.test' ),
			'different port'             => array( 'http://localhost:8080', 'https://localhost:9090', 'http://localhost:8080' ),
			'same custom port'           => array( 'http://localhost:8080', 'https://localhost:8080', 'https://localhost:8080' ),
			'request adds a port'        => array( 'http://example.test', 'https://example.test:8443', 'http://example.test' ),
			'request has userinfo'       => array( 'http://example.test', 'https://user@example.test', 'http://example.test' ),
			'request has a path'         => array( 'http://example.test', 'https://example.test/site-1', 'http://example.test' ),
			'request is not http'        => array( 'http://example.test', 'ftp://example.test', 'http://example.test' ),
			'request in upper case'      => array( 'http://example.test', 'HTTPS://EXAMPLE.TEST', 'https://example.test' ),
			'request host contains home' => array( 'http://example.test', 'https://example.test.evil.test', 'http://example.test' ),
		);
	}

	/**
	 * The public views route never trusts the request, even for a scheme-only difference.
	 */
	public function test_engagement_never_uses_the_requests_origin() {
		$GLOBALS['rtgodam_stub']['home_url']  = 'http://example.test';
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

		$this->engagement()->get_activities(
			new \WP_REST_Request(
				array(
					'video_id' => 'cmmid_job-1',
					'site_url' => 'https://example.test',
				)
			)
		);

		$this->assertSame( 'http://example.test', $this->site_url_sent() );
	}

	/**
	 * The stub answers from $GLOBALS['rtgodam_stub']['user'] and reports a
	 * logged-out visitor when no user is set, which is what these tests assume.
	 */
	public function test_visitor_is_logged_out_unless_a_test_sets_a_user() {
		$this->assertFalse( is_user_logged_in() );

		$GLOBALS['rtgodam_stub']['user'] = 7;

		$this->assertTrue( is_user_logged_in() );
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
