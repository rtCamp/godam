<?php
/**
 * PHP render form Recorder Block.
 *
 * @since 1.3.0
 *
 * @package GoDAM.
 */

namespace RTGODAM\Inc\SureForms\Blocks\Recorder;

/**
 * SureForms blocks base class.
 */
use SRFM\Inc\Blocks\Base;

/**
 * Recorder Block.
 *
 * @since 1.3.0
 */
class Block extends Base {

	/**
	 * Register the field for sureforms.
	 *
	 * @since 1.3.0
	 *
	 * @return void
	 */
	public function register() {
		register_block_type(
			RTGODAM_PATH . '/assets/build/blocks/sureforms/blocks/recorder/'
		);
	}
}
