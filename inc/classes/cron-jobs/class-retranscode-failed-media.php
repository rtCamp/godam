<?php
/**
 * Class to handle re-transcoding of media files that encountered transcoding errors.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Cron_Jobs;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Retranscode_Failed_Media
 *
 * This class is responsible for managing the re-transcoding of media files that failed during the initial transcoding process.
 * It sets up a cron job to periodically check for failed media and attempts to re-transcode them.
 */
class Retranscode_Failed_Media {
	use Singleton;

	/**
	 * Construct method.
	 */
	final protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks and initialization.
	 */
	protected function setup_hooks() {
		add_action( 'cron_schedules', array( $this, 'add_re_transcoding_schedule' ) );
		add_action( 'wp', array( $this, 'schedule_event' ) );
		add_action( 'retranscode_failed_media_event', array( $this, 'retranscode_failed_media' ) );
		add_action( 'admin_notices', array( $this, 'failed_transcoding_notice' ) );
	}

	/**
	 * Add a custom cron schedule for retranscoding failed media.
	 *
	 * This function adds a new cron schedule that runs every 10 minutes,
	 * allowing the system to periodically check for media that needs to be re-transcoded.
	 *
	 * @param array $schedules Existing cron schedules.
	 * @return array Modified cron schedules with the new 'retranscode_failed_media' schedule added.
	 */
	public function add_re_transcoding_schedule( $schedules ) {
		if ( ! isset( $schedules['retranscode_failed_media'] ) ) {
			$schedules['retranscode_failed_media'] = array(
				'interval' => 10 * MINUTE_IN_SECONDS,
				'display'  => __( 'Retranscode Failed Media', 'godam' ),
			);
		}
		return $schedules;
	}

	/**
	 * Schedule the retranscoding event if not already scheduled.
	 *
	 * This function checks if the retranscoding event is already scheduled,
	 * and if not, schedules it to run at the specified interval.
	 */
	public function schedule_event() {
		if ( ! wp_next_scheduled( 'retranscode_failed_media_event' ) ) {
			wp_schedule_event( time(), 'retranscode_failed_media', 'retranscode_failed_media_event' );
		}
	}

	/**
	 * Retranscode media that failed during the initial transcoding process.
	 *
	 * This function retrieves a list of attachments that failed transcoding,
	 * and attempts to re-transcode them using the RTGODAM_Transcoder_Handler class.
	 */
	public function retranscode_failed_media() {

		$failed_transcoding_attachments = get_option( 'rtgodam-failed-transcoding-attachments', array() );

		foreach ( $failed_transcoding_attachments as $attachment ) {
			$attachment_id = $attachment['attachment_id'] ?? 0;
			if ( ! $attachment_id ) {
				continue; // Skip if no attachment ID is set.
			}

			if ( ! class_exists( 'RTGODAM_Transcoder_Handler' ) ) {
				include_once RTGODAM_PATH . 'admin/class-rtgodam-transcoder-handler.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant 
			}

			$transcoder_handler = new \RTGODAM_Transcoder_Handler();

			$transcoder_handler->wp_media_transcoding( $attachment['wp_metadata'], $attachment['attachment_id'], $attachment['autoformat'], true );
		}
	}

	/**
	 * Display a notice when transcoding fails.
	 */
	public function failed_transcoding_notice() {

		$failed_notice_timestamp = get_option( 'rtgodam-transcoding-failed-notice-timestamp', 0 );
		$failed_notice_timestamp = intval( $failed_notice_timestamp );

		if ( ! $failed_notice_timestamp || ( time() - $failed_notice_timestamp ) >= 60 ) { // 5 minutes
			return;
		}
		?>
		<div class="notice notice-warning is-dismissible">
			<p>
				<?php esc_html_e( 'There was an issue transcoding the video on the GoDAM server. Don\'t worry — the attachment details have been saved and transcoding will retry automatically once the issue is resolved.', 'godam' ); ?>
			</p>
		</div>
		<?php
	}
}

