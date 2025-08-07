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

		// Filter to change the field to file_upload for better handling.
		add_filter( 'everest_forms_process_before_form_data', array( $this, 'update_field_type_to_file_upload' ), 10, 1 );

		// Revert the filed type to godam_record for the field properties.
		add_filter( 'everest_forms_process_filter', array( $this, 'update_field_type_to_godam_record' ), 10, 1 );

		// Action once forms is submitted to send file to GoDAM for transcoding.
		add_action( 'everest_forms_process_complete', array( $this, 'handle_godam_recorder_submission' ), 10, 4 );
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
	 * Update field type to file_upload for better handling.
	 *
	 * @param array $form_data Form data.
	 *
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	public function update_field_type_to_file_upload( $form_data ) {
		if ( ! empty( $form_data['form_fields'] ) ) {
			foreach ( $form_data['form_fields'] as $field_id => $field ) {
				if ( 'godam_record' === $field['type'] ) {
					// This is deliberately done to handle the field as a file upload.
					$form_data['form_fields'][ $field_id ]['type'] = 'file-upload';
				}
			}
		}

		return $form_data;
	}

	/**
	 * Revert the field type to godam_record for the field properties.
	 *
	 * @param array $fields Fields data.
	 *
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	public function update_field_type_to_godam_record( $fields ) {
		foreach ( $fields as $field ) {
			if ( strpos( $field['meta_key'], 'godam_record' ) !== false ) {
				// Revert the field type to godam_record.
				$fields[ $field['id'] ]['type'] = 'godam_record';
			}
		}

		return $fields;
	}

	/**
	 * Send video file to GoDAM for transcoding.
	 *
	 * @param array $form_fields Form fields data.
	 * @param array $entry       Entry data.
	 * @param array $form_data   Form data.
	 * @param int   $entry_id    Entry ID.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function handle_godam_recorder_submission( $form_fields, $entry, $form_data, $entry_id ) {

		if ( empty( $entry_id ) ) {
			return;
		}

		// Skip sending files for transcoding if the api key is invalid.
		if ( ! rtgodam_is_api_key_valid() ) {
			return;
		}

		$form_name = $form_data['settings']['form_title'] ?? __( 'Everest Forms', 'godam' );
		$form_id   = $form_data['id'] ?? 0;

		/**
		 * Loop through each record and check for recorder data.
		 */
		foreach ( $form_fields as $field ) {
			if ( false !== strpos( $field['type'], 'godam_record' ) ) {
				$this->send_data_to_godam( $form_name, $form_id, $entry_id, is_array( $field['value'] ) ? $field['value'][0] : $field['value'] );
			}
		}
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

	/**
	 * Send files to GoDam for transcoding.
	 *
	 * @param string $form_title Form Name.
	 * @param int    $form_id    Form Id.
	 * @param int    $entry_id   Entry Id.
	 * @param string $file_url   File URL.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
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
		$form_title = ! empty( $form_title ) ? $form_title : __( 'Everest Forms', 'godam' );

		/**
		 * Send for transcoding.
		 */
		$response_from_transcoding = rtgodam_send_video_to_godam_for_transcoding( 'everestforms', $form_title, $file_url, $entry_id );

		/**
		 * Error handling.
		 */
		if ( is_wp_error( $response_from_transcoding ) ) {
			return wp_send_json_error(
				$response_from_transcoding->get_error_message(),
				$response_from_transcoding->get_error_code()
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
				'source'   => 'everestforms_godam_recorder',
				'entry_id' => $entry_id,
				'form_id'  => $form_id,
			)
		);
	}
}
