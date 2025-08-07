<?php
/**
 * Handles Everest Forms integration class.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Everest_Forms;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Everest_Forms_Integration
 *
 * @since n.e.x.t
 */
class Everest_Forms_Integration {

	use Singleton;

	/**
	 * Initialize class.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function init() {
		// Backward compatibility for Everest Forms REST API.
		// Previously it was registered as RTGODAM\Inc\REST_API\Everest_Forms under rest-api directory.
		// TODO: Remove this in future versions. Added in @n.e.x.t version.
		class_alias( 'RTGODAM\Inc\Everest_Forms\Everest_Forms_Rest_Api', 'RTGODAM\Inc\REST_API\Everest_Forms' );

		if ( ! $this->is_evf_active() ) {
			return;
		}

		Everest_Forms_Rest_Api::get_instance();

		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function setup_hooks() {

		/**
		 * Filter to register Everest Forms fields.
		 */
		add_filter( 'everest_forms_fields', array( $this, 'register_fields' ) );
	}

	/**
	 * Register Everest Forms fields.
	 *
	 * @param array $fields Array of Everest Forms fields.
	 *
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	public function register_fields( $fields ) {
		$fields[] = Everest_Forms_Field_GoDAM_Video::class;

		return $fields;
	}

	/**
	 * Return true if Everest Forms is active.
	 *
	 * @since n.e.x.t
	 *
	 * @return boolean
	 */
	public function is_evf_active() {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			/**
			 * Required to check for the `is_plugin_active` function.
			 */
			require_once ABSPATH . '/wp-admin/includes/plugin.php';
		}

		return is_plugin_active( 'everest-forms/everest-forms.php' ) || is_plugin_active( 'everest-forms-pro/everest-forms-pro.php' );
	}
}
