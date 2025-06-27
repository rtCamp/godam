<?php
/**
 * Extend SureForms.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Sureforms;

use RTGODAM\Inc\Traits\Singleton;
use RTGODAM\Inc\SureForms\Blocks\Register;

defined( 'ABSPATH' ) || exit;

/**
 * Class Init.
 */
class Init {

	use Singleton;

	/**
	 * Is SureForms active?
	 *
	 * @access private
	 * @var bool
	 */
	private $is_sureforms_active = false;

	/**
	 * Constructor.
	 */
	protected function __construct() {

		$this->is_sureforms_active = $this->check_sureforms_active();

		/**
		 * Add only if sureforms is active.
		 */
		if ( $this->is_sureforms_active ) {
			$this->load_sureforms_classes();
		}
	}

	/**
	 * To check if sureforms plugins is active.
	 *
	 * @return bool
	 */
	private function check_sureforms_active() {

		if ( ! function_exists( 'is_plugin_active' ) ) {
			/**
			 * Required to check for the `is_plugin_active` function.
			 */
			require_once ABSPATH . '/wp-admin/includes/plugin.php';
		}

		return is_plugin_active( 'sureforms/sureforms.php' );
	}

	/**
	 * Function to load the sureforms integration class with GoDAM.
	 *
	 * @return void
	 */
	public function load_sureforms_classes() {

		/**
		 * Register the blocks.
		 */
		Register::get_instance();
	}
}
