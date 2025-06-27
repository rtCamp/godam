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
	 * Render the block
	 *
	 * @param array<mixed> $attributes Block attributes.
	 *
	 * @return string|bool
	 */
	public function render( $attributes ) {
		ob_start();
		// phpcs:ignore
		echo 'This is from recorder field.';
		return ob_get_clean();
	}
}
