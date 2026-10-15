<?php
/**
 * A key that verified as valid must not be switched off by a slow or failing
 * GoDAM Central: only a definitive answer about the key changes its status.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * Runs in separate processes: it loads admin/godam-transcoder-functions.php, which
 * EarlyTranslationHooksTest needs to be the first to load, and evals WP stubs.
 *
 * @covers ::rtgodam_verify_api_key
 * @covers ::rtgodam_get_user_data
 * @covers ::rtgodam_keep_user_data_after_failed_check
 * @covers ::rtgodam_is_verification_unavailable
 * @covers ::rtgodam_schedule_user_data_refresh
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class ApiKeyVerificationResilienceTest extends TestCase {

	/**
	 * Load the code under test and stub the WordPress functions it calls.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array(
			'options'   => array(),
			'posts'     => array(),
			'responses' => array(),
			'scheduled' => array(),
			'cron'      => false,
		);

		$stubs = array(
			'update_option'            => 'function update_option( $key, $value ) { $GLOBALS["rtgodam_stub"]["options"][ $key ] = $value; return true; }',
			'delete_option'            => 'function delete_option( $key ) { unset( $GLOBALS["rtgodam_stub"]["options"][ $key ] ); return true; }',
			'get_current_user_id'      => 'function get_current_user_id() { return 1; }',
			'get_site_url'             => 'function get_site_url() { return "https://site.example"; }',
			'get_bloginfo'             => 'function get_bloginfo( $show = "" ) { return "Site"; }',
			'wp_doing_cron'            => 'function wp_doing_cron() { return $GLOBALS["rtgodam_stub"]["cron"]; }',
			'wp_next_scheduled'        => 'function wp_next_scheduled( $hook ) { return isset( $GLOBALS["rtgodam_stub"]["scheduled"][ $hook ] ) ? 1 : false; }',
			'wp_schedule_single_event' => 'function wp_schedule_single_event( $time, $hook ) { $GLOBALS["rtgodam_stub"]["scheduled"][ $hook ] = $time; return true; }',
			// Answers the verify call with the next queued response, and the usage call with an error.
			'wp_safe_remote_post'      => 'function wp_safe_remote_post( $url, $args = array() ) {
				$GLOBALS["rtgodam_stub"]["posts"][] = array( "url" => $url, "args" => $args );
				if ( false === strpos( $url, "verify_api_key" ) ) {
					return new \WP_Error( "http_request_failed", "usage unavailable" );
				}
				return array_shift( $GLOBALS["rtgodam_stub"]["responses"] );
			}',
		);

		foreach ( $stubs as $name => $code ) {
			if ( ! function_exists( $name ) ) {
				eval( $code ); // phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
			}
		}

		$root = dirname( __DIR__, 2 );
		require_once $root . '/inc/classes/enums/class-api-key-status.php';
		require_once $root . '/inc/classes/enums/class-http-status-code.php';
		require_once $root . '/inc/helpers/class-api-key.php';
		require_once $root . '/admin/godam-transcoder-functions.php';
	}

	/**
	 * A 503 that carries an `error` (Central's "temporarily unavailable" reply) is a
	 * temporary failure: the stored key status stays valid.
	 */
	public function test_service_unavailable_does_not_mark_a_valid_key_expired() {
		$this->store_key( 'valid' );
		$this->queue_response( 503, array( 'error' => 'Service temporarily unavailable' ) );

		$result = rtgodam_verify_api_key( 'key' );

		$this->assertTrue( rtgodam_is_verification_unavailable( $result ) );
		$this->assertSame( 'valid', $this->option( 'rtgodam-api-key-status' ) );
		$this->assertNull( $this->option( 'rtgodam-api-key-error-since' ) );
	}

	/**
	 * "Account setup is still in progress" is also a 503 and must not expire the key.
	 */
	public function test_account_setup_in_progress_does_not_mark_a_valid_key_expired() {
		$this->store_key( 'valid' );
		$this->queue_response(
			503,
			array(
				'error'      => 'Account setup is still in progress',
				'error_code' => 'account_setup_in_progress',
			)
		);

		rtgodam_verify_api_key( 'key' );

		$this->assertSame( 'valid', $this->option( 'rtgodam-api-key-status' ) );
	}

	/**
	 * An inactive licence (403) is a definitive answer and still expires the key.
	 */
	public function test_inactive_licence_marks_a_valid_key_expired() {
		$this->store_key( 'valid' );
		$this->queue_response( 403, array( 'error' => 'License is not active' ) );

		$result = rtgodam_verify_api_key( 'key' );

		$this->assertFalse( rtgodam_is_verification_unavailable( $result ) );
		$this->assertSame( 'expired', $this->option( 'rtgodam-api-key-status' ) );
	}

	/**
	 * Older Central versions answer an invalid key with HTTP 200 and an `error`.
	 */
	public function test_legacy_200_error_still_marks_a_valid_key_expired() {
		$this->store_key( 'valid' );
		$this->queue_response( 200, array( 'error' => 'License is not active' ) );

		rtgodam_verify_api_key( 'key' );

		$this->assertSame( 'expired', $this->option( 'rtgodam-api-key-status' ) );
	}

	/**
	 * The verify call waits long enough for Central's cold-cache preflight checks.
	 */
	public function test_verify_request_uses_a_longer_timeout() {
		$this->store_key( 'valid' );
		$this->queue_response( 200, $this->licence() );

		rtgodam_verify_api_key( 'key' );

		$this->assertSame( 30, $GLOBALS['rtgodam_stub']['posts'][0]['args']['timeout'] );
	}

	/**
	 * A timeout keeps a recently valid key working and retries in a few minutes.
	 */
	public function test_failed_check_keeps_a_recently_valid_key_and_retries_soon() {
		$last_checked = time() - 2 * HOUR_IN_SECONDS;
		$this->store_key( 'valid', $this->cached( true, $last_checked ) );
		$this->queue_timeout();
		$GLOBALS['rtgodam_stub']['cron'] = true;

		$data = rtgodam_get_user_data();

		$this->assertTrue( $data['valid_api_key'] );
		$this->assertSame( 'valid', $data['api_key_status'] );
		$this->assertSame( $last_checked, $data['timestamp'] );
		$this->assertEqualsWithDelta( time() + 5 * MINUTE_IN_SECONDS, $data['retry_at'], 2 );
		$this->assertEqualsWithDelta( time(), $data['checked_at'], 2 );
		$this->assertSame( 'valid', $this->option( 'rtgodam-api-key-status' ) );
	}

	/**
	 * After a day without a successful check the key is shown as not verified.
	 */
	public function test_failed_check_after_the_trust_window_reports_verification_failed() {
		$this->store_key( 'valid', $this->cached( true, time() - 2 * DAY_IN_SECONDS ) );
		$this->queue_timeout();

		$data = rtgodam_get_user_data();

		$this->assertFalse( $data['valid_api_key'] );
		$this->assertSame( 'verification_failed', $data['api_key_status'] );
		$this->assertSame( 'valid', $this->option( 'rtgodam-api-key-status' ) );
	}

	/**
	 * While a retry is pending, requests do not call Central.
	 */
	public function test_pending_retry_skips_the_remote_call() {
		$cached             = $this->cached( true, time() - 2 * HOUR_IN_SECONDS );
		$cached['retry_at'] = time() + MINUTE_IN_SECONDS;
		$this->store_key( 'valid', $cached );
		$GLOBALS['rtgodam_stub']['cron'] = true;

		rtgodam_get_user_data();

		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['posts'] );
	}

	/**
	 * Slightly stale data is served as is and refreshed in WP-Cron, not in the request.
	 */
	public function test_slightly_stale_data_refreshes_in_the_background() {
		$this->store_key( 'valid', $this->cached( true, time() - 90 * MINUTE_IN_SECONDS ) );

		$data = rtgodam_get_user_data();

		$this->assertTrue( $data['valid_api_key'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['posts'] );
		$this->assertArrayHasKey( 'rtgodam_refresh_user_data', $GLOBALS['rtgodam_stub']['scheduled'] );
	}

	/**
	 * Data far past its refresh time is verified in the request (WP-Cron may never run).
	 */
	public function test_very_stale_data_is_verified_in_the_request() {
		$this->store_key( 'valid', $this->cached( true, time() - 5 * HOUR_IN_SECONDS ) );
		$this->queue_response( 200, $this->licence() );

		$data = rtgodam_get_user_data();

		$this->assertCount( 2, $GLOBALS['rtgodam_stub']['posts'] ); // Verify, then usage.
		$this->assertTrue( $data['valid_api_key'] );
		$this->assertArrayNotHasKey( 'retry_at', $data );
		$this->assertEqualsWithDelta( time(), $data['timestamp'], 2 );
	}

	/**
	 * A check inside a page load waits less than one in WP-Cron, so a hanging
	 * Central cannot hold a visitor for the full 30 s.
	 */
	public function test_check_in_the_request_uses_a_shorter_timeout() {
		$this->store_key( 'valid', $this->cached( true, time() - 5 * HOUR_IN_SECONDS ) );
		$this->queue_response( 200, $this->licence() );

		rtgodam_get_user_data();

		$this->assertSame( 10, $GLOBALS['rtgodam_stub']['posts'][0]['args']['timeout'] );
	}

	/**
	 * An elapsed retry time triggers the check even when the cache is younger than
	 * the normal refresh period (e.g. a Refresh Status that failed 30 minutes in).
	 */
	public function test_elapsed_retry_checks_before_the_normal_refresh_time() {
		$cached             = $this->cached( true, time() - 30 * MINUTE_IN_SECONDS );
		$cached['retry_at'] = time() - 1;
		$this->store_key( 'valid', $cached );
		$this->queue_response( 200, $this->licence() );
		$GLOBALS['rtgodam_stub']['cron'] = true;

		rtgodam_get_user_data();

		$this->assertCount( 2, $GLOBALS['rtgodam_stub']['posts'] );
	}

	/**
	 * The short retry only lasts while Central keeps failing: once a check succeeds
	 * the site is back on the hourly check.
	 */
	public function test_successful_check_ends_the_short_retry() {
		$cached             = $this->cached( true, time() - 2 * HOUR_IN_SECONDS );
		$cached['retry_at'] = time() - 1;
		$this->store_key( 'valid', $cached );
		$this->queue_response( 200, $this->licence() );
		$GLOBALS['rtgodam_stub']['cron'] = true;

		$data = rtgodam_get_user_data();

		$this->assertArrayNotHasKey( 'retry_at', $data );
		$this->assertArrayNotHasKey( 'retry_at', $this->option( 'rtgodam_user_data' ) );
		$this->assertSame( $data['timestamp'], $data['checked_at'] );
	}

	/**
	 * What a successful check saves (no `retry_at`) is not checked again for an hour.
	 */
	public function test_after_recovery_the_check_is_hourly_again() {
		$cached               = $this->cached( true, time() - 10 * MINUTE_IN_SECONDS );
		$cached['checked_at'] = $cached['timestamp'];
		$this->store_key( 'valid', $cached );
		$GLOBALS['rtgodam_stub']['cron'] = true;

		rtgodam_get_user_data();

		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['posts'] );
	}

	/**
	 * While Central keeps failing, WP-Cron does the retries: a visitor's request does
	 * not check inline just because the last *successful* check is hours old.
	 */
	public function test_ongoing_failures_are_retried_in_the_background() {
		$cached               = $this->cached( true, time() - 4 * HOUR_IN_SECONDS );
		$cached['checked_at'] = time() - 6 * MINUTE_IN_SECONDS;
		$cached['retry_at']   = time() - MINUTE_IN_SECONDS;
		$this->store_key( 'valid', $cached );

		$data = rtgodam_get_user_data();

		$this->assertTrue( $data['valid_api_key'] );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['posts'] );
		$this->assertArrayHasKey( 'rtgodam_refresh_user_data', $GLOBALS['rtgodam_stub']['scheduled'] );
	}

	/**
	 * A request calls Central at most once, even if another request overwrote the
	 * saved data with an older copy in between.
	 */
	public function test_central_is_called_at_most_once_per_request() {
		$stale = $this->cached( true, time() - 5 * HOUR_IN_SECONDS );
		$this->store_key( 'valid', $stale );
		$this->queue_timeout();
		$this->queue_timeout();

		rtgodam_get_user_data();
		$GLOBALS['rtgodam_stub']['options']['rtgodam_user_data'] = $stale;
		$data = rtgodam_get_user_data();

		$this->assertCount( 1, $this->verify_calls() );
		$this->assertArrayHasKey( 'retry_at', $data );
	}

	/**
	 * An expired key past its grace period is re-checked twice a day, so a renewal
	 * is picked up without a manual refresh.
	 */
	public function test_expired_key_past_grace_is_rechecked_periodically() {
		$this->store_key( 'expired', $this->cached( false, time() - 13 * HOUR_IN_SECONDS ) );
		$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key-error-since'] = time() - DAY_IN_SECONDS;
		$this->queue_response( 200, $this->licence() );
		$GLOBALS['rtgodam_stub']['cron'] = true;

		$data = rtgodam_get_user_data();

		$this->assertTrue( $data['valid_api_key'] );
		$this->assertSame( 'valid', $this->option( 'rtgodam-api-key-status' ) );
	}

	/**
	 * Between those re-checks an expired key does not call Central.
	 */
	public function test_expired_key_past_grace_is_not_checked_hourly() {
		$this->store_key( 'expired', $this->cached( false, time() - 6 * HOUR_IN_SECONDS ) );
		$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key-error-since'] = time() - DAY_IN_SECONDS;
		$GLOBALS['rtgodam_stub']['cron']                                   = true;

		rtgodam_get_user_data();

		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['posts'] );
	}

	/**
	 * The verify calls made so far (the usage call is left out).
	 *
	 * @return array
	 */
	private function verify_calls() {
		return array_filter(
			$GLOBALS['rtgodam_stub']['posts'],
			function ( $post ) {
				return false !== strpos( $post['url'], 'verify_api_key' );
			}
		);
	}

	/**
	 * Store the key, its status and optionally the cached user data.
	 *
	 * @param string     $status Stored key status.
	 * @param array|null $cached Cached rtgodam_user_data.
	 */
	private function store_key( $status, $cached = null ) {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key']        = 'key';
		$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key-status'] = $status;

		if ( null !== $cached ) {
			$GLOBALS['rtgodam_stub']['options']['rtgodam_user_data'] = $cached;
		}
	}

	/**
	 * Cached user data as rtgodam_get_user_data() stores it.
	 *
	 * @param bool $valid     Whether the key verified.
	 * @param int  $timestamp Time of the last successful check.
	 *
	 * @return array
	 */
	private function cached( $valid, $timestamp ) {
		return array(
			'currentUserId'  => 1,
			'valid_api_key'  => $valid,
			'api_key_status' => $valid ? 'valid' : 'expired',
			'user_data'      => array( 'masked_api_key' => '***key' ),
			'timestamp'      => $timestamp,
		);
	}

	/**
	 * Central's success payload.
	 *
	 * @return array
	 */
	private function licence() {
		return array(
			'status'        => 'Active',
			'account_token' => 'token',
		);
	}

	/**
	 * Queue Central's answer to the next verify call.
	 *
	 * @param int   $code    HTTP status.
	 * @param array $message The `message` Frappe wraps the endpoint's return value in.
	 */
	private function queue_response( $code, $message ) {
		$GLOBALS['rtgodam_stub']['responses'][] = array(
			'code' => $code,
			'body' => wp_json_encode( array( 'message' => $message ) ),
		);
	}

	/**
	 * Queue a request that times out.
	 */
	private function queue_timeout() {
		$GLOBALS['rtgodam_stub']['responses'][] = new \WP_Error( 'http_request_failed', 'cURL error 28: Operation timed out' );
	}

	/**
	 * Read a stubbed option.
	 *
	 * @param string $key Option name.
	 *
	 * @return mixed Null when unset.
	 */
	private function option( $key ) {
		return $GLOBALS['rtgodam_stub']['options'][ $key ] ?? null;
	}
}
