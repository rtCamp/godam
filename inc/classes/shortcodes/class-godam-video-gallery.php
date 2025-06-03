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
				'count'             => 6,
				'orderby'           => 'date',
				'order'             => 'DESC',
				'columns'           => 3,
				'layout'            => 'grid',
				'infinite_scroll'   => false,
				'category'          => '',
				'tag'               => '',
				'author'            => 0,
				'date_range'        => '',
				'include'           => '',
				'search'            => '',
				'custom_date_start' => '',
				'custom_date_end'   => '',
				'show_title'        => true,
				'align'             => '',
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
						$date_query = array(
							'after'     => $atts['custom_date_start'],
							'before'    => $atts['custom_date_end'],
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
			$args['meta_key'] = '_video_duration';
			$args['orderby']  = 'meta_value_num';
		} elseif ( 'size' === $atts['orderby'] ) {
			$args['meta_key'] = '_wp_attached_file';
			$args['orderby']  = 'meta_value_num';
		}

		$query = new \WP_Query( $args );

		ob_start();

		if ( $query->have_posts() ) {
			// Calculate these values before using them.
			$total_videos = $query->found_posts;
			$shown_videos = count( $query->posts );

			$alignment_class = ! empty( $atts['align'] ) ? ' align' . $atts['align'] : '';
			echo '<div class="godam-video-gallery layout-' . esc_attr( $atts['layout'] ) . ' columns-' . intval( $atts['columns'] ) . esc_attr( $alignment_class ) . '" 
				data-infinite-scroll="' . esc_attr( $atts['infinite_scroll'] ) . '"
				data-offset="' . esc_attr( $shown_videos ) . '"
				data-columns="' . esc_attr( $atts['columns'] ) . '"
				data-orderby="' . esc_attr( $atts['orderby'] ) . '"
				data-order="' . esc_attr( $atts['order'] ) . '"
				data-total="' . esc_attr( $total_videos ) . '">';
			foreach ( $query->posts as $video ) {
				$video_id    = intval( $video->ID );
				$video_title = get_the_title( $video_id );
			
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
				echo '<img src="' . esc_url( $thumbnail ) . '" alt="' . esc_attr( $video_title ) . '" />';
				if ( $duration ) {
					echo '<span class="godam-video-duration">' . esc_html( $duration ) . '</span>';
				}
				echo '</div>';
				if ( ! empty( $atts['show_title'] ) ) {
					echo '<div class="godam-video-title">' . esc_html( $video_title ) . '</div>';
				}
				echo '</div>';
			}
			echo '</div>';


			if ( $shown_videos < $total_videos ) {
				if ( ! $atts['infinite_scroll'] ) {
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
				echo '<div class="godam-spinner-container"><div class="godam-spinner"></div></div>';
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
