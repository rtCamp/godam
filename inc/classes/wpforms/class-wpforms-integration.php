<?php
/**
 * Main WPForms Integration class.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\WPForms;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * WPForms Integration class.
 *
 * @since n.e.x.t
 */
class WPForms_Integration {
	use Singleton;

	/**
	 * Initialize.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function init() {
		if ( is_plugin_active( 'wpforms-lite/wpforms.php' ) || is_plugin_active( 'wpforms/wpforms.php' ) ) {
			// Register assets.
			add_action( 'admin_enqueue_scripts', array( $this, 'register_assets' ) );
			add_action( 'wp_enqueue_scripts', array( $this, 'register_assets' ) );

			add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );

			add_action( 'wpforms_frontend_confirmation_message_before', array( $this, 'load_godam_recorder_script_on_success' ), 10, 4 );

			add_action( 'wpforms_loaded', array( $this, 'init_godam_video_field' ) );
		}
	}

	/**
	 * Register all the assets.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function register_assets() {
		wp_register_style(
			'wpforms-uppy-video-style',
			RTGODAM_URL . 'assets/build/css/wpforms-uppy-video.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/wpforms-uppy-video.css' )
		);

		wp_register_script(
			'wpforms-godam-recorder',
			RTGODAM_URL . 'assets/build/js/wpforms-godam-recorder.min.js',
			array( 'jquery' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/wpforms-godam-recorder.min.js' ),
			true
		);

		wp_register_script(
			'wpforms-godam-recorder-editor',
			RTGODAM_URL . 'assets/build/js/wpforms-godam-recorder-editor.min.js',
			array( 'jquery' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/wpforms-godam-recorder-editor.min.js' ),
			true
		);

		// Common godam recorder script.
		wp_register_script(
			'godam-recorder-script',
			RTGODAM_URL . 'assets/build/js/godam-recorder.min.js',
			array( 'jquery' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/godam-recorder.min.js' ),
			true
		);
	}

	/**
	 * Enqueue assets in the admin area.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function enqueue_admin_assets() {
		// GoDAM Video Editor page.
		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		if ( isset( $_GET['page'] ) && 'rtgodam_video_editor' === $_GET['page'] ) {
			// Enqueue the WPForms styles.
			$frontend = wpforms()->obj( 'frontend' );
			$frontend->assets_css();

			wp_enqueue_style( 'wpforms-uppy-video-style' );
		}

		// Form builder page.
		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		if ( isset( $_GET['page'], $_GET['view'] ) && 'wpforms-builder' === $_GET['page'] && 'fields' === $_GET['view'] ) {
			wp_enqueue_style( 'wpforms-uppy-video-style' );
		}
	}

	/**
	 * Load godam recorder script on success so that uppy states can be removed.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $confirmation Current confirmation data.
	 * @param array $form_data    Form data and settings.
	 * @param array $fields       Sanitized field data.
	 * @param int   $entry_id     Entry id.
	 * @return void
	 */
	// phpcs:ignrore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
	public function load_godam_recorder_script_on_success( $confirmation, $form_data, $fields, $entry_id ) {
		$field_with_types = wp_list_pluck( $fields, 'type', 'id' );

		if ( in_array( 'godam-video', $field_with_types, true ) ) {
			wp_enqueue_script( 'godam-recorder-script' );
		}
	}

	/**
	 * Initialize godam field video.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function init_godam_video_field() {
		new \RTGODAM\Inc\WPForms\WPForms_Field_GoDAM_Video();
	}
}
