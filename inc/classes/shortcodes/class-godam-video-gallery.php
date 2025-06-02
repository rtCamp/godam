<?php
/**
 * GoDAM Video Gallery Shortcode Class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Shortcodes;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class GoDAM_Video_Gallery.
 *
 * Handles [godam_video_gallery] shortcode.
 */
class GoDAM_Video_Gallery {
	use Singleton;

	/**
	 * Constructor.
	 */
	final protected function __construct() {
		add_shortcode( 'godam_video_gallery', array( $this, 'render' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'register_scripts' ) );

		add_action(
			'wp_enqueue_scripts',
			function () {
				if ( ! is_admin() ) {
					wp_enqueue_script( 'godam-player-frontend-script' );
					wp_enqueue_script( 'godam-player-analytics-script' );
					wp_enqueue_style( 'godam-player-frontend-style' );
					wp_enqueue_style( 'godam-player-style' );
				}
			} 
		);
	}

	/**
	 * Register gallery-specific scripts and styles.
	 */
	public function register_scripts() {
		wp_register_style(
			'godam-gallery-style',
			RTGODAM_URL . 'assets/build/css/godam-gallery.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/godam-gallery.css' )
		);

		wp_register_script(
			'godam-gallery-script',
			RTGODAM_URL . 'assets/build/js/godam-gallery.js',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/js/godam-gallery.js' ),
			true
		);
		wp_enqueue_script( 'godam-gallery-script' );
	}

	/**
	 * Render the video gallery shortcode.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output of the gallery.
	 */
	public function render( $atts ) {
		$atts = shortcode_atts(
			array(
				'count'   => 6,
				'orderby' => 'date',
				'order'   => 'DESC',
				'columns' => 3,
				'layout'  => 'grid',
			),
			$atts,
			'godam_video_gallery'
		);

		wp_enqueue_style( 'godam-gallery-style' );

		// Check for API key.
		$api_key = get_option( 'rtgodam-api-key', '' );
		if ( empty( $api_key ) ) {
			return '<div class="godam-video-gallery-error">' . esc_html__( '[API Key missing. Please configure the API key in the GoDAM settings.]', 'godam' ) . '</div>';
		}

		$args = array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'post_mime_type' => 'video',
			'posts_per_page' => intval( $atts['count'] ),
			'orderby'        => sanitize_text_field( $atts['orderby'] ),
			'order'          => sanitize_text_field( $atts['order'] ),
		);

		$query = new \WP_Query( $args );

		ob_start();

		if ( $query->have_posts() ) {
			echo '<div class="godam-video-gallery layout-' . esc_attr( $atts['layout'] ) . ' columns-' . intval( $atts['columns'] ) . '">';
			foreach ( $query->posts as $video ) {
				$video_id = intval( $video->ID );
			
				$custom_thumbnail = get_post_meta( $video_id, 'rtgodam_media_video_thumbnail', true );
				$fallback_thumb   = RTGODAM_URL . 'assets/src/images/video-thumbnail-default.png';
			
				$thumbnail = $custom_thumbnail ?: $fallback_thumb;
			
				// Get video duration using file path.
				$file_path = get_attached_file( $video_id );
				$duration  = null;
			
				if ( file_exists( $file_path ) ) {
					if ( ! function_exists( 'wp_read_video_metadata' ) ) {
						require_once ABSPATH . 'wp-admin/includes/media.php';
					}
			
					$metadata = wp_read_video_metadata( $file_path );
					if ( ! empty( $metadata['length_formatted'] ) ) {
						$duration = $metadata['length_formatted'];
					}
				}
			
				echo '<div class="godam-video-item">';
				echo '<div class="godam-video-thumbnail" data-video-id="' . esc_attr( $video_id ) . '">';
				echo '<img src="' . esc_url( $thumbnail ) . '" alt="' . esc_attr__( 'Video Thumbnail', 'godam' ) . '" />';
				if ( $duration ) {
					echo '<span class="godam-video-duration">' . esc_html( $duration ) . '</span>';
				}
				echo '</div>';
				echo '</div>';
			}
			echo '</div>';

			$total_videos = $query->found_posts;
			$shown_videos = count( $query->posts );

			if ( $shown_videos < $total_videos ) {
				echo '<button 
					class="godam-load-more" 
					data-offset="' . esc_attr( $shown_videos ) . '" 
					data-columns="' . esc_attr( $atts['columns'] ) . '" 
					data-count="' . esc_attr( $atts['count'] ) . '" 
					data-orderby="' . esc_attr( $atts['orderby'] ) . '" 
					data-order="' . esc_attr( $atts['order'] ) . '"
					data-total="' . esc_attr( $total_videos ) . '"
				>' . esc_html__( 'Load More', 'godam' ) . '</button>';
			}

			echo '
			<div id="godam-video-modal" class="godam-modal hidden">
				<div class="godam-modal-overlay"></div>
				<div class="godam-modal-content"></div>
			</div>';
		} else {
			echo '<p>' . esc_html__( 'No videos found.', 'godam' ) . '</p>';
		}

		wp_reset_postdata();
		return ob_get_clean();
	}
}
