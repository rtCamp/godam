<?php
/**
 * Extend FluentForms for form submission.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\FluentForms;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Form_Submit.
 */
class Form_Submit {

	use Singleton;

	/**
	 * Constructor.
	 */
	public function __construct() {

		$this->setup_hooks();
	}

	/**
	 * Function to setup hooks.
	 *
	 * @return void
	 */
	public function setup_hooks() {

		/**
		 * Handle the submission and send data to GoDAM.
		 */
		add_action( 'fluentform/submission_inserted', array( $this, 'handle_godam_recorder_submission' ), 10, 3 );
	}

	/**
	 * Handle godam recorder submission.
	 *
	 * @param int          $insert_id Inserted Id.
	 * @param array<mixed> $form_data Form data.
	 * @param object       $form      Form Object.
	 *
	 * @return void
	 */
	public function handle_godam_recorder_submission( $insert_id, $form_data, $form ) {

		// Bail early.
		if ( empty( $insert_id ) ) {
			return;
		}

		// Skip sending files for transcoding if the api key is invalid.
		if ( ! rtgodam_is_api_key_valid() ) {
			return;
		}

		$form_name = $form->title ?? __( 'Fluentforms', 'godam' );
		$form_id   = $form->id ?? 0;

		/**
		 * Loop through each record and check for recorder data.
		 */
		foreach ( $form_data as $key => $value ) {
			if ( false !== strpos( $key, 'godam-recorder' ) ) {
				$this->send_data_to_godam( $form_name, $form_id, $insert_id, is_array( $value ) ? $value[0] : $value );
			}
		}
	}

	/**
	 * Send files to GoDam for transcoding.
	 *
	 * @param string $form_title Form Name.
	 * @param int    $form_id    Form Id.
	 * @param int    $entry_id   Entry Id.
	 * @param string $file_url   File URL.
	 */
	private function send_data_to_godam( $form_title, $form_id, $entry_id, $file_url ) {

		/**
		 * Bail early if no file to send.
		 */
		if ( empty( $file_url ) ) {
			return;
		}

		/**
		 * Form Title.
		 */
		$form_title = ! empty( $form_title ) ? $form_title : __( 'Fluentforms', 'godam' );

		/**
		 * Send for transcoding.
		 */
		$response_from_transcoding = rtgodam_send_video_to_godam_for_transcoding( 'fluentforms', $form_title, $file_url, $entry_id );

		/**
		 * Error handling.
		 */
		if ( is_wp_error( $response_from_transcoding ) ) {
			return wp_send_json_error(
				$response_from_transcoding->get_error_message(),
				$response_from_transcoding->get_error_code(),
			);
		}

		/**
		 * If empty data or name send error.
		 */
		if ( empty( $response_from_transcoding->data ) || empty( $response_from_transcoding->data->name ) ) {
			return wp_send_json_error(
				__( 'Transcoding data not set', 'godam' ),
				404
			);
		}

		/**
		 * Get job id.
		 */
		$job_id = $response_from_transcoding->data->name;

		/**
		 * Add the job to options table.
		 */
		add_option(
			$job_id,
			array(
				'source'   => 'fluentforms_godam_recorder',
				'entry_id' => $entry_id,
				'form_id'  => $form_id,
			)
		);
	}
}
