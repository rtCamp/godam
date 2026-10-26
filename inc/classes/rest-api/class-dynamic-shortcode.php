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
						'id'            => array(
							'required'          => true,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
						),
						'engagements'   => array(
							'required'          => false,
							'type'              => 'string',
							'default'           => '',
							'sanitize_callback' => 'sanitize_text_field',
							'validate_callback' => function ( $value ) {
								return in_array( $value, array( '', 'show', 'hide' ), true );
							},
						),
						'godam_context' => array(
							'required'          => false,
							'type'              => 'string',
							'default'           => '',
							'sanitize_callback' => 'sanitize_key',
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

		// Slug characters only, whatever reaches this method.
		$godam_context = sanitize_key( (string) $request->get_param( 'godam_context' ) );

		/**
		 * Fires before resolving this attachment's URL/meta/sources, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		try {
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
		} finally {
			do_action( 'rtgodam_after_attachment_lookup' );
		}

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

		$sources_json = wp_json_encode( $sources );

		// Add action before shortcode rendering.
		do_action( 'rtgodam_shortcode_before_render', $id );

		// Get the video title and date.
		/**
		 * Fires before reading this attachment's title/date, so
		 * integrations that centralize media on another site can switch
		 * context first.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_before_attachment_lookup' );
		$video_title = get_the_title( $id );
		$video_date  = get_the_date( 'F j, Y', $id );

		/**
		 * Fires after reading this attachment's title/date, so
		 * integrations can restore the site context switched in
		 * `rtgodam_before_attachment_lookup`.
		 *
		 * @since 2.2.0
		 */
		do_action( 'rtgodam_after_attachment_lookup' );

		// Add filters for title and date.
		$video_title = apply_filters( 'rtgodam_shortcode_video_title', $video_title, $id );
		$video_date  = apply_filters( 'rtgodam_shortcode_video_date', $video_date, $id );

		ob_start();
		$atts = array(
			'id'          => (string) $id,
			'engagements' => (string) $engagements,
			'sources'     => $sources_json,
		);

		if ( ! empty( $godam_context ) ) {
			$atts['godam_context'] = $godam_context;
		}

		/**
		 * Filters the attributes the player is rendered with.
		 *
		 * @since 2.5.1
		 *
		 * @param array $atts Attributes passed to the [godam_video] renderer.
		 * @param int   $id   Attachment ID.
		 */
		$atts = apply_filters( 'rtgodam_shortcode_atts', $atts, $id );

		if ( has_filter( 'rtgodam_shortcode_output' ) ) {
			// Keep sites that still change the shortcode string working. Every value in it is
			// an ID, a slug, 'show'/'hide' or JSON with its brackets swapped for placeholders.
			$shortcode = "[godam_video id='" . absint( $atts['id'] ?? $id ) . "' engagements='" . esc_attr( $atts['engagements'] ?? '' ) . "' sources='" . str_replace( array( '[', ']' ), array( '__rtgob__', '__rtgcb__' ), (string) ( $atts['sources'] ?? '' ) ) . "'";

			if ( ! empty( $atts['godam_context'] ) ) {
				$shortcode .= " godam_context='" . esc_attr( $atts['godam_context'] ) . "'";
			}

			$shortcode .= ']';

			/**
			 * Filters the shortcode string the player is rendered from.
			 *
			 * @since 1.1.4
			 * @deprecated 2.5.1 Use the rtgodam_shortcode_atts filter instead.
			 *
			 * @param string $shortcode The [godam_video] shortcode.
			 * @param int    $id        Attachment ID.
			 */
			$shortcode = apply_filters_deprecated( 'rtgodam_shortcode_output', array( $shortcode, $id ), '2.5.1', 'rtgodam_shortcode_atts' );

			echo do_shortcode( $shortcode );
		} else {
			echo rtgodam_render_shortcode_from_atts( 'godam_video', $atts ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- The player template escapes its output.
		}

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
