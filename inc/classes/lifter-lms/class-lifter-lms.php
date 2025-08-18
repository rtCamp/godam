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
	 * Constant LifterLMS Advanced Video autoplay option.
	 *
	 * @var string
	 */
	const LLMS_AV_PROG_AUTO_PLAY_OPTION = 'llms_av_prog_auto_play';

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

		add_filter( 'godam_player_block_attributes', array( $this, 'modify_godam_player_block_attributes' ) );

		add_filter( 'lifterlms_available_integrations', array( $this, 'add_godam_integration' ) );
	}

	/**
	 * Check if LifterLMS plugin is active.
	 *
	 * @return bool
	 */
	public function is_lifterlms_active(): bool {

		if ( function_exists( 'is_plugin_active' ) && ! is_plugin_active( 'lifterlms/lifterlms.php' ) ) {
			return false;
		}

		return true;
	}

	/**
	 * Check if LifterLMS Advanced Video plugin is active.
	 *
	 * @return bool
	 */
	public function is_lifterlms_advanced_video_active(): bool {
		// Check if LifterLMS Advanced Video plugin is active.
		if ( function_exists( 'is_plugin_active' ) && ! is_plugin_active( 'lifterlms-advanced-videos/lifterlms-advanced-videos.php' ) ) {
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
	 * Check if the current post is a LifterLMS lesson.
	 *
	 * @return bool
	 */
	public function is_lifterlms_lesson(): bool {
		if ( function_exists( 'is_lesson' ) && is_lesson() ) {
			return true;
		}

		return false;
	}

	/**
	 * Check if the autoplay is enabled.
	 *
	 * @return bool
	 */
	public function is_lifterlms_autoplay_on(): bool {
		return 'no' !== get_option( self::LLMS_AV_PROG_AUTO_PLAY_OPTION, 'no' );
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
		if ( $this->is_lifterlms_active() && $this->is_lifterlms_advanced_video_active() && $this->is_lifterlms_content() && $this->has_godam_video_block() ) {
			wp_enqueue_script( 'rtgodam-lifterlms-integration', RTGODAM_URL . 'assets/build/js/godam-lifterlms-block.min.js', array( 'jquery' ), filemtime( RTGODAM_PATH . 'assets/build/js/lifterlms/block-integration.min.js' ), true );
		}

		if ( $this->is_lifterlms_active() && $this->is_lifterlms_advanced_video_active() && $this->is_lifterlms_content() ) {
			wp_enqueue_script( 'rtgodam-player-sdk', RTGODAM_URL . 'assets/build/js/godam-player-sdk.min.js', array(), filemtime( RTGODAM_PATH . 'assets/build/js/godam-player/godam-player-sdk.min.js' ), true );
			wp_enqueue_script( 'rtgodam-lifterlms-integration', RTGODAM_URL . 'assets/build/js/godam-lifterlms-embed.min.js', array( 'jquery' ), filemtime( RTGODAM_PATH . 'assets/build/js/lifterlms/embed-integration.min.js' ), true );
		}
	}

	/**
	 * Add autoplay attribute to Godam Player Block attributes,
	 * if LifterLMS is active and on a lesson page with autoplay enabled.
	 *
	 * @param mixed $attributes Block attributes.
	 *
	 * @return mixed
	 */
	public function modify_godam_player_block_attributes( $attributes ) {
		if ( $this->is_lifterlms_active() && $this->is_lifterlms_advanced_video_active() && $this->is_lifterlms_lesson() && $this->is_lifterlms_autoplay_on() ) {
			$attributes['autoplay'] = true;
		}

		return $attributes;
	}

	/**
	 * Add GoDAM integration to LifterLMS available integrations.
	 *
	 * @param array $integrations Array of available integrations.
	 *
	 * @return mixed
	 */
	public function add_godam_integration( array $integrations ) {
		if ( $this->is_lifterlms_active() && $this->is_lifterlms_advanced_video_active() ) {
			$integrations['av_godam'] = new LLMS_AV_Integration_GoDAM();
		}

		return $integrations;
	}
}
