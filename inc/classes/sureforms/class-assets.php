<?php
/**
 * Extend SureForms.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Sureforms;

use RTGODAM\Inc\Traits\Singleton;

use WP_Post;

defined( 'ABSPATH' ) || exit;

/**
 * Class Assets.
 */
class Assets {

	use Singleton;

	/**
	 * Constructor.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * To check if sureforms plugins is active.
	 *
	 * @return void
	 */
	private function setup_hooks() {

		/**
		 * Enqueue the script if we have sureforms.
		 */
		add_action( 'wp_enqueue_scripts', array( $this, 'register_scripts' ) );
	}

	/**
	 * Function to enqueue script related to recorder field.
	 *
	 * @return void
	 */
	public function register_scripts() {

		/**
		 * Get current post to check.
		 */
		$current_post = get_post();

		if ( $current_post instanceof WP_Post ) {
			$load_assets = ( SRFM_FORMS_POST_TYPE === $current_post->post_type || ( false !== strpos( $current_post->post_content, 'wp:srfm/form' ) || has_shortcode( $current_post->post_content, 'sureforms' ) ) );
			$is_godam    = false !== strpos( $current_post->post_content, 'wp:godam/video' ) || false !== strpos( $current_post->post_content, 'wp:godam/gallery' ) || has_shortcode( $current_post->post_content, 'godam_video' );

			/**
			 * Return if we do not have godam, sureforms.
			 */
			if ( ! $load_assets && ! $is_godam ) {
				return;
			}

			if ( ! wp_script_is( 'godam-recorder-script' ) ) {
				/**
				 * Enqueue script if not already enqueued.
				 */
				wp_enqueue_script(
					'godam-recorder-script',
					RTGODAM_URL . 'assets/build/js/godam-recorder.min.js',
					array( 'jquery' ),
					filemtime( RTGODAM_PATH . 'assets/build/js/godam-recorder.min.js' ),
					true
				);
			}

			if ( ! wp_script_is( 'godam-uppy-video-style' ) ) {
				/**
				 * Enqueue style for the uppy video.
				 */
				wp_enqueue_style(
					'godam-uppy-video-style',
					RTGODAM_URL . 'assets/build/css/gf-uppy-video.css',
					array(),
					filemtime( RTGODAM_PATH . 'assets/build/css/gf-uppy-video.css' )
				);
			}
		}
	}
}
