<?php
/**
 * GoDAM video engagement class.
 *
 * @package godam
 */

namespace RTGODAM\Inc;

use RTGODAM\Inc\Traits\Singleton;
use WP_Error;

/**
 * Class Video_Engagement
 */
class Video_Engagement {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		add_action( 'rtgodam_after_video_html', array( $this, 'add_engagement_to_video' ), 10, 4 );
	}

	/**
	 * Adds engagement elements to the video.
	 *
	 * @param array $attributes  Video block attributes.
	 * @param int   $instance_id The instance ID.
	 * @param array $easydam_meta_data The EasyDAM meta data.
	 * @param array $godam_settings The GoDAM settings.
	 *
	 * @return string|void
	 */
	public function add_engagement_to_video( $attributes, $instance_id, $easydam_meta_data, $godam_settings ) {
		$attachment_id = ! empty( $attributes['id'] ) && is_numeric( $attributes['id'] ) ? intval( $attributes['id'] ) : '';

		if ( ! empty( $attachment_id ) && 'transcoded' !== strtolower( get_post_meta( $attachment_id, 'rtgodam_transcoding_status', true ) ) ) {
			return '';
		}

		if ( empty( $attachment_id ) && isset( $attributes['cmmId'] ) ) {
			$attachment_id = 'cmmid_' . $attributes['cmmId'];
		}

		if ( ! $this->check_if_engagements_enabled( $attachment_id, $attributes ) ) {
			return '';
		}

		if ( empty( $attributes['title'] ) && ! empty( $attributes['seo']['headline'] ) ) {
			$attributes['title'] = $attributes['seo']['headline'];
		}
		$title = ! empty( $attributes['title'] ) ? $attributes['title'] : get_the_title( $attachment_id );

		$brand_color = '#000'; // Default brand color.

		if ( ! empty( $godam_settings['video_player']['brand_color'] ) ) {
			$brand_color = $godam_settings['video_player']['brand_color'];
		}

		if ( ! empty( $easydam_meta_data['videoConfig']['controlBar']['appearanceColor'] ) ) {
			$brand_color = $easydam_meta_data['videoConfig']['controlBar']['appearanceColor'];
		}
		?>
		<div class="rtgodam-video-engagement rtgodam-video-engagement--link-disabled" 
		style="--godam-video-engagement-background-color: <?php echo esc_attr( $brand_color ); ?>;"
		data-engagement-id="engagement-<?php echo esc_attr( $instance_id ); ?>" data-engagement-video-id="<?php echo esc_attr( $attachment_id ); ?>" data-engagement-site-url="<?php echo esc_url( get_site_url() ); ?>" data-engagement-video-title="<?php echo esc_attr( $title ); ?>">
			<div class="rtgodam-video-engagement--title">
				<?php echo esc_html( $title ); ?>
			</div>
			<div class="rtgodam-video-engagement--like">
				<button type="button" class="rtgodam-video-engagement--like-link">
					<span class="rtgodam-video-engagement--like-icon">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							width="20"
							height="20"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 
						4.42 3 7.5 3c1.74 0 3.41 0.81 4.5 2.09C13.09 3.81 14.76 3 
						16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 
						11.54L12 21.35z"/>
						</svg>

					</span>
					<span class="rtgodam-video-engagement--like-count">-</span>
				</button>
			</div>
			<div class="rtgodam-video-engagement--comment">
				<button type="button" class="rtgodam-video-engagement--comment-link">
					<span class="rtgodam-video-engagement--comment-icon">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
						</svg>
					</span>
					<span class="rtgodam-video-engagement--comment-count">-</span>
				</button>
			</div>
			<div class="rtgodam-video-engagement--view">
				<div class="rtgodam-video-engagement--view-link">
					<span class="rtgodam-video-engagement--view-icon">
						<svg 
							xmlns="http://www.w3.org/2000/svg" 
							width="20" 
							height="20" 
							fill="currentColor" 
							viewBox="0 0 24 24"
						>
						<path d="M12 4.5C7 4.5 2.73 8.11 1 12c1.73 3.89 6 7.5 11 7.5s9.27-3.61 11-7.5c-1.73-3.89-6-7.5-11-7.5zm0 12a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/>
						<circle cx="12" cy="12" r="2.5"/>
						</svg>

					</span>
					<span class="rtgodam-video-engagement--view-count">-</span>
				</div>
			</div>
		</div>
		<?php
	}

	/**
	 * Checks if engagements are enabled for a video.
	 *
	 * @param int|string $attachment_id The attachment ID of the video.
	 * @param array      $attributes    The block attributes.
	 *
	 * @return bool True if engagements are enabled, otherwise false.
	 */
	public function check_if_engagements_enabled( $attachment_id, $attributes ) {

		if ( empty( $attachment_id ) || ! isset( $attributes['engagements'] ) ) {
			return false;
		}
		if ( is_bool( $attributes['engagements'] ) && ! $attributes['engagements'] ) {
			return false;
		}
		if ( is_string( $attributes['engagements'] ) && 'show' !== $attributes['engagements'] ) {
			return false;
		}

		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		if ( empty( $account_token ) || 'unverified' === $account_token ) {
			return false;
		}

		$easydam_settings = get_option( 'rtgodam-settings', array() );

		if ( isset( $easydam_settings['video']['enable_global_video_engagement'] ) && ! $easydam_settings['video']['enable_global_video_engagement'] ) {
			return false;
		}

		return true;
	}
}
