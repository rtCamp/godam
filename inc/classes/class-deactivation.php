<?php
/**
 * Plguin Deactivation Survey Class.
 */
namespace Transcoder\Inc;

use Transcoder\Inc\Traits\Singleton;

class Deactivation {

	use Singleton;

	/**
	 * API Url.
	 *
	 * @var string
	 */
	private $api_url = 'http://godamio.local/wp-json/godam/v1/feedback/'; // Replace the API Url by the production API Url.

	/**
	 * Constructor function.
	 */
	public function __construct() {
		add_action( 'admin_enqueue_scripts', array( $this, 'load_scripts' ) );
		add_action( 'wp_ajax_godam_send_deactivation_feedback', array( $this, 'godam_send_deactivation_feedback' ) );
	}

	/**
	 * Loading scripts.
	 *
	 * @return void
	 */
	public function load_scripts() {
		global $pagenow;

		wp_register_style( 'godam-deactivation-survey', RT_TRANSCODER_URL . '/assets/src/js/deactivation-feedback.js', array(), wp_rand(), 'all' );
		wp_register_script( 'godam-deactivation-survey', RT_TRANSCODER_URL . '/assets/src/js/deactivation-feedback.js', array( 'jquery' ), wp_rand(), true );

		if ( is_admin() && 'plugins.php' === $pagenow ) {

			wp_enqueue_style( 'godam-deactivation-survey' );
			wp_enqueue_script( 'godam-deactivation-survey' ); 

			$current_user = wp_get_current_user();

			$rt_deactivate = array(
				'site_url'    => home_url(),
				'nonce'       => wp_create_nonce( 'godam' ),
				'user_name'   => $current_user->user_nicename,
				'user_email'  => $current_user->user_email,
				'header_text' => esc_html__( 'Please let us know why you are deactivating ', 'godam' ),
				'api_url'     => esc_url( $this->api_url ),
			);

			wp_localize_script( 'godam-deactivation-survey', 'rtGoDAM', $rt_deactivate );
		}
	}

	/**
	 * Ajax Function call.
	 *
	 * @return string.
	 */
	public function godam_send_deactivation_feedback() {
		// Checking ajax referer.
		check_ajax_referer( 'godam', 'nonce' );

		if ( ! $_POST['reason'] && empty( $_POST['user'] && ! $_POST['site_url'] ) ) {
			return;
		}

		// Filter the inputs.
		$site_url = filter_input( INPUT_POST, 'site_url', FILTER_SANITIZE_URL );
		$reason   = filter_input( INPUT_POST, 'reason', FILTER_SANITIZE_FULL_SPECIAL_CHARS );
		$user     = filter_input( INPUT_POST, 'user', FILTER_DEFAULT, FILTER_REQUIRE_ARRAY );
		$feedback = filter_input( INPUT_POST, 'additional_feedback', FILTER_SANITIZE_FULL_SPECIAL_CHARS );

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


		$api_response = wp_remote_get( $this->api_url );

		$options = array(
			'body'        => $data,
			'timeout'     => 60,
			'redirection' => 5,
			'httpversion' => '1.0',
			'sslverify'   => false,
			'data_format' => 'body',
		);

		$api_response = wp_remote_post( $this->api_url, $options );
		$response     = json_decode( wp_remote_retrieve_body( $api_response ) );

		if ( 'integer' === gettype( $response ) ) {
			echo wp_json_encode( 'success' );
			wp_die();
		}

		echo wp_json_encode( 'failed' );
		wp_die();
	}
}

new Deactivation();
