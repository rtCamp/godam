<?php
/**
 * Extend FluentForms.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\FluentForms;

use RTGODAM\Inc\FluentForms\Fields\Recorder_Field;
use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Init.
 */
class Init {

	use Singleton;

	/**
	 * Is FluentForms active?
	 *
	 * @access private
	 * @var bool
	 */
	private $is_fluentforms_active = false;

	/**
	 * Constructor.
	 */
	protected function __construct() {

		$this->is_fluentforms_active = $this->check_fluentforms_active();

		/**
		 * Add only if fluentforms is active.
		 */
		if ( $this->is_fluentforms_active ) {
			$this->load_fluentforms_classes();
		}
	}

	/**
	 * To check if fluentforms plugins is active.
	 *
	 * @return bool
	 */
	private function check_fluentforms_active() {

		if ( ! function_exists( 'is_plugin_active' ) ) {
			/**
			 * Required to check for the `is_plugin_active` function.
			 */
			require_once ABSPATH . '/wp-admin/includes/plugin.php';
		}

		return is_plugin_active( 'fluentform/fluentform.php' );
	}

	/**
	 * Function to load the fluentforms integration class with GoDAM.
	 *
	 * @return void
	 */
	public function load_fluentforms_classes() {

		/**
		 * Load the new field on `fluentform/loaded`.
		 */
		add_action( 'fluentform/loaded', array( $this, 'on_fluentforms_loaded' ) );
	}

	/**
	 * Add functionality on loaded.
	 *
	 * @return void
	 */
	public function on_fluentforms_loaded() {

		/**
		 * Add recorder field.
		 */
		Recorder_field::get_instance();
	}
}
