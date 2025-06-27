<?php
/**
 * PHP render form Recorder Block.
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
 */
class Block extends Base {

	/**
	 * Register the field for sureforms.
	 *
	 * @return void
	 */
	public function register() {
		register_block_type(
			RTGODAM_PATH . '/assets/build/blocks/sureforms/blocks/recorder/'
		);
	}
}
