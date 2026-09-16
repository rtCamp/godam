<?php
/**
 * Class to handle file system.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Blocks
 */
class Blocks {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {

		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	public function setup_hooks() {
		add_action( 'init', array( $this, 'register_blocks' ) );
	}

	/**
	 * Register all custom gutenberg blocks.
	 *
	 * @return void
	 */
	public function register_blocks() {

		// Register blocks.
		register_block_type(
			RTGODAM_PATH . '/assets/build/blocks/godam-player/'
		);

		register_block_type(
			RTGODAM_PATH . '/assets/build/blocks/godam-audio/'
		);

		register_block_type(
			RTGODAM_PATH . '/assets/build/blocks/godam-image/'
		);

		// The godam/image block draws hotspot / product-hotspot markers using the
		// shared player stylesheet (`.easydam-layer` / `.hotspot` rules live there,
		// unscoped). Tie it to the block via wp_enqueue_block_style so WordPress
		// prints it reliably whenever the block renders — including block themes /
		// FSE, where a late wp_enqueue_style() from render.php is not printed.
		//
		// `godam-player-style` depends on `godam-player-wrapper-style` (the player
		// placeholder / poster / aspect-ratio rules), a dependency declared where
		// the player registers its scripts (class-godam-player.php), on
		// `wp_enqueue_scripts`. On classic themes, `enqueue_block_assets` fires at
		// the very start of `wp_enqueue_scripts`, so this block-style callback
		// registers `godam-player-style` FIRST — and a later wp_register_style()
		// for an already-registered handle is a silent no-op, which would drop the
		// wrapper dependency. That left a page carrying both a godam/video and a
		// godam/image block with the player's aspect-ratio CSS missing, so the
		// video poster rendered at its natural (oversized) height. Declaring the
		// same dependency here keeps it regardless of which registration wins the
		// race; the wrapper handle itself is registered by the always-booted
		// player shortcode class, so it resolves at print time.
		if ( function_exists( 'wp_enqueue_block_style' ) ) {
			$godam_player_css = RTGODAM_PATH . 'assets/build/css/godam-player.css';
			wp_enqueue_block_style(
				'godam/image',
				array(
					'handle' => 'godam-player-style',
					'src'    => RTGODAM_URL . 'assets/build/css/godam-player.css',
					'deps'   => array( 'godam-player-wrapper-style' ),
					'path'   => $godam_player_css,
					'ver'    => file_exists( $godam_player_css ) ? filemtime( $godam_player_css ) : RTGODAM_VERSION,
				)
			);
		}

		register_block_type(
			RTGODAM_PATH . '/assets/build/blocks/godam-gallery-v2/'
		);

		register_block_type(
			RTGODAM_PATH . '/assets/build/blocks/godam-gallery-v2-item/'
		);

		register_block_type(
			RTGODAM_PATH . '/assets/build/blocks/godam-video-thumbnail/'
		);

		register_block_type(
			RTGODAM_PATH . '/assets/build/blocks/godam-video-duration/'
		);

		register_block_type(
			RTGODAM_PATH . '/assets/build/blocks/godam-pdf/'
		);
	}
}
