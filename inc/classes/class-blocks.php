<?php
/**
 * Class to handle file system.
 *
 * @package transcoder
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

		// Register example-block Block.
		register_block_type(
			RTGODAM_PATH . '/assets/build/blocks/godam-player/'
		);
	}
}
