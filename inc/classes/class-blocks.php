<?php
/**
 * Class to handle file system.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;
use RTGODAM\Inc\Layers\Layer_Type_Registry;

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
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_image_layer_view_scripts' ) );
		add_action( 'enqueue_block_assets', array( $this, 'enqueue_image_layer_view_styles' ) );
	}

	/**
	 * Load the `style` and `viewStyle` of layer types that run on images into
	 * the block editor canvas, where the godam/image block draws its preview.
	 *
	 * The canvas is an iframe that gets the styles enqueued on
	 * `enqueue_block_assets`, not those of the editor window. On the front end
	 * the block loads them itself, only for the layers it shows.
	 *
	 * @since 2.9.0
	 *
	 * @return void
	 */
	public function enqueue_image_layer_view_styles() {
		if ( ! is_admin() ) {
			return;
		}
		Layer_Type_Registry::get_instance()->enqueue_view_styles_for_media( 'image' );
	}

	/**
	 * Load the view scripts of layer types that run on images, for the
	 * godam/image block's preview. The block's edit script draws the layers in
	 * the editor window, so the layer runtimes must be registered there.
	 *
	 * @return void
	 */
	public function enqueue_image_layer_view_scripts() {
		Layer_Type_Registry::get_instance()->enqueue_view_scripts_for_media( 'image' );
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
		// race. GoDAM_Player::register_player_styles() registers both handles on
		// `init`, so the dependency also resolves in the block editor canvas, whose
		// styles are collected before `admin_enqueue_scripts` registers anything.
		if ( function_exists( 'wp_enqueue_block_style' ) ) {
			// The block editor prints its iframe styles while the edit screen
			// renders, before `admin_enqueue_scripts` runs register_scripts() in
			// the player class. Without this the editor logs a "dependencies that
			// are not registered" notice for `godam-player-style` on WP 6.9.1+.
			// Same handle and file as the player class, which then skips it.
			$godam_wrapper_css = RTGODAM_PATH . 'assets/build/css/godam-player-wrapper.css';
			if ( ! wp_style_is( 'godam-player-wrapper-style', 'registered' ) && file_exists( $godam_wrapper_css ) ) {
				wp_register_style(
					'godam-player-wrapper-style',
					RTGODAM_URL . 'assets/build/css/godam-player-wrapper.css',
					array(),
					filemtime( $godam_wrapper_css )
				);
			}

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
