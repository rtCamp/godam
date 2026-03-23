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
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_block_assets' ) );
	}

	/**
	 * Enqueue Block Assets.
	 *
	 * @return void
	 */
	public function enqueue_block_assets() {

		// Check for WooCommerce activation status.
		wp_add_inline_script(
			'godam-product-gallery-editor-script',
			'window.RTGoDAMProductGalleryBlockSettings = { isWooActive: ' . ( is_plugin_active( 'woocommerce/woocommerce.php' ) ? 'true' : 'false' ) . ' };',
			'before'
		);

		wp_enqueue_style(
			'godam-product-editor-gallery-style',
			RTGODAM_URL . 'assets/build/integrations/woocommerce/css/godam-product-editor-gallery.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/integrations/woocommerce/css/godam-product-editor-gallery.css' )
		);
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
			RTGODAM_PATH . '/assets/build/blocks/godam-gallery/'
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
