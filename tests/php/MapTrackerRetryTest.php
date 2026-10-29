<?php
/**
 * When a forward to GoDAM Central is tried again, and when it is given up on.
 *
 * Central answers `{"status": "ok"}` to everything it accepts and refuses alike, so
 * the status code is all there is to go on: a network error, a 429 or a 5xx is
 * worth another attempt, with back-off; a 4xx means this site's licence key is
 * wrong and will not fix itself. These pin that split, the back-off, the attempt
 * cap, and what the forward itself sends.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Map_Tracker;

/**
 * Runs in separate processes: each test evals its own Action Scheduler stand-in.
 *
 * @covers \RTGODAM\Inc\Map_Tracker::async_map_event
 * @covers \RTGODAM\Inc\Map_Tracker::maybe_retry
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class MapTrackerRetryTest extends TestCase {

	/**
	 * A forward that passes validation.
	 */
	const EVENT = array(
		'media_id'   => 'job-abc123',
		'milestone'  => 50,
		'page_url'   => 'https://example.com/watch/',
		'session_id' => 'session-0001',
		'ids'        => array( 'hubspotutk' => '0123456789abcdef0123456789abcdef' ),
	);

	/**
	 * The tracker under test.
	 *
	 * @var Map_Tracker
	 */
	private $tracker;

	/**
	 * Store a licence key and stand in for Action Scheduler's scheduling call.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array(
			'options' => array( 'rtgodam-api-key' => 'licence-key' ),
			'posts'   => array(),
		);
		$GLOBALS['rtgodam_jobs'] = array();

		// phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
		eval( 'function as_schedule_single_action( $timestamp, $hook, $args = array() ) { $GLOBALS["rtgodam_jobs"][] = array( "at" => $timestamp, "hook" => $hook, "args" => $args ); return count( $GLOBALS["rtgodam_jobs"] ); }' );

		$this->tracker = ( new \ReflectionClass( Map_Tracker::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * Make Central answer every forward with this status, or a transport error.
	 *
	 * @param int|null $code HTTP status, or null for a network error.
	 * @return void
	 */
	private function central_answers( $code ) {
		$GLOBALS['rtgodam_stub']['post_handler'] = static function () use ( $code ) {
			return null === $code
				? new \WP_Error( 'http_request_failed', 'cURL error 28: Operation timed out' )
				: array(
					'code' => $code,
					'body' => '{"status": "ok"}',
				);
		};
	}

	/**
	 * The forward goes to Central's track method with the key in `X-Api-Key` and
	 * the event's fields in the body.
	 *
	 * @return void
	 */
	public function test_sends_the_event_with_the_licence_key() {
		$this->central_answers( 200 );
		$this->tracker->async_map_event( self::EVENT );

		$post = $GLOBALS['rtgodam_stub']['posts'][0];

		$this->assertSame( 'https://api.test/api/method/godam_core.api.map_events.track', $post['url'] );
		$this->assertSame( 'licence-key', $post['args']['headers']['X-Api-Key'] );
		$this->assertSame( self::EVENT + array( 'surface' => 'wordpress' ), json_decode( $post['args']['body'], true ) );
	}

	/**
	 * A network error, a 429 and a 5xx are each tried again, as the next attempt.
	 *
	 * @return void
	 */
	public function test_retries_a_network_error_429_and_5xx() {
		foreach ( array( null, 429, 500, 502, 503 ) as $code ) {
			$GLOBALS['rtgodam_jobs'] = array();
			$this->central_answers( $code );

			$this->tracker->async_map_event( self::EVENT );

			$this->assertCount( 1, $GLOBALS['rtgodam_jobs'], null === $code ? 'network error' : (string) $code );
			$this->assertSame( Map_Tracker::ASYNC_HOOK, $GLOBALS['rtgodam_jobs'][0]['hook'] );
			$this->assertSame( array( self::EVENT, 2 ), $GLOBALS['rtgodam_jobs'][0]['args'] );
		}
	}

	/**
	 * A success is done, and a 4xx is this site's own fault: neither is retried.
	 *
	 * @return void
	 */
	public function test_does_not_retry_a_success_or_a_4xx() {
		foreach ( array( 200, 400, 401, 403, 404 ) as $code ) {
			$this->central_answers( $code );
			$this->tracker->async_map_event( self::EVENT );
		}

		$this->assertCount( 5, $GLOBALS['rtgodam_stub']['posts'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_jobs'] );
	}

	/**
	 * The wait doubles each time: 1, 2, 4 and 8 minutes after attempts 1 to 4.
	 *
	 * @return void
	 */
	public function test_backs_off_exponentially() {
		$this->central_answers( 503 );

		// Attempt that failed => minutes until the next one.
		$waits = array(
			1 => 1,
			2 => 2,
			3 => 4,
			4 => 8,
		);

		foreach ( $waits as $attempt => $minutes ) {
			$GLOBALS['rtgodam_jobs'] = array();
			$before                  = time();

			$this->tracker->async_map_event( self::EVENT, $attempt );

			$delay = $GLOBALS['rtgodam_jobs'][0]['at'] - $before;

			$this->assertGreaterThanOrEqual( $minutes * MINUTE_IN_SECONDS, $delay, "attempt $attempt" );
			$this->assertLessThanOrEqual( $minutes * MINUTE_IN_SECONDS + 1, $delay, "attempt $attempt" );
			$this->assertSame( $attempt + 1, $GLOBALS['rtgodam_jobs'][0]['args'][1] );
		}
	}

	/**
	 * The last allowed attempt is not followed by another, however it fails.
	 *
	 * @return void
	 */
	public function test_gives_up_after_the_last_attempt() {
		$this->central_answers( 503 );
		$this->tracker->async_map_event( self::EVENT, Map_Tracker::MAX_ATTEMPTS );

		$this->assertCount( 1, $GLOBALS['rtgodam_stub']['posts'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_jobs'] );
	}

	/**
	 * Without a licence key, or with an event that no longer validates, nothing is
	 * sent and nothing is retried.
	 *
	 * @return void
	 */
	public function test_sends_nothing_without_a_key_or_a_valid_event() {
		$this->central_answers( 503 );

		$this->tracker->async_map_event( array( 'ids' => array() ) + self::EVENT );
		$this->tracker->async_map_event( array( 'milestone' => 30 ) + self::EVENT );

		unset( $GLOBALS['rtgodam_stub']['options']['rtgodam-api-key'] );
		$this->tracker->async_map_event( self::EVENT );

		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['posts'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_jobs'] );
	}
}
