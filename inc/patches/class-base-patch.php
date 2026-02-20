<?php
/**
 * Base class for versioned plugin patches.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Patches;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Base_Patch
 */
abstract class Base_Patch {
	use Singleton;

	/**
	 * Constructor.
	 *
	 * @since n.e.x.t
	 */
	final protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Register WordPress hooks for a patch.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	protected function setup_hooks() {
	}

	/**
	 * Return unique patch ID.
	 *
	 * @since n.e.x.t
	 *
	 * @return string
	 */
	abstract public function get_patch_id();

	/**
	 * Return target plugin version for this patch.
	 *
	 * @since n.e.x.t
	 *
	 * @return string
	 */
	abstract public function get_target_version();

	/**
	 * Schedule or execute patch processing.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	abstract public function maybe_schedule();
}
