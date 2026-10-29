<?php
/**
 * The cron that retries jobs GoDAM Central couldn't accept (server errors, timeouts,
 * rate limits), with legacy (numerically keyed) and current queue entries.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Cron_Jobs\Retranscode_Failed_Media;

/**
 * Runs in separate processes: each test defines its own stand-in for
 * RTGODAM_Transcoder_Handler and stubs the meta/option writes.
 *
 * @covers \RTGODAM\Inc\Cron_Jobs\Retranscode_Failed_Media::retranscode_failed_media
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class RetryQueueTest extends TestCase {

	const QUEUE = 'rtgodam-failed-transcoding-attachments';

	/**
	 * Stub the writes and load the cron class.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub']   = array( 'options' => array() );
		$GLOBALS['rtgodam_meta']   = array();
		$GLOBALS['rtgodam_jobs']   = array();
		$GLOBALS['rtgodam_result'] = array();

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		eval( 'function update_post_meta( $id, $key, $value ) { $GLOBALS["rtgodam_meta"][ $id ][ $key ] = $value; return true; }' );
		eval( 'function delete_post_meta( $id, $key ) { unset( $GLOBALS["rtgodam_meta"][ $id ][ $key ] ); return true; }' );
		eval( 'function update_option( $key, $value ) { $GLOBALS["rtgodam_stub"]["options"][ $key ] = $value; return true; }' );

		// Stands in for wp_media_transcoding(): accepted jobs leave the queue, transient
		// failures are re-queued under the attachment ID with the stored retry count.
		eval(
			'class RTGODAM_Transcoder_Handler {
				public function wp_media_transcoding( $metadata, $attachment_id ) {
					$GLOBALS["rtgodam_jobs"][] = $attachment_id;
					if ( "accepted" === ( $GLOBALS["rtgodam_result"][ $attachment_id ] ?? "accepted" ) ) {
						rtgodam_remove_from_retry_queue( $attachment_id );
						return;
					}
					$queue = get_option( "' . self::QUEUE . '", array() );
					$queue[ $attachment_id ] = array(
						"attachment_id" => $attachment_id,
						"retry_count"   => (int) ( $queue[ $attachment_id ]["retry_count"] ?? 0 ),
					);
					update_option( "' . self::QUEUE . '", $queue );
				}
			}'
		);
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		require_once dirname( __DIR__, 2 ) . '/inc/classes/cron-jobs/class-retranscode-failed-media.php';
	}

	/**
	 * Run the cron once.
	 *
	 * @param array $queue Queue before the run.
	 *
	 * @return array Queue after the run.
	 */
	private function run_cron( array $queue ) {
		// Every entry also carries what wp_media_transcoding() needs.
		foreach ( $queue as $key => $entry ) {
			$queue[ $key ] += array(
				'wp_metadata' => array(),
				'autoformat'  => true,
			);
		}

		$GLOBALS['rtgodam_stub']['options'][ self::QUEUE ] = $queue;

		Retranscode_Failed_Media::get_instance()->retranscode_failed_media();

		return $GLOBALS['rtgodam_stub']['options'][ self::QUEUE ];
	}

	/**
	 * A legacy entry and a current entry for the same file retry it once, and an accepted
	 * job leaves no entry behind.
	 */
	public function test_duplicate_entries_retry_the_file_once() {
		$queue = $this->run_cron(
			array(
				0  => array(
					'attachment_id' => 42,
					'retry_count'   => 0,
				),
				42 => array(
					'attachment_id' => 42,
					'retry_count'   => 1,
				),
			)
		);

		$this->assertSame( array( 42 ), $GLOBALS['rtgodam_jobs'] );
		$this->assertSame( array(), $queue );
	}

	/**
	 * Another transient failure leaves one entry, under the attachment ID, with the
	 * higher of the two counts incremented.
	 */
	public function test_legacy_entry_moves_to_the_attachment_id() {
		$GLOBALS['rtgodam_result'][42] = 'transient';

		$queue = $this->run_cron(
			array(
				0  => array(
					'attachment_id' => 42,
					'retry_count'   => 0,
				),
				42 => array(
					'attachment_id' => 42,
					'retry_count'   => 1,
				),
			)
		);

		$this->assertSame( array( 42 ), $GLOBALS['rtgodam_jobs'] );
		$this->assertSame( array( 42 ), array_keys( $queue ) );
		$this->assertSame( 2, $queue[42]['retry_count'] );
	}

	/**
	 * Running out of retries marks the file failed with wording that fits any transient
	 * cause, and clears every entry for it.
	 */
	public function test_exhausted_retries_clear_every_entry() {
		$queue = $this->run_cron(
			array(
				0  => array(
					'attachment_id' => 42,
					'retry_count'   => Retranscode_Failed_Media::MAX_RETRY_ATTEMPTS,
				),
				42 => array(
					'attachment_id' => 42,
					'retry_count'   => 0,
				),
				7  => array(
					'attachment_id' => 7,
					'retry_count'   => Retranscode_Failed_Media::MAX_RETRY_ATTEMPTS,
				),
			)
		);

		$this->assertSame( array(), $GLOBALS['rtgodam_jobs'] );
		$this->assertSame( array(), $queue );
		$this->assertSame( 'failed', $GLOBALS['rtgodam_meta'][42]['rtgodam_transcoding_status'] );
		$this->assertStringNotContainsString( 'server error', $GLOBALS['rtgodam_meta'][42]['rtgodam_transcoding_error_msg'] );
	}

	/**
	 * A legacy index that equals another file's ID doesn't overwrite that file's entry:
	 * both files are retried and both stay queued after another transient failure.
	 */
	public function test_legacy_index_does_not_overwrite_another_file() {
		$GLOBALS['rtgodam_result'][42] = 'transient';
		$GLOBALS['rtgodam_result'][9]  = 'transient';

		$queue = $this->run_cron(
			array(
				0  => array(
					'attachment_id' => 42,
					'retry_count'   => 0,
				),
				42 => array(
					'attachment_id' => 9,
					'retry_count'   => 1,
				),
			)
		);

		$this->assertSame( array( 42, 9 ), $GLOBALS['rtgodam_jobs'] );
		$keys = array_keys( $queue );
		sort( $keys );
		$this->assertSame( array( 9, 42 ), $keys );
		$this->assertSame( 1, $queue[42]['retry_count'] );
		$this->assertSame( 2, $queue[9]['retry_count'] );
	}

	/**
	 * Other files in the queue are still retried.
	 */
	public function test_other_files_are_still_retried() {
		$GLOBALS['rtgodam_result'][9] = 'transient';

		$queue = $this->run_cron(
			array(
				0 => array(
					'attachment_id' => 42,
					'retry_count'   => 0,
				),
				9 => array(
					'attachment_id' => 9,
					'retry_count'   => 0,
				),
			)
		);

		$this->assertSame( array( 42, 9 ), $GLOBALS['rtgodam_jobs'] );
		$this->assertSame( array( 9 ), array_keys( $queue ) );
		$this->assertSame( 1, $queue[9]['retry_count'] );
	}
}
