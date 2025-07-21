<?php
/**
 * Plguin Deactivation Survey Class.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Deactivation Class.
 */
class Deactivation {

	use Singleton;

	/**
	 * API Url.
	 *
	 * @var string
	 */
	private $api_url = RTGODAM_IO_API_BASE . '/wp-json/godam/v1/feedback/'; // Replace the API Url by the production API Url.

	/**
	 * Constructor function.
	 */
	public function __construct() {
		add_action( 'admin_enqueue_scripts', array( $this, 'load_scripts' ) );
		add_action( 'wp_ajax_godam_send_deactivation_feedback', array( $this, 'rtgodam_send_deactivation_feedback' ) );
	}

	/**
	 * Loading scripts.
	 *
	 * @return void
	 */
	public function load_scripts() {
		global $pagenow;

		wp_register_script(
			'godam-deactivation-survey-script',
			RTGODAM_URL . 'assets/build/js/deactivation-feedback.min.js',
			array( 'wp-i18n' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/deactivation-feedback.min.js' ),
			true
		);

		if ( is_admin() && 'plugins.php' === $pagenow ) {

			wp_set_script_translations( 'godam-deactivation-survey-script', 'godam', RTGODAM_PATH . 'languages' );
			wp_enqueue_script( 'godam-deactivation-survey-script' );

			$current_user = wp_get_current_user();

			$rtgodam_deactivate = array(
				'siteUrl'    => home_url(),
				'nonce'      => wp_create_nonce( 'GoDAMDeactivationFeedback' ),
				'userName'   => $current_user->user_nicename,
				'userEmail'  => $current_user->user_email,
				'headerText' => esc_html__( 'Please let us know why you are deactivating ', 'godam' ),
				'apiUrl'     => esc_url( $this->api_url ),
			);

			wp_localize_script( 'godam-deactivation-survey-script', 'GoDAMDeactivation', $rtgodam_deactivate );
		}
	}

	/**
	 * Ajax Function call.
	 *
	 * @return void
	 */
	public function rtgodam_send_deactivation_feedback() {
		// Checking ajax referer.
		check_ajax_referer( 'GoDAMDeactivationFeedback', 'nonce' );

		// Filter the inputs.
		$site_url = filter_input( INPUT_POST, 'site_url', FILTER_SANITIZE_URL );
		$reason   = filter_input( INPUT_POST, 'reason', FILTER_SANITIZE_FULL_SPECIAL_CHARS );
		$user     = filter_input( INPUT_POST, 'user', FILTER_SANITIZE_FULL_SPECIAL_CHARS, FILTER_REQUIRE_ARRAY );
		$feedback = filter_input( INPUT_POST, 'additional_feedback', FILTER_SANITIZE_FULL_SPECIAL_CHARS );

		if ( ! $reason || ! $site_url || ! $user ) {
			wp_send_json_error(
				array(
					'message' => esc_html__( 'Invalid data.', 'godam' ),
				)
			);
		}

		$data = array(
			'site_url'            => $site_url,
			'reason'              => $reason,
			'user_name'           => $user['name'],
			'user_email'          => $user['email'],
			'user'                => array(
				'name'  => $user['name'],
				'email' => $user['email'],
			),
			'additional_feedback' => $feedback,
		);

		$options = array(
			'body' => $data,
		);

		$api_response = wp_remote_post( $this->api_url, $options );
		$response     = json_decode( wp_remote_retrieve_body( $api_response ) );

		if ( is_int( $response ) ) {
			wp_send_json_success();
		}

		wp_send_json_error();
	}
}

new Deactivation();
