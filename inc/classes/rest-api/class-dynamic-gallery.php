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
						'offset'            => array(
							'type'    => 'integer',
							'default' => 0,
						),
						'columns'           => array(
							'type'    => 'integer',
							'default' => 3,
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
						'category'          => array(
							'type'    => 'integer',
							'default' => 0,
						),
						'tag'               => array(
							'type'    => 'integer',
							'default' => 0,
						),
						'author'            => array(
							'type'    => 'integer',
							'default' => 0,
						),
						'include'           => array(
							'type'    => 'string',
							'default' => '',
						),
						'search'            => array(
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
			'count'             => $request->get_param( 'count' ),
			'orderby'           => $request->get_param( 'orderby' ),
			'order'             => $request->get_param( 'order' ),
			'columns'           => $request->get_param( 'columns' ),
			'offset'            => $request->get_param( 'offset' ),
			'show_title'        => $request->get_param( 'show_title' ),
			'layout'            => $request->get_param( 'layout' ),
			'category'          => $request->get_param( 'category' ),
			'tag'               => $request->get_param( 'tag' ),
			'author'            => $request->get_param( 'author' ),
			'include'           => $request->get_param( 'include' ),
			'search'            => $request->get_param( 'search' ),
			'date_range'        => $request->get_param( 'date_range' ),
			'custom_date_start' => $request->get_param( 'custom_date_start' ),
			'custom_date_end'   => $request->get_param( 'custom_date_end' ),
			'engagements'       => $request->get_param( 'engagements' ),
		);

		// Add filter for dynamic gallery attributes.
		$atts = apply_filters( 'rtgodam_dynamic_gallery_attributes', $atts, $request );

		$args = array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'post_mime_type' => 'video',
			'posts_per_page' => $atts['count'],
			'orderby'        => $atts['orderby'],
			'order'          => $atts['order'],
			'offset'         => $atts['offset'],
		);

		// Add category filter.
		if ( ! empty( $atts['category'] ) ) {
			$args['tax_query'][] = array(
				'taxonomy' => 'category',
				'field'    => 'term_id',
				'terms'    => intval( $atts['category'] ),
			);
		}

		// Add tag filter.
		if ( ! empty( $atts['tag'] ) ) {
			$args['tax_query'][] = array(
				'taxonomy' => 'post_tag',
				'field'    => 'term_id',
				'terms'    => intval( $atts['tag'] ),
			);
		}

		// Add author filter.
		if ( ! empty( $atts['author'] ) ) {
			$args['author'] = intval( $atts['author'] );
		}

		// Add include filter.
		if ( ! empty( $atts['include'] ) ) {
			$args['post__in'] = array_map( 'intval', explode( ',', $atts['include'] ) );
		}

		// Add search filter.
		if ( ! empty( $atts['search'] ) ) {
			$args['s'] = $atts['search'];
		}

		// Add date range filter.
		if ( ! empty( $atts['date_range'] ) ) {
			$date_query = array();
			switch ( $atts['date_range'] ) {
				case '7days':
					$date_query = array( 'after' => '1 week ago' );
					break;
				case '30days':
					$date_query = array( 'after' => '1 month ago' );
					break;
				case '90days':
					$date_query = array( 'after' => '3 months ago' );
					break;
				case 'custom':
					if ( ! empty( $atts['custom_date_start'] ) && ! empty( $atts['custom_date_end'] ) ) {
						// Convert UTC dates to local timezone.
						$start_date = new \DateTime( $atts['custom_date_start'] );
						$end_date   = new \DateTime( $atts['custom_date_end'] );
						
						// Set timezone to WordPress timezone.
						$wp_timezone = new \DateTimeZone( wp_timezone_string() );
						$start_date->setTimezone( $wp_timezone );
						$end_date->setTimezone( $wp_timezone );
						
						// Set start date to beginning of day (00:00:00).
						$start_date->setTime( 0, 0, 0 );
						
						// Set end date to end of day (23:59:59).
						$end_date->setTime( 23, 59, 59 );
						
						$date_query = array(
							'after'     => $start_date->format( 'Y-m-d H:i:s' ),
							'before'    => $end_date->format( 'Y-m-d H:i:s' ),
							'inclusive' => true,
						);
					}
					break;
			}
			if ( ! empty( $date_query ) ) {
				$args['date_query'] = array( $date_query );
			}
		}

		// Handle duration and size sorting.
		if ( 'duration' === $atts['orderby'] ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Required for sorting by video duration.
			$args['meta_key'] = '_video_duration';
			$args['orderby']  = 'meta_value_num';
		} elseif ( 'size' === $atts['orderby'] ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Required for sorting by video file size.
			$args['meta_key'] = '_video_file_size';
			$args['orderby']  = 'meta_value_num';
		}

		// Add filter for dynamic gallery query args.
		$args = apply_filters( 'rtgodam_dynamic_gallery_query_args', $args, $atts );

		$video_settings = get_option( 'rtgodam_video_post_settings', array() );
		$cpt_url_slug   = ! empty( $video_settings['video_slug'] ) ? sanitize_title( $video_settings['video_slug'] ) : 'videos';
		$cpt_base_url   = home_url( '/' );

		$query = new \WP_Query( $args );
		ob_start();
		if ( $query->have_posts() ) {
			$total_videos    = $query->found_posts;
			$shown_videos    = count( $query->posts );
			$alignment_class = '';
	
			if ( intval( $atts['offset'] ) === 0 ) {
				echo '<div class="godam-video-gallery layout-' . esc_attr( $atts['layout'] ) .
					( 'grid' === $atts['layout'] ? ' columns-' . intval( $atts['columns'] ) : '' ) .
					esc_attr( $alignment_class ) . '" 
					data-infinite-scroll="true"
					data-offset="' . esc_attr( $shown_videos + $atts['offset'] ) . '"
					data-columns="' . esc_attr( $atts['columns'] ) . '"
					data-orderby="' . esc_attr( $atts['orderby'] ) . '"
					data-order="' . esc_attr( $atts['order'] ) . '"
					data-total="' . esc_attr( $total_videos ) . '"
					data-show-title="' . ( $atts['show_title'] ? '1' : '0' ) . '"
					data-layout="' . esc_attr( $atts['layout'] ) . '"
					data-category="' . esc_attr( $atts['category'] ?? '' ) . '"
					data-tag="' . esc_attr( $atts['tag'] ?? '' ) . '"
					data-author="' . esc_attr( $atts['author'] ?? '' ) . '"
					data-include="' . esc_attr( $atts['include'] ?? '' ) . '"
					data-search="' . esc_attr( $atts['search'] ?? '' ) . '"
					data-date-range="' . esc_attr( $atts['date_range'] ?? '' ) . '"
					data-custom-date-start="' . esc_attr( $atts['custom_date_start'] ?? '' ) . '"
					data-custom-date-end="' . esc_attr( $atts['custom_date_end'] ?? '' ) . '">';
			}
	
			do_action( 'rtgodam_dynamic_gallery_before_output', $query, $atts );
	
			foreach ( $query->posts as $video ) {
				do_action( 'rtgodam_dynamic_gallery_before_video_item', $video, $atts );
	
				$video_id    = intval( $video->ID );
				$video_title = apply_filters( 'rtgodam_dynamic_gallery_video_title', get_the_title( $video_id ), $video_id );
				$video_slug  = get_post_field( 'post_name', $video_id );
				$video_date  = apply_filters( 'rtgodam_dynamic_gallery_video_date', get_the_date( 'F j, Y', $video_id ), $video_id );
	
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

				// Check if engagements are enabled for the video.
				$engagements_enabled = $atts['engagements'];

				if ( ! $engagements_enabled ) {
					$item_engagements_enabled = false;
				} else {
					// Check if engagements are enabled for the video is transcoded.
					$transcoded_job_id        = get_post_meta( $video_id, 'rtgodam_transcoding_job_id', true );
					$tanscoded_status         = get_post_meta( $video_id, 'rtgodam_transcoding_status', true );
					$item_engagements_enabled = ! empty( $transcoded_job_id ) && 'transcoded' === $tanscoded_status;
				}

				// Build the query arguments for the video embed page.
				$query_args = array(
					'godam_page' => 'video-embed',
					'id'         => $video_id,
				);

				// Add the engagements query argument if it is enabled.
				if ( $item_engagements_enabled ) {
					$query_args['engagements'] = 'show';
				}

				$video_url = add_query_arg( $query_args, $cpt_base_url );

				echo '<div class="godam-video-item">';
				echo '<div class="godam-video-thumbnail" data-video-id="' . esc_attr( $video_id ) . '" data-video-url="' . esc_url( $video_url ) . '">';
				echo '<img src="' . esc_url( $thumbnail ) . '" alt="' . esc_attr( $video_title ) . '" />';
				if ( $duration ) {
					echo '<span class="godam-video-duration">' . esc_html( $duration ) . '</span>';
				}
				echo '</div>';
	
				if ( ! empty( $atts['show_title'] ) ) {
					echo '<div class="godam-video-info">';
					echo '<div class="godam-video-title">' . esc_html( $video_title ) . '</div>';
					echo '<div class="godam-video-date">' . esc_html( $video_date ) . '</div>';
					echo '</div>';
				}
				echo '</div>';
	
				do_action( 'rtgodam_dynamic_gallery_after_video_item', $video, $atts );
			}
	
			if ( intval( $atts['offset'] ) === 0 ) {
				echo '</div>';
			}
	
			do_action( 'rtgodam_dynamic_gallery_after_output', $query, $atts );
		}
	
		$html = ob_get_clean();
		$html = apply_filters( 'rtgodam_dynamic_gallery_html', $html, $query, $atts );
	
		return new WP_REST_Response(
			array(
				'status' => 'success',
				'html'   => $html,
			),
			200
		);
	}
}
