<?php
/**
 * Licence and source-video preflight results from GoDAM Central.
 *
 * @see https://github.com/rtCamp/godam-core/issues/856
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * Runs in separate processes: the issues helper reads the key status through
 * admin/godam-transcoder-functions.php, which EarlyTranslationHooksTest needs to
 * be the first to load.
 *
 * @covers ::rtgodam_get_preflight_issues
 * @covers ::rtgodam_get_preflight_failure_message
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class PreflightTest extends TestCase {

	/**
	 * Reset the stubbed options before each test.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array();

		$root = dirname( __DIR__, 2 );
		require_once $root . '/inc/classes/enums/class-api-key-status.php';
		require_once $root . '/inc/helpers/class-api-key.php';
		require_once $root . '/admin/godam-transcoder-functions.php';
	}

	/**
	 * Only warn and fail checks come back, and never the quota check.
	 */
	public function test_issues_skip_passing_and_quota_checks() {
		$this->set_cached_checks(
			array(
				$this->check( 'check_licence_valid', 'pass' ),
				$this->check( 'check_callback_transcoder', 'fail' ),
				$this->check( 'check_callback_video_sync', 'pass' ),
				$this->check( 'check_quota', 'warn' ),
				$this->check( 'check_future', 'warn' ),
			)
		);

		$this->assertSame(
			array( 'check_callback_transcoder', 'check_future' ),
			array_column( rtgodam_get_preflight_issues(), 'id' )
		);
	}

	/**
	 * A site whose key is not valid shows no preflight notices, even from old cached checks.
	 */
	public function test_issues_are_empty_without_a_valid_key() {
		$this->set_cached_checks( array( $this->check( 'check_callback_transcoder', 'fail' ) ), false );

		$this->assertSame( array(), rtgodam_get_preflight_issues() );
	}

	/**
	 * Central versions before preflight send no `preflight` key at all.
	 */
	public function test_issues_are_empty_when_central_sent_no_preflight() {
		$this->set_cached_checks( null );

		$this->assertSame( array(), rtgodam_get_preflight_issues() );
	}

	/**
	 * When the URL can't be reached, the skipped content-type and size checks are dropped.
	 */
	public function test_failure_message_keeps_only_reachability_when_unreachable() {
		$message = rtgodam_get_preflight_failure_message(
			array(
				$this->check( 'check_source_reachable', 'fail', 'Video URL returned HTTP 403.', 'Make it public.' ),
				$this->check( 'check_source_content_type', 'fail', 'Could not fetch response headers.', 'Fix the reachability error first.' ),
				$this->check( 'check_source_size', 'fail', 'Could not read Content-Length.', 'Fix the reachability error first.' ),
			)
		);

		$this->assertSame( 'Video URL returned HTTP 403. Make it public.', $message );
	}

	/**
	 * Independent failures each get their own line; passing checks are left out.
	 */
	public function test_failure_message_lists_each_failure() {
		$message = rtgodam_get_preflight_failure_message(
			array(
				$this->check( 'check_source_reachable', 'pass', 'Video URL returned HTTP 200.' ),
				$this->check( 'check_source_content_type', 'fail', "Expected a video Content-Type, got 'text/html'.", 'Use the direct file URL.' ),
				$this->check( 'check_source_size', 'fail', 'Content-Length is 0 or absent.' ),
			)
		);

		$this->assertSame(
			"Expected a video Content-Type, got 'text/html'. Use the direct file URL.\nContent-Length is 0 or absent.",
			$message
		);
	}

	/**
	 * A body without results gives no message, so the caller leaves the attachment alone.
	 */
	public function test_failure_message_is_empty_without_failures() {
		$this->assertSame( '', rtgodam_get_preflight_failure_message( null ) );
		$this->assertSame( '', rtgodam_get_preflight_failure_message( array( $this->check( 'check_source_size', 'pass' ) ) ) );
	}

	/**
	 * Build a check result in Central's shape.
	 *
	 * @param string $id          Check ID.
	 * @param string $status      pass, warn or fail.
	 * @param string $message     What was found.
	 * @param string $remediation What to do.
	 *
	 * @return array
	 */
	private function check( $id, $status, $message = 'Message.', $remediation = '' ) {
		return array(
			'id'          => $id,
			'label'       => $id,
			'status'      => $status,
			'message'     => $message,
			'remediation' => $remediation,
		);
	}

	/**
	 * Store fresh cached user data, as rtgodam_get_user_data() would after verifying.
	 *
	 * @param array|null $checks    The preflight checks, or null for a response without preflight.
	 * @param bool       $valid_key Whether the key verified.
	 */
	private function set_cached_checks( $checks, $valid_key = true ) {
		$user_data = array( 'active_plan' => 'Bronze' );

		if ( null !== $checks ) {
			$user_data['preflight'] = array( 'checks' => $checks );
		}

		$GLOBALS['rtgodam_stub']['options'] = array(
			'rtgodam-api-key'        => 'key',
			'rtgodam-api-key-status' => 'valid',
			'rtgodam_user_data'      => array(
				'valid_api_key'  => $valid_key,
				'api_key_status' => 'valid',
				'user_data'      => $user_data,
				'timestamp'      => time(),
			),
		);
	}
}
