<?php
/**
 * LifterLMS integration class for GoDAM plugin.
 * Loads required integration script.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Lifter_LMS;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Lifter_LMS
 */
class Lifter_LMS {

	use Singleton;

	/**
	 * Constructor.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup WordPress hooks and filters.
	 */
	private function setup_hooks() {
		add_action( 'wp_enqueue_scripts', array( $this, 'load_lifterlms_integration_script' ) );
	}

	/**
	 * Check if LifterLMS plugin is active.
	 *
	 * @return bool
	 */
	public function is_lifterlms_active(): bool {
		// Check if LifterLMS plugin is active.
		if ( ! is_plugin_active( 'lifterlms/lifterlms.php' ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Check if the current content is LifterLMS content (lesson, quiz, course).
	 *
	 * @return bool
	 */
	public function is_lifterlms_content(): bool {
		if ( function_exists( 'is_lifterlms' ) && is_lifterlms() ) {
			return true;
		}

		return false;
	}

	/**
	 * Check if the current post has a Godam video block.
	 *
	 * @return bool
	 */
	public function has_godam_video_block(): bool {
		$post_id = get_the_ID();
		if ( ! $post_id ) {
			return false;
		}
		$blocks = parse_blocks( get_post( $post_id )->post_content );

		foreach ( $blocks as $block ) {
			if ( 'godam/video' === $block['blockName'] ) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Load LifterLMS integration script.
	 *
	 * @return void
	 */
	public function load_lifterlms_integration_script() {
		// Load LifterLMS integration script only if LifterLMS is active, the content is LifterLMS, and the Godam video block is present.
		if ( $this->is_lifterlms_active() && $this->is_lifterlms_content() && $this->has_godam_video_block() ) {
			wp_enqueue_script( 'rtgodam-lifterlms-integration', RTGODAM_URL . 'assets/src/js/lifterlms/index.js', array( 'jquery' ), filemtime( RTGODAM_PATH . 'assets/src/js/lifterlms/index.js' ), true );
		}
	}
}
