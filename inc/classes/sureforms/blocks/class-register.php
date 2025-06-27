<?php
/**
 * Extend SureForms.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\SureForms\Blocks;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Register.
 */
class Register {

	use Singleton;

	/**
	 * Constructor.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks for sureforms.
	 *
	 * @return void
	 */
	public function setup_hooks() {

		/**
		 * Filter to register new block as fields for sureforms.
		 */
		add_filter( 'srfm_register_additional_blocks', array( $this, 'add_additional_blocks' ) );
	}

	/**
	 * Function to add the additional blocks as fields for SureForms.
	 *
	 * @param array $blocks Blocks to be registered.
	 *
	 * @return array
	 */
	public function add_additional_blocks( $blocks ) {

		/**
		 * Add all the blocks.
		 */
		$new_blocks[] = array(
			'dir'       => RTGODAM_PATH . 'inc/classes/sureforms/blocks/**/*.php',
			'namespace' => 'RTGODAM\\Inc\\SureForms\\Blocks',
		);

		/**
		 * Merge the custom and incoming blocks.
		 */
		$blocks = array( ...$blocks, ...$new_blocks );

		return $blocks;
	}
}
