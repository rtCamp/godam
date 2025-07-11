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
		add_action( 'rtgodam_after_video_html', array( $this, 'add_engagement_to_video' ), 10, 2 );
	}


	/**
	 * Adds engagement elements to the video.
	 *
	 * @param array $attributes Video block attributes.
	 * @param int   $instance_id The instance ID.
	 *
	 * @return string|void
	 */
	public function add_engagement_to_video( $attributes, $instance_id ) {
		$attachment_id = ! empty( $attributes['id'] ) && is_numeric( $attributes['id'] ) ? intval( $attributes['id'] ) : null;
		if ( empty( $attachment_id ) ) {
			return '';
		}
		$get_video_engagement_data = $this->get_video_engagement_data( $attachment_id );
		if ( is_wp_error( $get_video_engagement_data ) ) {
			return '';
		}

		$get_video_engagement_data = json_decode( $get_video_engagement_data, true );
		$view_count                = ! empty( $get_video_engagement_data['data']['post_views'] ) ? $get_video_engagement_data['data']['post_views'] : 0;

		if ( is_array( $view_count ) ) {
			$view_count = array_sum( $view_count );
		}

		?>
		<div class="rtgodam-video-engagement" data-engagement-id="engagement-<?php echo esc_attr( $instance_id ); ?>" data-engagement-video-id="engagement-<?php echo esc_attr( $instance_id ); ?>">
			<div class="rtgodam-video-engagement--like">
				<a href="#" class="rtgodam-video-engagement--like-link">
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
					<span class="rtgodam-video-engagement--like-count">0</span>
				</a>
			</div>
			<div class="rtgodam-video-engagement--comment">
				<a href="#" class="rtgodam-video-engagement--comment-link">
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
					<span class="rtgodam-video-engagement--comment-count">0</span>
				</a>
			</div>
			<div class="rtgodam-video-engagement--view">
				<a href="#" class="rtgodam-video-engagement--view-link">
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
					<span class="rtgodam-video-engagement--view-count"><?php echo esc_html( $view_count ); ?></span>
				</a>
			</div>
		</div>
		<?php
	}

	/**
	 * Retrieve video engagement data.
	 *
	 * @param int $video_id Post ID of the video.
	 * @return mixed The response from the API, or a WP_Error on failure.
	 */
	public function get_video_engagement_data( $video_id ) {

		$site_url     = get_site_url();
		$api_endpoint = add_query_arg(
			array(
				'site_url' => $site_url,
				'video_id' => $video_id,
			),
			$site_url . '/wp-json/godam/v1/analytics/fetch'
		);

		$args = array(
			'timeout'   => 10,
			'headers'   => array(
				'Content-Type' => 'application/json',
			),
			'sslverify' => 'production' === wp_get_environment_type(),
		);

		$response = wp_remote_get(
			$api_endpoint,
			$args
		);
		if ( ! is_wp_error( $response ) ) {
			$response = wp_remote_retrieve_body( $response );
		} else {
			$response = new WP_Error( 'failed_to_retrieve', __( 'Could not retrieve.', 'godam' ) );
		}
		return $response;
	}
}
