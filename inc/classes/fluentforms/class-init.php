<?php
/**
 * Extend FluentForms.
 *
 * @since 1.3.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\FluentForms;

use RTGODAM\Inc\FluentForms\Fields\Recorder_Field;
use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Init.
 *
 * @since 1.3.0
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
	 *
	 * @since 1.3.0
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
	 * @since 1.3.0
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
	 * @since 1.3.0
	 *
	 * @return void
	 */
	public function load_fluentforms_classes() {

		/**
		 * Load the new field on `fluentform/loaded`.
		 */
		add_action( 'fluentform/loaded', array( $this, 'on_fluentforms_loaded' ) );

		/**
		 * Filter to exclude godam scripts on fluent forms pages.
		 */
		add_filter( 'fluentform/exclude_js_slugs_from_dequeue', array( $this, 'exclude_godam_scripts' ) );
	}

	/**
	 * Add functionality on loaded.
	 *
	 * @since 1.3.0
	 *
	 * @return void
	 */
	public function on_fluentforms_loaded() {

		/**
		 * Add recorder field.
		 */
		Recorder_field::get_instance();

		/**
		 * Form Submission handler.
		 */
		Form_Submit::get_instance();
	}

	/**
	 * Exclude slugs from dequeue.
	 *
	 * @since 1.3.0
	 *
	 * @param array $slugs Script handle to exclude from dequeue.
	 *
	 * @return array
	 */
	public function exclude_godam_scripts( $slugs ) {

		/**
		 * Frontend player and analytics.
		 */
		$new = array( 'godam-player-frontend', 'godam-player-analytics', 'admin' );

		/**
		 * Add to slugs array.
		 */
		array_push( $slugs, ...$new );

		return $slugs;
	}
}
