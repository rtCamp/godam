<?php
/**
 * Background cron job that processes the retranscoding queue.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Cron_Jobs;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Retranscode_Queue_Processor
 *
 * This class sets up a recurring WP-Cron task (`godam_process_retranscode_queue`) that
 * picks IDs out of the `rtgodam_retranscode_queue` option, attempts to send them for
 * transcoding and keeps track of progress in the `rtgodam_retranscode_progress` option.
 *
 * The JavaScript UI polls the progress option through dedicated REST endpoints so the
 * user can safely navigate away from the page. The queue will continue processing in
 * the background as long as WP-Cron can run.
 */
class Retranscode_Queue_Processor {

	use Singleton;

	/**
	 * Constructor.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Register hooks.
	 */
	protected function setup_hooks() {
		add_action( 'cron_schedules', array( $this, 'add_schedule' ) );
		add_action( 'wp', array( $this, 'schedule_event' ) );
		add_action( 'godam_process_retranscode_queue', array( $this, 'process_queue' ) );
	}

	/**
	 * Add a 30-second interval for faster queue processing.
	 *
	 * @param array $schedules Existing cron schedules.
	 * @return array           Modified schedules.
	 */
	public function add_schedule( $schedules ) {
		if ( ! isset( $schedules['godam_retranscode_queue'] ) ) {
			$schedules['godam_retranscode_queue'] = array(
				'interval' => 30,
				'display'  => __( 'GoDAM retranscode queue', 'godam' ),
			);
		}
		return $schedules;
	}

	/**
	 * Ensure the queue processor event is scheduled.
	 */
	public function schedule_event() {
		if ( ! wp_next_scheduled( 'godam_process_retranscode_queue' ) ) {
			wp_schedule_event( time(), 'godam_retranscode_queue', 'godam_process_retranscode_queue' );
		}
	}

	/**
	 * Process (a small batch of) the queue each run.
	 */
	public function process_queue() {

		$queue    = get_option( 'rtgodam_retranscode_queue', array() );
		$progress = get_option( 'rtgodam_retranscode_progress', array() );

		if ( empty( $queue ) || ( isset( $progress['status'] ) && 'aborted' === $progress['status'] ) ) {
			return; // Nothing to do.
		}

		// Guarantee a sane progress structure.
		$progress = wp_parse_args(
			$progress,
			array(
				'total'     => count( $queue ),
				'processed' => 0,
				'success'   => 0,
				'failure'   => 0,
				'logs'      => array(),
				'status'    => 'running',
			)
		);

		// Work on max 3 items per invocation to keep the task lightweight.
		$batch = array_splice( $queue, 0, 3 );

		foreach ( $batch as $attachment_id ) {

			$title     = get_the_title( $attachment_id );
			$mime_type = get_post_mime_type( $attachment_id );
			$wp_meta   = array( 'mime_type' => $mime_type );

			// Remove any previous job id so the handler creates a fresh one.
			delete_post_meta( $attachment_id, 'rtgodam_transcoding_job_id' );

			// Lazily include the transcoder handler if not loaded yet.
			if ( ! class_exists( 'RTGODAM_Transcoder_Handler' ) ) {
				include_once RTGODAM_PATH . 'admin/class-rtgodam-transcoder-handler.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
			}

			$handler = new \RTGODAM_Transcoder_Handler( true );
			$handler->wp_media_transcoding( $wp_meta, $attachment_id );

			$is_sent = get_post_meta( $attachment_id, 'rtgodam_transcoding_job_id', true );
			$message = '';

			if ( $is_sent ) {
				++$progress['success'];
				$message = sprintf(
					/* translators: 1: Attachment title, 2: Attachment ID. */
					__( '%1$s (ID %2$d) transcoding request was sent successfully.', 'godam' ),
					esc_html( $title ),
					absint( $attachment_id )
				);
			} else {
				++$progress['failure'];
				$message = sprintf(
					/* translators: 1: Attachment title, 2: Attachment ID. */
					__( '%1$s (ID %2$d) transcoding request failed.', 'godam' ),
					esc_html( $title ),
					absint( $attachment_id )
				);
			}

			$progress['logs'][] = $message;
			++$progress['processed'];
		}

		// If queue emptied, mark as finished.
		if ( empty( $queue ) ) {
			$progress['status'] = 'done';
		}

		update_option( 'rtgodam_retranscode_queue', $queue );
		update_option( 'rtgodam_retranscode_progress', $progress );
	}
} 
