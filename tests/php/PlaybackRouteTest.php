<?php
/**
 * `GET godam/v1/playback/<job>`: signed sources for a GoDAM file this site shows.
 *
 * The route is public, so these pin what stands between any visitor and the site's
 * License key: it answers only for files the site has an attachment for, never sends the
 * key out, caches answers within their signatures, keeps refusals briefly and backs off
 * (with one log line) when GoDAM can't be reached or rate-limits the site.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Playback;

/**
 * Runs in separate processes: each test evals its own HTTP, object cache and query stubs.
 *
 * @covers \RTGODAM\Inc\REST_API\Playback
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class PlaybackRouteTest extends TestCase {

	/**
	 * The route under test.
	 *
	 * @var Playback
	 */
	private $route;

	/**
	 * Where error_log() writes during a test.
	 *
	 * @var string
	 */
	private $log;

	/**
	 * Stub WordPress around the route and load it.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub']  = array(
			'options'   => array( 'rtgodam-api-key' => 'SITE-KEY' ),
			'transient' => array(),
		);
		$GLOBALS['rtgodam_cache'] = array();
		$GLOBALS['rtgodam_http']  = array( 'calls' => array() );

		if ( ! defined( 'RTGODAM_API_BASE' ) ) {
			define( 'RTGODAM_API_BASE', 'https://app.godam.test' );
		}

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		$stubs = array(
			'wp_cache_get'       => 'function wp_cache_get( $key, $group = "" ) { return $GLOBALS["rtgodam_cache"][ $group ][ $key ] ?? false; }',
			'wp_cache_set'       => 'function wp_cache_set( $key, $value, $group = "", $expire = 0 ) { $GLOBALS["rtgodam_cache"][ $group ][ $key ] = $value; return true; }',
			'esc_url_raw'        => 'function esc_url_raw( $url ) { return (string) $url; }',
			'sanitize_key'       => 'function sanitize_key( $key ) { return strtolower( preg_replace( "/[^a-zA-Z0-9_\-]/", "", (string) $key ) ); }',
			'wp_safe_remote_get' => 'function wp_safe_remote_get( $url, $args = array() ) { $GLOBALS["rtgodam_http"]["calls"][] = array( "url" => $url, "args" => $args ); return $GLOBALS["rtgodam_http"]["reply"]; }',
		);
		if ( class_exists( 'WP_Query' ) ) {
			$this->fail( "WP_Query is already defined, so this test can't see the route's lookup" );
		}
		eval(
			'class WP_Query {
				public $posts = array();
				public function __construct( $args ) {
					$GLOBALS["rtgodam_queries"][] = $args;
					$keys = array();
					foreach ( $args["meta_query"] as $clause ) {
						if ( is_array( $clause ) ) {
							$keys[ $clause["key"] ] = $clause["value"];
						}
					}
					foreach ( $GLOBALS["rtgodam_attachments"] as $id => $meta ) {
						foreach ( $meta as $key => $value ) {
							if ( isset( $keys[ $key ] ) && $keys[ $key ] === $value ) {
								$this->posts = array( $id );
								return;
							}
						}
					}
				}
			}'
		);
		foreach ( $stubs as $name => $code ) {
			if ( function_exists( $name ) ) {
				$this->fail( "$name is already defined, so this test can't see the route's calls to it" );
			}
			eval( $code );
		}
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		$root = dirname( __DIR__, 2 );
		require_once $root . '/tests/stubs/hooks.php';
		require_once $root . '/tests/stubs/wp-http-functions.php';
		require_once $root . '/tests/stubs/class-wp-rest-request.php';
		require_once $root . '/inc/traits/trait-singleton.php';
		require_once $root . '/inc/helpers/class-api-key.php';
		require_once $root . '/inc/classes/rest-api/class-base.php';
		require_once $root . '/inc/classes/rest-api/class-playback.php';

		$this->log = tempnam( sys_get_temp_dir(), 'godam-playback-log' );
		ini_set( 'error_log', $this->log ); // phpcs:ignore WordPress.PHP.IniSet.Risky -- test-only, isolated process.

		$this->route = ( new \ReflectionClass( Playback::class ) )->newInstanceWithoutConstructor();

		// Attachment 42 is the site's copy of job-used (as GoDAM names its job on upload);
		// attachment 43 a virtual media entry pointing at job-virtual.
		$GLOBALS['rtgodam_attachments'] = array(
			42 => array( 'rtgodam_transcoding_job_id' => 'job-used' ),
			43 => array( '_godam_original_id' => 'job-virtual' ),
		);
		$GLOBALS['rtgodam_queries']     = array();
	}

	/**
	 * Remove the captured log.
	 */
	protected function tearDown(): void {
		if ( $this->log && file_exists( $this->log ) ) {
			unlink( $this->log ); // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink -- test temp file.
		}
		parent::tearDown();
	}

	/**
	 * GoDAM's reply to the next call.
	 *
	 * @param int   $code HTTP status.
	 * @param array $body Decoded JSON body.
	 * @return void
	 */
	private function godam_replies( $code, array $body ) {
		// The bootstrap's wp_remote_retrieve_* stubs read `code` and `body` off the reply.
		$GLOBALS['rtgodam_http']['reply'] = array(
			'code' => $code,
			'body' => wp_json_encode( $body ),
		);
	}

	/**
	 * A signed answer for a video file.
	 *
	 * @param int $expires_in Seconds the signatures have left.
	 * @return array
	 */
	private function signed_answer( $expires_in = 1200 ) {
		return array(
			'message' => array(
				'sources'        => array(
					'transcoded_hls_path'  => 'https://cdn.test/private/p/index.m3u8?token=a',
					'transcoded_file_path' => 'https://cdn.test/private/p/manifest.mpd?token=b',
					'transcoded_mp4_url'   => 'https://cdn.test/private/p/video.mp4?token=c',
					'thumbnail_url'        => 'https://cdn.test/private/p/thumb.jpg?token=d',
				),
				'caption_tracks' => array(
					array(
						'vtt_path'   => 'https://cdn.test/private/p/en.vtt?token=e',
						'language'   => 'en',
						'label'      => 'English',
						'kind'       => 'subtitles',
						'is_default' => true,
						'revision'   => '3',
					),
					array( 'language' => 'fr' ),
					'not a track',
				),
				'expires_at'     => time() + $expires_in,
			),
		);
	}

	/**
	 * Ask the route for a job.
	 *
	 * @param string $job Job id.
	 * @return \WP_REST_Response|\WP_Error
	 */
	private function ask( $job = 'job-used' ) {
		return $this->route->get_playback( new \WP_REST_Request( array( 'job_id' => $job ) ) );
	}

	/**
	 * The lines error_log() wrote.
	 *
	 * @return string[]
	 */
	private function log_lines() {
		$text = file_exists( $this->log ) ? (string) file_get_contents( $this->log ) : ''; // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- test temp file.
		return array_values( array_filter( explode( "\n", $text ) ) );
	}

	/**
	 * A file the site has no attachment for is never signed, and GoDAM isn't asked.
	 */
	public function test_a_file_this_site_does_not_use_is_not_found() {
		$this->godam_replies( 200, $this->signed_answer() );
		$result = $this->ask( 'someone-elses-job' );
		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( 404, $result->get_error_data()['status'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_http']['calls'] );
		// The answer is remembered, so a scan of ids doesn't query the database each time.
		$this->assertSame( 'no', $GLOBALS['rtgodam_cache']['godam'][ 'rtgodam_playback_uses_' . md5( 'someone-elses-job' ) ] );
	}

	/**
	 * A virtual media entry counts as the site using the file; the lookup is cached.
	 */
	public function test_a_virtual_media_entry_counts_and_the_lookup_is_cached() {
		$this->godam_replies( 200, $this->signed_answer() );
		$this->assertInstanceOf( \WP_REST_Response::class, $this->ask( 'job-virtual' ) );
		$GLOBALS['rtgodam_stub']['transient'] = array();
		$this->ask( 'job-virtual' );
		$this->assertCount( 1, $GLOBALS['rtgodam_queries'] );
		$query = $GLOBALS['rtgodam_queries'][0];
		$this->assertSame( 'attachment', $query['post_type'] );
		$this->assertSame( 'OR', $query['meta_query']['relation'] );
	}

	/**
	 * The answer: player sources in order, the poster, the ready caption tracks, the key in a
	 * header only, and the browser told to keep it briefly.
	 */
	public function test_it_returns_signed_sources_posters_and_ready_captions() {
		$this->godam_replies( 200, $this->signed_answer() );
		$result = $this->ask();

		$this->assertInstanceOf( \WP_REST_Response::class, $result );
		$data = $result->get_data();
		$this->assertSame(
			array( 'application/x-mpegURL', 'application/dash+xml', 'video/mp4' ),
			array_column( $data['sources'], 'type' )
		);
		$this->assertSame( 'https://cdn.test/private/p/thumb.jpg?token=d', $data['poster'] );
		$this->assertSame( '', $data['image'] );
		$this->assertCount( 1, $data['captions'] );
		$this->assertSame( 'en', $data['captions'][0]['language'] );
		$this->assertTrue( $data['captions'][0]['is_default'] );

		$call = $GLOBALS['rtgodam_http']['calls'][0];
		$this->assertStringContainsString( 'file_id=job-used', $call['url'] );
		$this->assertStringNotContainsString( 'SITE-KEY', $call['url'] );
		$this->assertSame( 'SITE-KEY', $call['args']['headers']['X-API-KEY'] );
		$this->assertStringNotContainsString( 'SITE-KEY', wp_json_encode( $data ) );
		$this->assertSame( 'private, max-age=60', $result->get_headers()['Cache-Control'] );
	}

	/**
	 * A second view is served from the cache while the signatures have time left.
	 */
	public function test_a_fresh_answer_is_served_from_the_cache() {
		$this->godam_replies( 200, $this->signed_answer() );
		$this->ask();
		$this->ask();
		$this->assertCount( 1, $GLOBALS['rtgodam_http']['calls'] );
	}

	/**
	 * An answer close to expiry isn't served again: the player would start on dying URLs.
	 */
	public function test_an_answer_near_its_expiry_is_fetched_again() {
		$this->godam_replies( 200, $this->signed_answer( 100 ) );
		$this->ask();
		$this->ask();
		$this->assertCount( 2, $GLOBALS['rtgodam_http']['calls'] );
	}

	/**
	 * An image file: its full image, signed; a main path that is an MP4 plays as one.
	 */
	public function test_an_image_file_returns_its_full_image_and_an_mp4_main_path_plays_as_mp4() {
		$this->godam_replies(
			200,
			array(
				'message' => array(
					'sources'    => array( 'transcoded_file_path' => 'https://cdn.test/private/p/photo.webp?token=a' ),
					'expires_at' => time() + 1200,
				),
			)
		);
		$this->assertSame( 'https://cdn.test/private/p/photo.webp?token=a', $this->ask()->get_data()['image'] );

		$GLOBALS['rtgodam_stub']['transient'] = array();
		$this->godam_replies(
			200,
			array( 'message' => array( 'sources' => array( 'transcoded_file_path' => 'https://cdn.test/private/p/v.mp4?token=b' ) ) )
		);
		$data = $this->ask()->get_data();
		$this->assertSame( 'video/mp4', $data['sources'][0]['type'] );
		// No expiry in the reply: five minutes are assumed.
		$this->assertGreaterThan( time() + 200, $data['expires_at'] );
	}

	/**
	 * GoDAM refusing a file (a Private one, a lapsed license) is a 403 kept briefly, so a busy
	 * page doesn't ask on every view.
	 */
	public function test_a_refusal_is_a_403_and_is_kept_briefly() {
		$this->godam_replies(
			403,
			array(
				'message' => array(
					'error_type' => 'PermissionDenied',
					'message'    => 'x',
				),
			)
		);
		$first = $this->ask();
		$this->assertSame( 403, $first->get_error_data()['status'] );
		$this->assertSame( 'godam_playback_permissiondenied', $first->get_error_code() );
		$this->ask();
		$this->assertCount( 1, $GLOBALS['rtgodam_http']['calls'] );
	}

	/**
	 * A server error without a reason isn't kept: a blip shouldn't last a minute.
	 */
	public function test_an_error_without_a_reason_is_not_kept() {
		$this->godam_replies( 500, array( 'exc_type' => 'Boom' ) );
		$this->assertSame( 'godam_playback_unavailable', $this->ask()->get_error_code() );
		$this->ask();
		$this->assertCount( 2, $GLOBALS['rtgodam_http']['calls'] );
		$this->assertSame( array(), $this->log_lines() );
	}

	/**
	 * GoDAM unreachable: 502 for the whole back-off, one call and one log line.
	 */
	public function test_unreachable_backs_off_with_one_log_line_and_a_502_throughout() {
		$GLOBALS['rtgodam_http']['reply'] = new \WP_Error( 'http_request_failed', 'cURL error 28: Operation timed out' );
		$first                            = $this->ask();
		$second                           = $this->ask();
		$this->assertSame( 502, $first->get_error_data()['status'] );
		$this->assertSame( 'godam_playback_unreachable', $second->get_error_code() );
		$this->assertCount( 1, $GLOBALS['rtgodam_http']['calls'] );
		$lines = $this->log_lines();
		$this->assertCount( 1, $lines );
		$this->assertStringContainsString( 'job job-used is backing off for 15 s: cURL error 28', $lines[0] );
		$this->assertStringNotContainsString( 'SITE-KEY', $lines[0] );
	}

	/**
	 * GoDAM rate-limiting the site: a 403 refusal, kept for the back-off, logged once.
	 */
	public function test_rate_limiting_backs_off_and_logs_once() {
		$this->godam_replies( 429, array() );
		$this->assertSame( 'godam_playback_rate_limited', $this->ask()->get_error_code() );
		$this->ask();
		$this->assertCount( 1, $GLOBALS['rtgodam_http']['calls'] );
		$this->assertCount( 1, $this->log_lines() );
		$this->assertStringContainsString( 'rate limited (429)', $this->log_lines()[0] );
	}

	/**
	 * A site that isn't connected says so, without asking GoDAM.
	 */
	public function test_a_site_without_a_key_is_503() {
		$GLOBALS['rtgodam_stub']['options'] = array();
		$this->godam_replies( 200, $this->signed_answer() );
		$this->assertSame( 503, $this->ask()->get_error_data()['status'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_http']['calls'] );
	}

	/**
	 * The route is registered for readable requests with a job id of a safe shape only.
	 */
	public function test_the_route_takes_only_a_safe_job_id() {
		$route = $this->route->get_rest_routes()[0];
		$this->assertSame( '/playback/(?P<job_id>[A-Za-z0-9_-]{4,64})', substr( $route['route'], strpos( $route['route'], '/playback' ) ) );
		foreach ( array( '../etc', "a'b", str_repeat( 'a', 65 ), 'abc' ) as $bad ) {
			$this->assertSame( 0, preg_match( '#^/playback/(?P<job_id>[A-Za-z0-9_-]{4,64})$#', '/playback/' . $bad ), $bad );
		}
	}
}
