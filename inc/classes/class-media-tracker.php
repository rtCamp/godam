<?php
/**
 * Check if Media Transcoding is functional.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * GoDAM Media_Tracker class.
 *
 * This class is responsible for tracking the transcoding status of media attachments.
 */
class Media_Tracker {
	use Singleton;

	/**
	 * Constructor.
	 */
	public function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	public function setup_hooks() {
		add_action( 'add_attachment', array( $this, 'track_new_attachment' ) );
		add_action( 'init', array( $this, 'check_new_attachment_transcoding_status' ), 100 );
		add_action( 'delete_attachment', array( $this, 'delete_attachment' ) );
		add_action( 'admin_notices', array( $this, 'check_transcoder_plugin' ) );
	}

	/**
	 * Track new attachment.
	 *
	 * @param int $attachment_id Attachment ID.
	 */
	public function track_new_attachment( $attachment_id ) {
		$attachment_data = array(
			'attachment_id'      => $attachment_id,
			'transcoding_status' => '',
		);

		// Check if the attachment is a video.
		update_option( 'rtgodam_new_attachment', $attachment_data, '', true );

		// Trigger cache invalidation for attachment counts in folders.
		do_action( 'godam_attachment_added', $attachment_id );
	}

	/**
	 * Delete new attachment option.
	 *
	 * @param int $attachment_id Attachment ID.
	 */
	public function delete_attachment( $attachment_id ) {
		// Check if the attachment is a video.
		$attachment_data = get_option( 'rtgodam_new_attachment' );

		if ( ! empty( $attachment_data ) && $attachment_data['attachment_id'] === $attachment_id ) {
			delete_option( 'rtgodam_new_attachment' );
		}

		// Trigger cache invalidation for attachment counts in folders when deleted.
		do_action( 'godam_attachment_deleted', $attachment_id );
	}

	/**
	 * Check new attachment transcoding status.
	 *
	 * @return void
	 */
	public function check_new_attachment_transcoding_status() {
		$attachment_data = get_option( 'rtgodam_new_attachment' );

		if ( ! empty( $attachment_data ) ) {
			$attachment_id = $attachment_data['attachment_id'];

			if ( in_array( $attachment_data['transcoding_status'], array( 'success', 'failed', 'error' ), true ) ) {
				return;
			}

			if ( 'not_found' === $attachment_data['transcoding_status'] ) {
				$this->display_cdn_admin_notice();
				return;
			}

			$transcoding_status = $this->get_transcoding_status( $attachment_id );

			if ( 'not_found' === $transcoding_status ) {
				// Display admin notice.
				$this->display_cdn_admin_notice();
			}

			$attachment_data['transcoding_status'] = $transcoding_status;
			update_option( 'rtgodam_new_attachment', $attachment_data, '', true );
		}
	}

	/**
	 * Get transcoding status of attachment.
	 *
	 * @param int $attachment_id Attachment ID.
	 * @return string Transcoding status.
	 */
	public function get_transcoding_status( $attachment_id ) {

		$ids = array( $attachment_id );

		$url = 'godam/v1/transcoding/transcoding-status';

		$request = new \WP_REST_Request( 'GET', $url );
		$request->set_query_params( array( 'ids' => $ids ) );

		$response = rest_do_request( $request );

		if ( $response->is_error() ) {
			return 'error';
		}

		$data = $response->get_data();

		if ( ! empty( $data[ $attachment_id ]['status'] ) ) {
			$status = $data[ $attachment_id ]['status'];
			if ( 'failed' === $status && isset( $data[ $attachment_id ]['error_code'] ) && '404' === $data[ $attachment_id ]['error_code'] ) {
				return 'not_found';
			}
			return $status;
		}

		return '';
	}

	/**
	 * Display admin notice.
	 *
	 * @return void
	 */
	public function display_cdn_admin_notice() {
		add_action(
			'admin_notices',
			function () {
				$screen = get_current_screen();
				if ( ! in_array( $screen->id, array( 'dashboard', 'upload', 'plugins' ), true ) ) {
					return;
				}
				?>
				<div class="notice notice-error">
					<div style="display: flex; align-items: center; gap: 12px;">
						<div style="color: oklch(68.1% 0.162 75.834);">
							<svg xmlns="http://www.w3.org/2000/svg" style="width: 32px; height: 32px;" width="16" height="16" fill="currentColor" class="bi bi-exclamation-triangle-fill" viewBox="0 0 16 16">
								<path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/>
							</svg>
						</div>
						<div>
							<p><strong><?php esc_html_e( 'GoDAM Notice: CDN Conflict Detected!', 'godam' ); ?></strong></p>
							<p style="font-weight: 500;"><?php echo esc_html__( "It appears that a Content Delivery Network (CDN) is active on your site, which may interfere with GoDAM's video transcoding features. If the CDN issue has been resolved, you can safely ignore this warning and proceed with video transcoding.", 'godam' ); ?></p>
							<?php
							$raw_html = '<p>For detailed guidance, please refer to our <a href="%1$s" target="_blank">CDN Integration Guide</a> or contact our <a href="%2$s" target="_blank">Support Team</a> for assistance.</p>';

							$cdn_guide_url = esc_url( 'https://godam.io/docs' );
							$support_url   = esc_url( 'https://app.godam.io/helpdesk/my-tickets' );

							// Allowed HTML tags for wp_kses.
							$allowed_tags = array(
								'a'      => array(
									'href'   => array(),
									'target' => array(),
								),
								'p'      => array(),
								'strong' => array(),
							);

							$formatted_html = sprintf( $raw_html, $cdn_guide_url, $support_url );
							// Output safely with allowed HTML tags.
							echo wp_kses( $formatted_html, $allowed_tags );
							?>
						</div>
					</div>
				</div>
				<?php
			}
		);
	}

	/**
	 * Check if the Transcoder plugin is active and display an admin notice if it is.
	 *
	 * @return void
	 */
	public function check_transcoder_plugin() {
		if ( is_plugin_active( 'transcoder/rt-transcoder.php' ) ) {

			$screen = get_current_screen();
			if ( ! in_array( $screen->id, array( 'dashboard', 'upload', 'plugins' ), true ) ) {
				return;
			}

			$message = sprintf(
				// translators: %1$s is the name of the Transcoder plugin, %2$s is the name of the GoDAM plugin.
				__( 'Please deactivate the <strong>%1$s</strong> plugin to ensure the <strong>%2$s</strong> plugin functions correctly.', 'godam' ),
				'Transcoder',
				'GoDAM'
			);

			$message = '<div class="notice notice-error"><p>' . $message . '</p></div>';

			echo wp_kses(
				$message,
				array(
					'div'    => array(
						'class' => array(),
					),
					'p'      => array(),
					'strong' => array(),
					'a'      => array(
						'href'   => array(),
						'target' => array(),
					),
				),
			);
		}
	}
}
