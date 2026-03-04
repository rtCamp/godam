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
	 * Maximum number of retry attempts for failed transcoding.
	 *
	 * @var int
	 */
	const MAX_RETRY_ATTEMPTS = 3;

	/**
	 * Retranscode media that failed during the initial transcoding process.
	 *
	 * Retries are only triggered when GoDAM Central returned a 5xx error during job submission.
	 * Each attachment is retried at most MAX_RETRY_ATTEMPTS times. After that the attachment is
	 * marked as permanently failed and removed from the retry queue.
	 *
	 * IMPORTANT: Every mutation of the option is persisted immediately inside the loop so that
	 * a successful job dispatch (which removes the entry inside wp_media_transcoding) is never
	 * accidentally re-added by a blanket save after the loop finishes.
	 */
	public function retranscode_failed_media() {

		$failed_transcoding_attachments = get_option( 'rtgodam-failed-transcoding-attachments', array() );

		if ( empty( $failed_transcoding_attachments ) ) {
			return;
		}

		if ( ! class_exists( 'RTGODAM_Transcoder_Handler' ) ) {
			include_once RTGODAM_PATH . 'admin/class-rtgodam-transcoder-handler.php'; // phpcs:ignore WordPressVIPMinimum.Files.IncludingFile.UsingCustomConstant
		}

		foreach ( $failed_transcoding_attachments as $attachment_id => $attachment ) {
			$real_attachment_id = $attachment['attachment_id'] ?? 0;
			if ( ! $real_attachment_id ) {
				// Remove stale entry and persist immediately.
				unset( $failed_transcoding_attachments[ $attachment_id ] );
				update_option( 'rtgodam-failed-transcoding-attachments', $failed_transcoding_attachments );
				continue;
			}

			$retry_count = isset( $attachment['retry_count'] ) ? (int) $attachment['retry_count'] : 0;

			// If we have exhausted all retry attempts, mark the attachment as permanently
			// failed and remove it from the retry queue — persist immediately.
			if ( $retry_count >= self::MAX_RETRY_ATTEMPTS ) {
				update_post_meta( $real_attachment_id, 'rtgodam_transcoding_status', 'failed' );
				update_post_meta(
					$real_attachment_id,
					'rtgodam_transcoding_error_msg',
					// translators: %d is the maximum number of retry attempts.
					sprintf( __( 'Transcoding failed after %d retry attempts. GoDAM Central returned a server error on each attempt.', 'godam' ), self::MAX_RETRY_ATTEMPTS )
				);
				unset( $failed_transcoding_attachments[ $attachment_id ] );
				update_option( 'rtgodam-failed-transcoding-attachments', $failed_transcoding_attachments );
				continue;
			}

			// Increment the retry count and persist BEFORE calling wp_media_transcoding.
			// This ensures the incremented count survives even if wp_media_transcoding
			// re-adds the entry (on another 5xx). The handler reads `existing_retry_count`
			// from the DB, so it will pick up the incremented value.
			$failed_transcoding_attachments[ $attachment_id ]['retry_count'] = $retry_count + 1;
			update_option( 'rtgodam-failed-transcoding-attachments', $failed_transcoding_attachments );

			$transcoder_handler = new \RTGODAM_Transcoder_Handler();
			$transcoder_handler->wp_media_transcoding( $attachment['wp_metadata'], $real_attachment_id, $attachment['autoformat'], true );
			// NOTE: No final update_option here — wp_media_transcoding persists its own
			// changes (success → removes entry, failure → updates entry) independently.
		}
	}

	/**
	 * Display a notice when transcoding fails.
	 *
	 * The notice is shown for up to 5 minutes after the last failure.
	 */
	public function failed_transcoding_notice() {

		$failed_notice_timestamp = get_option( 'rtgodam-transcoding-failed-notice-timestamp', 0 );
		$failed_notice_timestamp = intval( $failed_notice_timestamp );

		if ( ! $failed_notice_timestamp || ( time() - $failed_notice_timestamp ) >= 5 * MINUTE_IN_SECONDS ) {
			return;
		}

		$failed_attachments = get_option( 'rtgodam-failed-transcoding-attachments', array() );
		$failed_count       = count( $failed_attachments );
		$media_library_url  = admin_url( 'upload.php' );

		?>
		<div class="notice notice-warning is-dismissible">
			<p>
				<strong><?php esc_html_e( 'GoDAM: Transcoding server error', 'godam' ); ?></strong>
			</p>
			<p>
				<?php
				$media_library_link = '<a href="' . esc_url( $media_library_url ) . '">' . esc_html__( 'Media Library', 'godam' ) . '</a>';

				if ( $failed_count > 0 ) {
					$message = sprintf(
						/* translators: 1: number of media items queued, 2: retry interval in minutes, 3: max retries, 4: Media Library link */
						__( '%1$d media file(s) could not be sent to the GoDAM transcoding server and have been queued for automatic retry (every %2$d minutes, up to %3$d attempts). Visit the %4$s to see their status.', 'godam' ),
						(int) $failed_count,
						10,
						(int) self::MAX_RETRY_ATTEMPTS,
						$media_library_link
					);
				} else {
					$message = sprintf(
						/* translators: 1: Media Library link */
						__( 'There was an issue sending a media file to the GoDAM transcoding server. The file has been queued for automatic retry. Visit the %1$s to see its status.', 'godam' ),
						$media_library_link
					);
				}

				echo wp_kses(
					$message,
					array(
						'a' => array(
							'href'   => array(),
							'target' => array(),
						),
					)
				);
				?>
			</p>
		</div>
		<?php
	}
}

