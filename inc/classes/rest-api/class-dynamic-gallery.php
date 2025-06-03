<?php
/**
 * Register REST API endpoint for Dynamic Gallery Blocks.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use WP_REST_Server;
use WP_REST_Request;
use WP_REST_Response;


/**
 * Class Dynamic_Gallery
 */
class Dynamic_Gallery extends Base {

	/**
	 * Route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'gallery-shortcode';

	/**
	 * Get registered REST routes.
	 *
	 * @return array
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base,
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'render_gallery' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'offset'     => array(
							'type'    => 'integer',
							'default' => 0,
						),
						'columns'    => array(
							'type'    => 'integer',
							'default' => 3,
						),
						'count'      => array(
							'type'    => 'integer',
							'default' => 6,
						),
						'orderby'    => array(
							'type'    => 'string',
							'default' => 'date',
						),
						'order'      => array(
							'type'    => 'string',
							'default' => 'DESC',
						),
						'show_title' => array(
							'type'    => 'boolean',
							'default' => true,
						),
					),
				),
			),
		);
	}

	/**
	 * Render the gallery block.
	 * 
	 * @param WP_REST_Request $request The REST request object.
	 *
	 * @return WP_REST_Response
	 */
	public function render_gallery( WP_REST_Request $request ) {
		$atts = array(
			'count'      => $request->get_param( 'count' ),
			'orderby'    => $request->get_param( 'orderby' ),
			'order'      => $request->get_param( 'order' ),
			'columns'    => $request->get_param( 'columns' ),
			'offset'     => $request->get_param( 'offset' ),
			'show_title' => $request->get_param( 'show_title' ),
		);

		// Render only the video items, not the whole gallery wrapper or button.
		$args = array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'post_mime_type' => 'video',
			'posts_per_page' => $atts['count'],
			'orderby'        => $atts['orderby'],
			'order'          => $atts['order'],
			'offset'         => $atts['offset'],
		);

		$query = new \WP_Query( $args );
		ob_start();
		if ( $query->have_posts() ) {
			foreach ( $query->posts as $video ) {
				$video_id    = intval( $video->ID );
				$video_title = get_the_title( $video_id );
				
				$custom_thumbnail = get_post_meta( $video_id, 'rtgodam_media_video_thumbnail', true );
				$fallback_thumb   = RTGODAM_URL . 'assets/src/images/video-thumbnail-default.png';
				$thumbnail        = $custom_thumbnail ?: $fallback_thumb;
				
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
				echo '<img src="' . esc_url( $thumbnail ) . '" alt="' . esc_attr( $video_title ) . '" />';
				if ( $duration ) {
					echo '<span class="godam-video-duration">' . esc_html( $duration ) . '</span>';
				}
				echo '</div>';
				
				// Add title if show_title is true.
				if ( ! empty( $atts['show_title'] ) ) {
					echo '<div class="godam-video-title">' . esc_html( $video_title ) . '</div>';
				}
				
				echo '</div>';
			}
		}
		
		$html = ob_get_clean();
		return new WP_REST_Response(
			array(
				'status' => 'success',
				'html'   => $html,
			),
			200
		);
	}
}
