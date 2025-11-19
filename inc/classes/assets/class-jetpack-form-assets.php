<?php
/**
 * Jetpack Form Assets class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Assets;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Jetpack Form Assets class.
 */
class Jetpack_Form_Assets {
	use Singleton;

	/**
	 * Constructor register hooks if not already registered.
	 *
	 * @return void
	 */
	protected function __construct() {
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );
	}

	/**
	 * Enqueue GoDAM specific jetpack script.
	 *
	 * @return void
	 */
	public function enqueue_scripts() {
		$rtgodam_jetpack_form_script_assets = include RTGODAM_PATH . 'assets/build/js/jetpack-form.min.asset.php';

		wp_register_script(
			'rtgodam-jetpack-form',
			RTGODAM_URL . 'assets/build/js/jetpack-form.min.js',
			$rtgodam_jetpack_form_script_assets['dependencies'],
			$rtgodam_jetpack_form_script_assets['version'],
			true
		);

		wp_localize_script(
			'rtgodam-jetpack-form',
			'godamJetpackFormData',
			array(
				'submittingText'      => __( 'Submitting...', 'godam' ),
				'successHeading'      => __( 'Success!', 'godam' ),
				'successMessage'      => __( 'Your message has been sent successfully.', 'godam' ),
				'errorMessage'        => __( 'An error occurred. Please try again.', 'godam' ),
				'networkErrorMessage' => __( 'Network error. Please try again.', 'godam' ),
			)
		);

		wp_localize_script(
			'rtgodam-jetpack-form',
			'wpAjax',
			array(
				'ajaxUrl' => admin_url( 'admin-ajax.php' ),
				'nonce'   => wp_create_nonce( 'jetpack_form_nonce' ),
			),
		);

		wp_enqueue_script( 'rtgodam-jetpack-form' );
	}
}
