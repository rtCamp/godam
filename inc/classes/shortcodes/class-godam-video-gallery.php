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
				'count'   => -1,
				'orderby' => 'date',
				'order'   => 'DESC',
				'columns' => 3,
				'layout'  => 'grid',
			),
			$atts,
			'godam_video_gallery'
		);

		wp_enqueue_style( 'godam-gallery-style' );

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
				echo '<div class="godam-video-item">';
				echo do_shortcode( '[godam_video id="' . intval( $video->ID ) . '"]' );
				echo '</div>';
			}
			echo '</div>';
		} else {
			echo '<p>' . esc_html__( 'No videos found.', 'godam' ) . '</p>';
		}

		wp_reset_postdata();
		return ob_get_clean();
	}
}
