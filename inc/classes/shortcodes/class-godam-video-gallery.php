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

		$asset_file = RTGODAM_PATH . 'assets/build/js/godam-gallery.min.asset.php';
		$godam_gallery_script_assets = array(
			'dependencies' => array(),
			'version'      => RTGODAM_VERSION,
		);

		if ( file_exists( $asset_file ) ) {
			$maybe_asset = include $asset_file;
			if ( is_array( $maybe_asset ) ) {
				$godam_gallery_script_assets = wp_parse_args(
					$maybe_asset,
					array( 'dependencies' => array(), 'version' => RTGODAM_VERSION )
				);
			}
		}

		wp_register_script(
			'godam-gallery-script',
			RTGODAM_URL . 'assets/build/js/godam-gallery.min.js',
			$godam_gallery_script_assets['dependencies'],
			$godam_gallery_script_assets['version'],
			true
		);
	}

	/**
	 * Render the video gallery shortcode.
	 *
	 * @param array $atts Shortcode attributes.
	 * @return string HTML output of the gallery.
	 */
	public function render( $atts ) {
		// Add filter for default attributes.
		$default_atts = apply_filters(
			'rtgodam_gallery_default_attributes',
			array(
				'count'             => 6,
				'orderby'           => 'date',
				'order'             => 'DESC',
				'columns'           => 3,
				'layout'            => 'grid',
				'infinite_scroll'   => false,
				'category'          => '',
				'tag'               => '',
				'media_folder'      => '',
				'author'            => 0,
				'date_range'        => '',
				'include'           => '',
				'search'            => '',
				'custom_date_start' => '',
				'custom_date_end'   => '',
				'show_title'        => true,
				'align'             => '',
				'engagements'       => true,
				'open_to_new_page'  => false,
			)
		);

		$atts                     = shortcode_atts( $default_atts, $atts, 'godam_video_gallery' );
		$video_post_settings      = get_option( 'rtgodam_video_post_settings', array() );
		$godam_allow_single_video = isset( $video_post_settings['allow_single'] ) ? $video_post_settings['allow_single'] : false;

		if ( ! $godam_allow_single_video ) {
			$atts['open_to_new_page'] = false;
		}

		// Add filter for processed attributes.
		$atts = apply_filters( 'rtgodam_gallery_attributes', $atts );

		wp_enqueue_style( 'godam-gallery-style' );

		wp_enqueue_script( 'godam-gallery-script' );

		if ( ! is_admin() ) {
			wp_enqueue_script( 'godam-player-frontend-script' );
			wp_enqueue_script( 'godam-player-analytics-script' );
			wp_enqueue_style( 'godam-player-frontend-style' );
			wp_enqueue_style( 'godam-player-style' );
		}

		$args = array(
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'post_mime_type' => 'video',
			'posts_per_page' => intval( $atts['count'] ),
			'orderby'        => sanitize_text_field( $atts['orderby'] ),
			'order'          => sanitize_text_field( $atts['order'] ),
		);

		// Add filter for query arguments.
		$args = apply_filters( 'rtgodam_gallery_query_args', $args, $atts );

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

		// Add media_folder filter.
		if ( ! empty( $atts['media_folder'] ) ) {
			$args['tax_query'][] = array(
				'taxonomy' => 'media-folder',
				'field'    => 'term_id',
				'terms'    => intval( $atts['media_folder'] ),
			);
		}

		// Add author filter.
		if ( ! empty( $atts['author'] ) ) {
			$args['author'] = intval( $atts['author'] );
		}

		// Add date range filter.
		if ( ! empty( $atts['date_range'] ) ) {
			$date_query = array();
			switch ( $atts['date_range'] ) {
				case '7days':
					$date_query = array(
						'after' => '1 week ago',
					);
					break;
				case '30days':
					$date_query = array(
						'after' => '1 month ago',
					);
					break;
				case '90days':
					$date_query = array(
						'after' => '3 months ago',
					);
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

		// Add include filter.
		if ( ! empty( $atts['include'] ) ) {
			$args['post__in'] = array_map( 'intval', explode( ',', $atts['include'] ) );
		}

		// Add search filter.
		if ( ! empty( $atts['search'] ) ) {
			$args['s'] = $atts['search'];
		}

		// Handle custom orderby options.
		if ( 'duration' === $atts['orderby'] ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Required for sorting by video duration.
			$args['meta_key'] = '_video_duration';
			$args['orderby']  = 'meta_value_num';
		} elseif ( 'size' === $atts['orderby'] ) {
			// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Required for sorting by video file size.
			$args['meta_key'] = '_video_file_size';
			$args['orderby']  = 'meta_value_num';
		}

		$video_settings = get_option( 'rtgodam_video_post_settings', array() );
		$cpt_url_slug   = ! empty( $video_settings['video_slug'] ) ? sanitize_title( $video_settings['video_slug'] ) : 'videos';
		$cpt_base_url   = home_url( '/' );

		$query = new \WP_Query( $args );

		ob_start();

		if ( $query->have_posts() ) {
			// Add action before gallery output.
			do_action( 'rtgodam_gallery_before_output', $query, $atts );

			$godam_figure_attributes = get_block_wrapper_attributes(
				array(
					'class' => 'godam-video-gallery-wrapper',
				)
			);

			// Calculate these values before using them.
			$total_videos = $query->found_posts;
			$shown_videos = count( $query->posts );

			echo '<div ' . wp_kses_data( $godam_figure_attributes ) . '>';
			echo '<div class="godam-video-gallery layout-' . esc_attr( $atts['layout'] ) .
				( 'grid' === $atts['layout'] ? ' columns-' . intval( $atts['columns'] ) : '' ) . '"
				data-infinite-scroll="' . esc_attr( $atts['infinite_scroll'] ) . '"
				data-offset="' . esc_attr( $shown_videos ) . '"
				data-columns="' . esc_attr( $atts['columns'] ) . '"
				data-orderby="' . esc_attr( $atts['orderby'] ) . '"
				data-order="' . esc_attr( $atts['order'] ) . '"
				data-total="' . esc_attr( $total_videos ) . '"
				data-show-title="' . ( $atts['show_title'] ? '1' : '0' ) . '"
				data-layout="' . esc_attr( $atts['layout'] ) . '"
				data-search="' . esc_attr( $atts['search'] ) . '"
				data-category="' . esc_attr( $atts['category'] ) . '"
				data-tag="' . esc_attr( $atts['tag'] ) . '"
				data-author="' . esc_attr( $atts['author'] ) . '"
				data-include="' . esc_attr( $atts['include'] ) . '"
				data-date-range="' . esc_attr( $atts['date_range'] ) . '"
				data-custom-date-start="' . esc_attr( $atts['custom_date_start'] ) . '"
				data-custom-date-end="' . esc_attr( $atts['custom_date_end'] ) . '"
				data-engagements="' . esc_attr( $atts['engagements'] ) . '"
				data-open-to-new-page="' . esc_attr( $atts['open_to_new_page'] ) . '"
			>';
			foreach ( $query->posts as $video ) {
				// Add action before each video item.
				do_action( 'rtgodam_gallery_before_video_item', $video, $atts );

				$video_id    = intval( $video->ID );
				$video_title = get_the_title( $video_id );
				$video_slug  = get_post_field( 'post_name', $video_id );
				$video_date  = get_the_date( 'F j, Y', $video_id );

				// Add filter for video title.
				$video_title = apply_filters( 'rtgodam_gallery_video_title', $video_title, $video_id );

				// Add filter for video date format.
				$video_date = apply_filters( 'rtgodam_gallery_video_date', $video_date, $video_id );

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

				// Check if engagements are enabled for the video.
				$engagements_enabled      = $atts['engagements'];
				$item_engagements_enabled = false;
				if ( $engagements_enabled ) {
					// Check if the video is transcoded when engagements are enabled.
					$transcoded_job_id        = get_post_meta( $video_id, 'rtgodam_transcoding_job_id', true );
					$transcoded_status        = get_post_meta( $video_id, 'rtgodam_transcoding_status', true );
					$item_engagements_enabled = ! empty( $transcoded_job_id ) && 'transcoded' === strtolower( $transcoded_status );
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

				if ( isset( $atts['open_to_new_page'] ) && $atts['open_to_new_page'] ) {
					$video_slug     = get_post_field( 'post_name', $video_id );
					$video_settings = get_option( 'rtgodam_video_post_settings', array() );
					$cpt_url_slug   = ! empty( $video_settings['video_slug'] ) ? sanitize_title( $video_settings['video_slug'] ) : 'videos';
					$cpt_base_url   = home_url( '/' . $cpt_url_slug );
					$video_url      = $cpt_base_url . '/' . $video_slug;

					if ( $item_engagements_enabled ) {
						$video_url = add_query_arg(
							array(
								'engagements' => 'show',
							),
							$video_url
						);
					}
				}

				echo '<div class="godam-video-item">';
				echo '<div class="godam-video-thumbnail" data-gallery-item-engagements="' . esc_attr( $item_engagements_enabled ? 'true' : 'false' ) . '" data-video-id="' . esc_attr( $video_id ) . '" data-video-url="' . esc_url( $video_url ) . '">';
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

				// Add action after each video item.
				do_action( 'rtgodam_gallery_after_video_item', $video, $atts );
			}
			echo '</div>';

			if ( $shown_videos < $total_videos ) {
				if ( ! $atts['infinite_scroll'] ) {
					echo '<button
						class="godam-load-more wp-element-button"
						data-offset="' . esc_attr( $shown_videos ) . '"
						data-columns="' . esc_attr( $atts['columns'] ) . '"
						data-count="' . esc_attr( $atts['count'] ) . '"
						data-orderby="' . esc_attr( $atts['orderby'] ) . '"
						data-order="' . esc_attr( $atts['order'] ) . '"
						data-total="' . esc_attr( $total_videos ) . '"
						data-engagements="' . esc_attr( $atts['engagements'] ) . '"
						data-open-to-new-page="' . esc_attr( $atts['open_to_new_page'] ) . '"
					>' . esc_html__( 'Load More', 'godam' ) . '</button>';
				}
				echo '<div class="godam-spinner-container"><div class="godam-spinner"></div></div>';
			}

			echo '</div>';

			echo '
			<div id="godam-video-modal" class="godam-modal hidden">
				<div class="godam-modal-overlay"></div>
				<div class="godam-modal-content">
					<div class="easydam-video-container animate-video-loading"></div>
					<div class="godam-modal-footer">
						<div class="godam-video-info">
							<h3 class="godam-video-title"></h3>
							<span class="godam-video-date"></span>
						</div>
					</div>
				</div>
			</div>';

			// Add action after gallery output.
			do_action( 'rtgodam_gallery_after_output', $query, $atts );
		} else {
			echo '<p>' . esc_html__( 'No videos found.', 'godam' ) . '</p>';
		}

		wp_reset_postdata();
		return ob_get_clean();
	}
}
