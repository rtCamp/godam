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
						'id'          => array(
							'required'          => true,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
						),
						'engagements' => array(
							'required' => false,
							'type'     => 'string',
							'default'  => '',
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

		$engagements = $request->get_param( 'engagements' );

		$godam_context = $request->get_param( 'godam_context' );

		$attachment = get_post( $id );

		if ( ! $attachment || 'attachment' !== $attachment->post_type ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => 'Video not found.',
				),
				404
			);
		}

		$transcoded_url     = strval( rtgodam_get_transcoded_url_from_attachment( $id ) );
		$hls_transcoded_url = strval( rtgodam_get_hls_transcoded_url_from_attachment( $id ) );
		$video_src          = strval( wp_get_attachment_url( $id ) );
		$video_src_type     = strval( get_post_mime_type( $id ) );
		$sources            = array();

		if ( ! empty( $transcoded_url ) ) {
			$sources[] = array(
				'src'  => $transcoded_url,
				'type' => 'application/dash+xml',
			);
		}

		if ( ! empty( $hls_transcoded_url ) ) {
			$sources[] = array(
				'src'  => $hls_transcoded_url,
				'type' => 'application/x-mpegURL',
			);
		}

		$sources[] = array(
			'src'  => $video_src,
			'type' => 'video/quicktime' === $video_src_type ? 'video/mp4' : $video_src_type,
		);

		// Convert JSON to use custom placeholders instead of square brackets.
		$sources_json              = wp_json_encode( $sources );
		$sources_with_placeholders = str_replace( array( '[', ']' ), array( '__rtgob__', '__rtgcb__' ), $sources_json );

		// Add action before shortcode rendering.
		do_action( 'rtgodam_shortcode_before_render', $id );

		// Get the video title and date.
		$video_title = get_the_title( $id );
		$video_date  = get_the_date( 'F j, Y', $id );

		// Add filters for title and date.
		$video_title = apply_filters( 'rtgodam_shortcode_video_title', $video_title, $id );
		$video_date  = apply_filters( 'rtgodam_shortcode_video_date', $video_date, $id );

		ob_start();
		$shortcode = "[godam_video id='{$id}' engagements='{$engagements}' sources='{$sources_with_placeholders}'";

		if ( ! empty( $godam_context ) ) {
			$shortcode .= " godam_context='{$godam_context}'";
		}

		$shortcode .= "]";

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
