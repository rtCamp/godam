<?php
/**
 * Register REST API endpoint for the GoDAM Video Gallery V2.
 *
 * Serves Load More / infinite-scroll pagination for the godam/gallery-v2
 * block and the [godam_video_gallery] shortcode, which now share the same
 * markup and JS contract. Item HTML produced here must match the markup
 * emitted by inc/templates/godam-video-gallery.php.
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
						'offset'            => array(
							'type'    => 'integer',
							'default' => 0,
						),
						'count'             => array(
							'type'    => 'integer',
							'default' => 6,
						),
						'orderby'           => array(
							'type'    => 'string',
							'default' => 'date',
						),
						'order'             => array(
							'type'    => 'string',
							'default' => 'DESC',
						),
						'show_title'        => array(
							'type'    => 'boolean',
							'default' => true,
						),
						'layout'            => array(
							'type'    => 'string',
							'default' => 'grid',
						),
						'author'            => array(
							'type'    => 'string',
							'default' => '',
						),
						'media_folder'      => array(
							'type'    => 'string',
							'default' => '',
						),
						'date_range'        => array(
							'type'    => 'string',
							'default' => '',
						),
						'custom_date_start' => array(
							'type'    => 'string',
							'default' => '',
						),
						'custom_date_end'   => array(
							'type'    => 'string',
							'default' => '',
						),
						'engagements'       => array(
							'type'    => 'boolean',
							'default' => true,
						),
						'view_ratio'        => array(
							'type'    => 'string',
							'default' => '16:9',
						),
						'performance_mode'  => array(
							'type'    => 'string',
							'default' => 'balanced',
						),
					),
				),
			),
		);
	}

	/**
	 * Render the gallery items for a Load More / infinite-scroll page.
	 *
	 * @param WP_REST_Request $request The REST request object.
	 * @return WP_REST_Response
	 */
	public function render_gallery( WP_REST_Request $request ) {
		// The gallery template carries the rtgodam_gallery_v2_* helpers used
		// below. Requiring it without an $attributes variable in scope is a
		// no-op render — only the function declarations are loaded.
		require_once RTGODAM_PATH . 'inc/templates/godam-video-gallery.php';

		$gallery_attributes = array(
			'mode'            => 'query',
			'count'           => max( 1, absint( $request->get_param( 'count' ) ) ),
			'orderby'         => sanitize_key( $request->get_param( 'orderby' ) ),
			'order'           => strtoupper( sanitize_key( $request->get_param( 'order' ) ) ),
			'layout'          => sanitize_key( $request->get_param( 'layout' ) ),
			'viewRatio'       => $request->get_param( 'view_ratio' ),
			'showTitle'       => (bool) $request->get_param( 'show_title' ),
			'mediaFolder'     => (string) $request->get_param( 'media_folder' ),
			'author'          => (string) $request->get_param( 'author' ),
			'dateRange'       => sanitize_key( $request->get_param( 'date_range' ) ),
			'customDateStart' => (string) $request->get_param( 'custom_date_start' ),
			'customDateEnd'   => (string) $request->get_param( 'custom_date_end' ),
			'engagements'     => (bool) $request->get_param( 'engagements' ),
			'performanceMode' => sanitize_key( $request->get_param( 'performance_mode' ) ),
		);

		$offset           = max( 0, absint( $request->get_param( 'offset' ) ) );
		$ratio_class      = str_replace( ':', '-', $gallery_attributes['viewRatio'] );
		$performance_mode = rtgodam_resolve_video_performance_mode( $gallery_attributes, 'balanced' );
		$show_title       = $gallery_attributes['showTitle'];

		$args                  = rtgodam_gallery_v2_build_query_args( $gallery_attributes, 1 );
		$args['offset']        = $offset;
		$args['no_found_rows'] = true;

		// rtgodam_gallery_v2_build_query_args() restricts orderby to date/title.
		// The REST endpoint additionally supports duration and size to mirror
		// the block's full orderby UI on Load More responses.
		$raw_orderby = sanitize_key( $request->get_param( 'orderby' ) );
		if ( 'duration' === $raw_orderby ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Required for sorting by video duration.
			$args['meta_key'] = '_video_duration';
			$args['orderby']  = 'meta_value_num';
		} elseif ( 'size' === $raw_orderby ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Required for sorting by video file size.
			$args['meta_key'] = '_video_file_size';
			$args['orderby']  = 'meta_value_num';
		}

		$query = new \WP_Query( $args );
		ob_start();

		if ( $query->have_posts() ) {
			foreach ( $query->posts as $index => $video_post ) {
				$item = rtgodam_gallery_v2_get_video_data( $video_post->ID );

				if ( ! $item ) {
					continue;
				}

				$thumbnail_attributes = rtgodam_format_html_attributes(
					rtgodam_get_gallery_tile_image_attributes(
						$performance_mode,
						$offset + $index
					)
				);

				echo '<div class="godam-gallery-v2__query-item godam-gallery-v2__query-item--ratio-' . esc_attr( $ratio_class ) . '">';
				/* translators: %s: video title. */
				echo '<button type="button" class="godam-gallery-v2__query-button" data-godam-gallery-v2-trigger="true" data-video-id="' . esc_attr( $item['id'] ) . '" aria-label="' . esc_attr( sprintf( __( 'Open video: %s', 'godam' ), $item['title'] ) ) . '">';
				echo '<div class="godam-gallery-v2__query-thumb' . ( ! empty( $item['placeholder'] ) ? ' godam-gallery-blurred-img' : '' ) . '"' . ( ! empty( $item['placeholder'] ) ? ' style="background-image: url(\'' . esc_url( $item['placeholder'] ) . '\')"' : '' ) . '>';
				if ( ! empty( $item['thumbnail'] ) ) {
					// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- $thumbnail_attributes comes from rtgodam_format_html_attributes() which pre-sanitizes.
					echo '<img src="' . esc_url( $item['thumbnail'] ) . '" alt="' . esc_attr( $item['title'] ) . '" class="godam-gallery-v2__thumbnail"' . ( $thumbnail_attributes ? ' ' . $thumbnail_attributes : '' ) . ' />';
				} else {
					echo '<span>' . esc_html__( 'Video', 'godam' ) . '</span>';
				}
				echo '</div>';

				if ( $show_title ) {
					echo '<div class="godam-gallery-v2__query-meta">';
					echo '<strong>' . esc_html( $item['title'] ) . '</strong>';
					if ( ! empty( $item['date'] ) ) {
						echo '<span>' . esc_html( $item['date'] ) . '</span>';
					}
					echo '</div>';
				}

				echo '</button>';
				echo '</div>';
			}
		}

		wp_reset_postdata();

		return new WP_REST_Response(
			array(
				'status' => 'success',
				'html'   => ob_get_clean(),
			),
			200
		);
	}
}
