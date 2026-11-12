<?php
/**
 * Why a transcode failed or seems stuck, and what to do next, as the media library shows it.
 *
 * @see https://github.com/rtCamp/godam-plugin-wp/issues/109
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

require_once dirname( __DIR__ ) . '/stubs/media-visibility-functions.php';

/**
 * @covers ::rtgodam_get_transcoding_failure
 * @covers ::rtgodam_describe_failed_transcode
 * @covers ::rtgodam_describe_stalled_transcode
 * @covers ::rtgodam_get_transcoding_failure_for_display
 * @covers ::rtgodam_get_transcoding_next_step
 * @covers ::rtgodam_is_in_retry_queue
 */
class TranscodingFailureTest extends TestCase {

	const ID = 42;

	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_stub'] = array(
			'posts'   => array(),
			'caps'    => array( 'edit_post:' . self::ID ),
			'options' => array(),
		);
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Give the attachment its transcoding meta.
	 *
	 * @param array $meta Meta.
	 */
	private function meta( array $meta ) {
		$GLOBALS['rtgodam_stub']['post_meta_by_id'][ self::ID ] = $meta;
	}

	/**
	 * A failed attachment with this error code and reason.
	 *
	 * @param string $code   Error code.
	 * @param array  $extra  More meta.
	 */
	private function failed( $code = '', array $extra = array() ) {
		$this->meta(
			array_merge(
				array(
					'rtgodam_transcoding_status'     => 'failed',
					'rtgodam_transcoding_error_code' => $code,
					'rtgodam_transcoding_error_msg'  => 'Watchdog: max retries exceeded',
				),
				$extra
			)
		);
	}

	public function test_a_file_that_is_neither_failed_nor_stuck_has_no_failure() {
		$this->meta( array( 'rtgodam_transcoding_status' => 'Transcoded' ) );

		$this->assertNull( rtgodam_get_transcoding_failure( self::ID ) );
		$this->assertSame( array(), rtgodam_get_transcoding_failure_for_display( self::ID ) );
	}

	/**
	 * @return array
	 */
	public function central_reasons() {
		return array(
			'oom'           => array( 'oom', 'oom', 'upload_smaller', 'The file needed more memory' ),
			'timeout'       => array( 'timeout', 'timeout', 'retry', 'Processing took too long' ),
			'download'      => array( 'download', 'download', 'retry', 'We couldn\'t download' ),
			'transcode'     => array( 'transcode', 'transcode', 'upload_different', 'We couldn\'t process the file' ),
			'upload'        => array( 'upload', 'upload', 'retry', 'We couldn\'t save' ),
			'license'       => array( 'license', 'license', 'settings', 'The license is invalid' ),
			'storage_limit' => array( 'storage_limit', 'storage_limit', 'upgrade', 'Your plan\'s storage limit' ),
			'unknown'       => array( 'unknown', 'unknown', 'retry_support', 'Something went wrong' ),
			'missing'       => array( '', 'unknown', 'retry_support', 'Something went wrong' ),
			'unrecognised'  => array( 'cosmic_rays', 'unknown', 'retry_support', 'Something went wrong' ),
		);
	}

	/**
	 * @dataProvider central_reasons
	 *
	 * @param string $reason  What Central sent.
	 * @param string $code    Expected code.
	 * @param string $action  Expected next step.
	 * @param string $message Start of the expected sentence.
	 */
	public function test_central_reason_maps_to_its_sentence_and_next_step( $reason, $code, $action, $message ) {
		$this->failed( 'transcoder_error', array( 'rtgodam_transcoding_failure_reason' => $reason ) );

		$failure = rtgodam_get_transcoding_failure( self::ID );

		$this->assertSame( 'failed', $failure['kind'] );
		$this->assertSame( $code, $failure['code'] );
		$this->assertSame( $action, $failure['action'] );
		$this->assertStringStartsWith( $message, $failure['message'] );
		$this->assertStringNotContainsString( 'Watchdog', $failure['message'] );
	}

	public function test_only_unknown_failures_point_to_support() {
		$this->failed( '', array( 'rtgodam_transcoding_failure_reason' => 'unknown' ) );
		$this->assertSame( 'https://app.godam.io/helpdesk/my-tickets', rtgodam_get_transcoding_failure_for_display( self::ID )['support_url'] );

		$this->failed( '', array( 'rtgodam_transcoding_failure_reason' => 'oom' ) );
		$display = rtgodam_get_transcoding_failure_for_display( self::ID );
		$this->assertSame( '', $display['support_url'] );
		$this->assertSame( 'Upload a smaller file.', $display['next_step'] );
	}

	public function test_a_file_waiting_for_an_automatic_retry_says_so() {
		$this->failed( RTGODAM_RETRY_QUEUED_CODE );

		$failure = rtgodam_get_transcoding_failure( self::ID );

		$this->assertSame( 'retrying', $failure['kind'] );
		$this->assertSame( 'Couldn\'t reach GoDAM. Retrying automatically.', $failure['message'] );
		$this->assertSame( '', $failure['action'] );
	}

	public function test_a_file_queued_before_the_code_existed_still_reads_as_retrying() {
		$this->failed();
		$GLOBALS['rtgodam_stub']['options']['rtgodam-failed-transcoding-attachments'] = array(
			0 => array( 'attachment_id' => self::ID ),
		);

		$this->assertSame( 'retrying', rtgodam_get_transcoding_failure( self::ID )['kind'] );
	}

	public function test_used_up_retries_offer_retry_and_support() {
		$this->failed( RTGODAM_RETRIES_EXHAUSTED_CODE );

		$failure = rtgodam_get_transcoding_failure_for_display( self::ID );

		$this->assertSame( 'Failed after 3 retries.', $failure['message'] );
		$this->assertSame( 'retry', $failure['action'] );
		$this->assertNotSame( '', $failure['support_url'] );
	}

	public function test_a_refusal_keeps_its_reason_for_an_editor_only() {
		$this->failed(
			'job_refused',
			array(
				'rtgodam_transcoding_error_msg'    => 'Your GoDAM storage is full.',
				'rtgodam_transcoding_error_detail' => 'Storage limit exceeded',
			)
		);

		$failure = rtgodam_get_transcoding_failure_for_display( self::ID );
		$this->assertSame( 'refusal', $failure['kind'] );
		$this->assertSame( 'Your GoDAM storage is full.', $failure['message'] );
		$this->assertSame( 'upgrade', $failure['action'] );
		$this->assertStringContainsString( 'app.godam.io/web/billing', $failure['next_step_url'] );

		$GLOBALS['rtgodam_stub']['caps'] = array();
		$this->assertSame( 'This file can\'t be transcoded.', rtgodam_get_transcoding_failure_for_display( self::ID )['message'] );
	}

	/**
	 * A job Central accepted, last heard from this long ago.
	 *
	 * @param int   $seconds_ago When Central last said something; 0 for never recorded.
	 * @param array $extra       More meta.
	 */
	private function in_flight( $seconds_ago, array $extra = array() ) {
		$this->meta(
			array_merge(
				array(
					'rtgodam_transcoding_status'         => 'Transcoding',
					'rtgodam_transcoding_job_id'         => 'job-42',
					'rtgodam_transcoding_status_updated' => $seconds_ago ? time() - $seconds_ago : '',
				),
				$extra
			)
		);
	}

	public function test_a_job_with_no_word_for_a_day_is_stuck() {
		$this->in_flight( DAY_IN_SECONDS + 60 );

		$failure = rtgodam_get_transcoding_failure_for_display( self::ID );

		$this->assertSame( 'stalled', $failure['kind'] );
		$this->assertSame( 'This is taking longer than expected.', $failure['message'] );
		$this->assertNotSame( '', $failure['support_url'] );
	}

	public function test_a_recent_job_is_not_stuck() {
		$this->in_flight( HOUR_IN_SECONDS );

		$this->assertNull( rtgodam_get_transcoding_failure( self::ID ) );
	}

	public function test_a_transcoded_file_is_never_stuck() {
		$this->in_flight( 3 * DAY_IN_SECONDS, array( 'rtgodam_transcoded_url' => 'https://cdn.example/42.mpd' ) );

		$this->assertNull( rtgodam_get_transcoding_failure( self::ID ) );
	}

	public function test_an_old_job_with_no_recorded_time_falls_back_to_the_upload_date() {
		$this->in_flight( 0 );
		$GLOBALS['rtgodam_stub']['posts'][ self::ID ] = (object) array(
			'ID'            => self::ID,
			'post_date_gmt' => gmdate( 'Y-m-d H:i:s', time() - 3 * DAY_IN_SECONDS ),
		);

		$this->assertSame( 'stalled', rtgodam_get_transcoding_failure( self::ID )['kind'] );
	}

	public function test_an_old_job_with_no_time_at_all_is_left_alone() {
		$this->in_flight( 0 );

		$this->assertNull( rtgodam_get_transcoding_failure( self::ID ) );
	}
}
