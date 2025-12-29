<?php
/**
 * GoDAM video embed page class.
 *
 * @package godam
 * @since 1.2.0
 */

namespace RTGODAM\Inc;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Video_Embed
 */
class Video_Embed {

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
		add_action( 'template_include', array( $this, 'rtgodam_load_video_embed_template' ) );
		add_action( 'wp_enqueue_scripts', array( $this, 'rtgodam_enqueue_video_embed_assets' ) );
		add_filter( 'show_admin_bar', array( $this, 'rtgodam_hide_admin_bar_on_embed' ) ); // phpcs:ignore WordPressVIPMinimum.UserExperience.AdminBarRemoval.RemovalDetected -- This is a valid use case for the video embed page.
		add_filter( 'qm/dispatch/html', array( $this, 'rtgodam_disable_query_monitor_on_embed' ) );
	}

	/**
	 * Load the video embed template.
	 * 
	 * @since 1.2.0
	 * 
	 * @param string $template The current template.
	 * @return string The path to the video embed template.
	 */
	public function rtgodam_load_video_embed_template( $template ) {
		if ( 'video-embed' === get_query_var( 'godam_page' ) ) {
			return RTGODAM_PATH . 'inc/templates/video-embed.php';
		}
		return $template;
	}

	/**
	 * Enqueue assets for the video embed page.
	 * 
	 * @since 1.2.0
	 * 
	 * This method registers the styles needed for the video embed page.
	 */
	public function rtgodam_enqueue_video_embed_assets() {
		// Enqueue style for the video embed page.
		wp_register_style(
			'godam-video-embed-style',
			RTGODAM_URL . 'assets/build/css/godam-video-embed.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/godam-video-embed.css' )
		);
	}

	/**
	 * Hide the admin bar on the video embed page.
	 * 
	 * @since 1.2.0
	 * 
	 * @param bool $show_admin_bar Whether to show the admin bar.
	 * @return bool False if on embed page, otherwise the original value.
	 */
	public function rtgodam_hide_admin_bar_on_embed( $show_admin_bar ) {
		if ( 'video-embed' === get_query_var( 'godam_page' ) ) {
			return false;
		}
		return $show_admin_bar;
	}

	/**
	 * Disable Query Monitor on the video embed page.
	 * 
	 * @since 1.2.0
	 * 
	 * @param bool $dispatch Whether to dispatch Query Monitor output.
	 * @return bool False if on embed page, otherwise the original value.
	 */
	public function rtgodam_disable_query_monitor_on_embed( $dispatch ) {
		if ( 'video-embed' === get_query_var( 'godam_page' ) ) {
			return false;
		}
		return $dispatch;
	}
}
