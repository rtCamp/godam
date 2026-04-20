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
		$inline_script         = 'window.RTGoDAMProductGalleryBlockSettings = { isWooActive: ' . ( is_plugin_active( 'woocommerce/woocommerce.php' ) ? 'true' : 'false' ) . ' };';
		$editor_script_handles = array(
			'godam-video-product-gallery-editor-script',
			'godam-product-gallery-editor-script',
		);
		foreach ( $editor_script_handles as $editor_script_handle ) {
			if ( wp_script_is( $editor_script_handle, 'registered' ) ) {
				wp_add_inline_script(
					$editor_script_handle,
					$inline_script,
					'before'
				);
				break;
			}
		}
	}

	/**
	 * Register all custom gutenberg blocks.
	 *
	 * @return void
	 */
	public function register_blocks() {

		/**
		 * Allow block availability for Author and above on editor.
		 */
		if ( is_admin() && ! current_user_can( 'publish_posts' ) ) {
			return;
		}

		// Register blocks.
		register_block_type(
			RTGODAM_PATH . '/assets/build/blocks/godam-player/'
		);

		register_block_type(
			RTGODAM_PATH . '/assets/build/blocks/godam-audio/'
		);

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
