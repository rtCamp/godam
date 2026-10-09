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
 * @covers ::rtgodam_get_job_refusal
 * @covers ::rtgodam_get_frappe_error_message
 * @covers ::rtgodam_record_job_refusal
 * @covers ::rtgodam_get_preflight_failure_detail
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

		$this->assertSame( 'GoDAM couldn\'t download this file from your site. Make sure uploaded videos are publicly accessible.', $message );
	}

	/**
	 * Known checks get plain wording, unknown ones fall back to Central's message, and passes are left out.
	 */
	public function test_failure_message_uses_plain_wording_and_falls_back() {
		$message = rtgodam_get_preflight_failure_message(
			array(
				$this->check( 'check_source_reachable', 'pass', 'Video URL returned HTTP 200.' ),
				$this->check( 'check_source_size', 'fail', 'Content-Length is 0 or absent.' ),
				$this->check( 'check_source_future', 'fail', 'Something new Central checks.' ),
			)
		);

		$this->assertSame(
			'The file is empty or larger than GoDAM accepts. Try uploading it again. Something new Central checks.',
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
	 * A 417 with failed checks is a source-file refusal, in plain wording.
	 */
	public function test_refusal_417_uses_the_checks() {
		$refusal = rtgodam_get_job_refusal(
			417,
			array(
				'message' => array(
					'has_failures' => true,
					'results'      => array( $this->check( 'check_source_size', 'fail', 'Content-Length is 0.' ) ),
				),
			)
		);

		$this->assertSame( 'preflight_failed', $refusal['code'] );
		$this->assertSame( 'The file is empty or larger than GoDAM accepts. Try uploading it again.', $refusal['message'] );
	}

	/**
	 * Licence and account refusals come in Frappe's error body and get plain wording.
	 *
	 * @dataProvider frappe_refusals
	 *
	 * @param int    $status   HTTP status.
	 * @param array  $body     Frappe error body.
	 * @param string $expected Message saved on the file.
	 */
	public function test_refusal_from_frappe_error_body( $status, $body, $expected ) {
		$refusal = rtgodam_get_job_refusal( $status, $body );

		$this->assertSame( 'job_refused', $refusal['code'] );
		$this->assertSame( $expected, $refusal['message'] );
	}

	/**
	 * Frappe error bodies Central sends when it refuses a job.
	 *
	 * @return array[]
	 */
	public function frappe_refusals() {
		return array(
			'licence inactive (403, _server_messages)' => array(
				403,
				array( '_server_messages' => wp_json_encode( array( wp_json_encode( array( 'message' => 'License Inactive' ) ) ) ) ),
				'Your GoDAM licence is inactive. Renew your plan to transcode new uploads.',
			),
			'unknown licence (404, exception only)'    => array(
				404,
				array( 'exception' => 'frappe.exceptions.DoesNotExistError: Invalid License' ),
				'GoDAM didn\'t recognise this site\'s API key. Check the key in GoDAM settings.',
			),
			'storage full (403)'                       => array(
				403,
				array( 'exception' => 'frappe.exceptions.PermissionError: Storage limit exceeded' ),
				'Your GoDAM storage is full. Upgrade your plan or delete unused files.',
			),
			'site not allowed (403)'                   => array(
				403,
				array( 'exception' => 'frappe.exceptions.PermissionError: Site Whitelisting is enabled and this site is not whitelisted. Contact your administrator to whitelist this site.' ),
				'This site isn\'t on your GoDAM account\'s list of allowed sites. Ask your GoDAM admin to add it.',
			),
			'unknown reason falls back to Central'     => array(
				417,
				array( 'exception' => 'frappe.exceptions.ValidationError: Title is too long' ),
				'Title is too long',
			),
			'no message at all'                        => array( 400, array(), 'GoDAM refused this file.' ),
		);
	}

	/**
	 * Central refuses every http:// source; the advice has to say HTTPS, and Central's own words are kept.
	 */
	public function test_refusal_http_source_says_https_and_keeps_centrals_words() {
		$refusal = rtgodam_get_job_refusal(
			417,
			array(
				'message' => array(
					'has_failures' => true,
					'results'      => array(
						$this->check( 'check_source_reachable', 'fail', "Could not reach video URL: Refusing to fetch source URL with disallowed scheme 'http'.", 'Your server may be offline.' ),
						$this->check( 'check_source_size', 'fail', 'Could not read Content-Length, skipped size check.' ),
					),
				),
			)
		);

		$this->assertSame( 'GoDAM only downloads files served over HTTPS. Serve your media over https:// to transcode this file.', $refusal['message'] );
		$this->assertSame( "Could not reach video URL: Refusing to fetch source URL with disallowed scheme 'http'.", $refusal['detail'] );
	}

	/**
	 * A licence refusal keeps Central's wording as the detail.
	 */
	public function test_refusal_keeps_centrals_wording_as_detail() {
		$refusal = rtgodam_get_job_refusal( 403, array( 'exception' => 'frappe.exceptions.PermissionError: License Inactive' ) );

		$this->assertSame( 'License Inactive', $refusal['detail'] );
	}

	/**
	 * Timeouts and rate limits are transient, so they are not recorded as refusals.
	 *
	 * @dataProvider transient_codes
	 *
	 * @param int $status HTTP status.
	 */
	public function test_transient_4xx_is_not_a_refusal( $status ) {
		$this->assertSame( '', rtgodam_get_job_refusal( $status, array( 'exception' => 'Slow down' ) )['code'] );
	}

	/**
	 * Transient 4xx codes.
	 *
	 * @return array[]
	 */
	public function transient_codes() {
		return array(
			'timeout'    => array( 408 ),
			'rate limit' => array( 429 ),
		);
	}

	/**
	 * Success and server errors are not refusals: they keep their existing handling.
	 */
	public function test_non_4xx_is_not_a_refusal() {
		$this->assertSame( '', rtgodam_get_job_refusal( 200, array() )['code'] );
		$this->assertSame( '', rtgodam_get_job_refusal( 503, array( 'exception' => 'Boom' ) )['code'] );
	}

	/**
	 * A refusal marks the file failed and drops it from the retry queue, in either queue shape.
	 */
	public function test_record_refusal_marks_failed_and_clears_both_queue_shapes() {
		$this->stub_meta_and_option_writes();

		$GLOBALS['rtgodam_stub']['options']['rtgodam-failed-transcoding-attachments'] = array(
			42 => array( 'attachment_id' => 42 ),
			0  => array( 'attachment_id' => 42 ),
			7  => array( 'attachment_id' => 7 ),
		);

		$recorded = rtgodam_record_job_refusal(
			42,
			array(
				'code' => 403,
				'body' => wp_json_encode( array( 'exception' => 'frappe.exceptions.PermissionError: License Inactive' ) ),
			)
		);

		$this->assertTrue( $recorded );
		$this->assertSame( 'failed', $GLOBALS['rtgodam_meta'][42]['rtgodam_transcoding_status'] );
		$this->assertSame( 'job_refused', $GLOBALS['rtgodam_meta'][42]['rtgodam_transcoding_error_code'] );
		$this->assertSame( 'License Inactive', $GLOBALS['rtgodam_meta'][42]['rtgodam_transcoding_error_detail'] );
		$this->assertSame(
			array( 7 => array( 'attachment_id' => 7 ) ),
			$GLOBALS['rtgodam_stub']['options']['rtgodam-failed-transcoding-attachments']
		);
	}

	/**
	 * A server error is left to the existing retry handling.
	 */
	public function test_record_refusal_ignores_server_errors() {
		$this->stub_meta_and_option_writes();

		$this->assertFalse(
			rtgodam_record_job_refusal(
				42,
				array(
					'code' => 503,
					'body' => '',
				) 
			) 
		);
		$this->assertArrayNotHasKey( 42, $GLOBALS['rtgodam_meta'] );
	}

	/**
	 * Record meta and option writes in globals (this class runs in separate processes).
	 */
	private function stub_meta_and_option_writes() {
		$GLOBALS['rtgodam_meta'] = array();

		if ( ! function_exists( 'update_post_meta' ) ) {
			eval( 'function update_post_meta( $id, $key, $value ) { $GLOBALS["rtgodam_meta"][ $id ][ $key ] = $value; return true; }' ); // phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
		}

		if ( ! function_exists( 'update_option' ) ) {
			eval( 'function update_option( $key, $value ) { $GLOBALS["rtgodam_stub"]["options"][ $key ] = $value; return true; }' ); // phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
		}
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
