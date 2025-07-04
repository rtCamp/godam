<?php
/**
 * REST API class to render [godam_video] shortcode output.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use WP_REST_Server;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class Dynamic_Shortcode.
 */
class Dynamic_Shortcode extends Base {

	/**
	 * Route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'video-shortcode';

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
					'callback'            => array( $this, 'render_shortcode' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'id' => array(
							'required'          => true,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
						),
					),
				),
			),
		);
	}

	/**
	 * Callback to render the shortcode.
	 *
	 * @param WP_REST_Request $request REST request.
	 * @return WP_REST_Response
	 */
	public function render_shortcode( WP_REST_Request $request ) {
		$id = $request->get_param( 'id' );

		if ( ! get_post( $id ) ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => 'Video not found.',
				),
				404
			);
		}

		// Add action before shortcode rendering.
		do_action( 'rtgodam_shortcode_before_render', $id );

		// Get the video title and date.
		$video_title = get_the_title( $id );
		$video_date  = get_the_date( 'F j, Y', $id );

		// Add filters for title and date.
		$video_title = apply_filters( 'rtgodam_shortcode_video_title', $video_title, $id );
		$video_date  = apply_filters( 'rtgodam_shortcode_video_date', $video_date, $id );

		ob_start();
		$shortcode = '[godam_video id="' . $id . '"]';
		
		// Add filter for shortcode.
		$shortcode = apply_filters( 'rtgodam_shortcode_output', $shortcode, $id );
		
		echo do_shortcode( $shortcode );
		$html = ob_get_clean();

		// Add filter for final HTML output.
		$html = apply_filters( 'rtgodam_shortcode_html', $html, $id );

		// Add action after shortcode rendering.
		do_action( 'rtgodam_shortcode_after_render', $id );

		return new WP_REST_Response(
			array(
				'status' => 'success',
				'html'   => $html,
				'title'  => $video_title,
				'date'   => $video_date,
			),
			200
		);
	}
}
