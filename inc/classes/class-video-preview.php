<?php
/**
 * GoDAM video editor preview page class.
 *
 * @package godam
 * @since 1.2.0
 */

namespace RTGODAM\Inc;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Rewrite
 */
class Video_Preview {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * To setup action/filter.
	 *
	 * @since 1.2.0
	 * 
	 * @return void
	 */
	protected function setup_hooks() {
		add_action( 'template_include', array( $this, 'rtgodam_load_video_preview_template' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'rtgodam_enqueue_video_preview_assets' ) );
	}

	/**
	 * Load the video preview template.
	 * 
	 * @since 1.2.0
	 * 
	 * @param string $template The current template.
	 * @return string The path to the video preview template.
	 */
	public function rtgodam_load_video_preview_template( $template ) {
		if ( 'video-preview' === get_query_var( 'godam_page' ) ) {
			return RTGODAM_PATH . 'inc/templates/video-preview.php';
		}
		return $template;
	}

	/**
	 * Enqueue assets for the video preview page.
	 * 
	 * @since 1.2.0
	 * 
	 * This method registers the styles needed for the video preview page.
	 */
	public function rtgodam_enqueue_video_preview_assets() {
		// Enqueue style and script for the video preview page.
		wp_register_style(
			'godam-video-preview-style',
			RTGODAM_URL . 'assets/build/css/godam-video-preview.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/godam-video-preview.css' )
		);
	}
}
