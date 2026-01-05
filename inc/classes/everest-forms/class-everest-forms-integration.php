<?php
/**
 * Handles Everest Forms integration class.
 *
 * @since 1.4.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Everest_Forms;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Everest_Forms_Integration
 *
 * @since 1.4.0
 */
class Everest_Forms_Integration {

	use Singleton;

	/**
	 * Initialize class.
	 *
	 * @since 1.4.0
	 *
	 * @return void
	 */
	public function init() {
		// Backward compatibility for Everest Forms REST API.
		// Previously it was registered as RTGODAM\Inc\REST_API\Everest_Forms under rest-api directory.
		// TODO: Remove this in future versions. Added in @1.4.0 version.
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
	 * @since 1.4.0
	 *
	 * @return void
	 */
	public function setup_hooks() {

		/**
		 * Filter to register Everest Forms fields.
		 */
		add_filter( 'everest_forms_fields', array( $this, 'register_fields' ) );

		// Filter to change the field to file-upload for better handling.
		add_filter( 'everest_forms_process_before_form_data', array( $this, 'update_field_type_to_file_upload' ), 10, 1 );

		// Revert the field type to godam_record for the field properties.
		add_filter( 'everest_forms_process_filter', array( $this, 'update_field_type_to_godam_record' ), 10, 1 );

		// Action once forms is submitted to send file to GoDAM for transcoding.
		add_action( 'everest_forms_process_complete', array( $this, 'handle_godam_recorder_submission' ), 10, 4 );

		// Transcoding callback.
		add_action( 'rtgodam_handle_callback_finished', array( $this, 'handle_transcoding_callback' ), 10, 4 );
	}

	/**
	 * Transcoding callback handler.
	 *
	 * @param int             $attachment_id Attachment ID.
	 * @param string          $job_id        Job ID.
	 * @param string          $job_for       Job for.
	 * @param WP_REST_Request $request       Request object.
	 *
	 * @since 1.4.0
	 *
	 * @return void
	 */
	public function handle_transcoding_callback( $attachment_id, $job_id, $job_for, $request ) {
		if ( ! empty( $job_for ) && 'everestforms-godam-recorder' === $job_for && ! empty( $job_id ) && class_exists( 'EverestForms' ) ) {
			$post_array = $request->get_params();

			// Get data stored in options based on job id.
			$data = get_option( $job_id );

			if ( ! empty( $data ) && 'everestforms_godam_recorder' === $data['source'] ) {
				$entry_id   = $data['entry_id'];
				$entry_data = evf_get_entry( $entry_id, false );

				if ( ! empty( $entry_data ) ) {
					$form_id = $entry_data->form_id;

					global $wpdb;

					$entry_metadata = array(
						'entry_id'   => $entry_id,
						// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key -- Required for storing transcoded URL metadata.
						'meta_key'   => 'rtgodam_transcoded_url_everestforms_' . $form_id . '_' . $entry_id,
						'meta_value' => $post_array['download_url'], // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
					);

					// Insert entry meta.
					$wpdb->insert( $wpdb->prefix . 'evf_entrymeta', $entry_metadata ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery
				}
			}
		}
	}

	/**
	 * Register Everest Forms fields.
	 *
	 * @param array $fields Array of Everest Forms fields.
	 *
	 * @since 1.4.0
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
	 * @since 1.4.0
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
	 * @since 1.4.0
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
	 * @since 1.4.0
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

		// Loop through each record and check for recorder data.
		foreach ( $form_fields as $field ) {
			if ( false !== strpos( $field['type'], 'godam_record' ) ) {
				$this->send_data_to_godam( $form_name, $form_id, $entry_id, is_array( $field['value'] ) ? $field['value'][0] : $field['value'] );
			}
		}
	}

	/**
	 * Return true if Everest Forms is active.
	 *
	 * @since 1.4.0
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
	 * @since 1.4.0
	 *
	 * @return void
	 */
	private function send_data_to_godam( $form_title, $form_id, $entry_id, $file_url ) {

		// Bail early.
		if ( empty( $file_url ) ) {
			return;
		}

		$form_title = ! empty( $form_title ) ? $form_title : __( 'Everest Forms', 'godam' );

		// Detect file type to determine job_type.
		$is_audio = godam_is_audio_file( $file_url );

		// Set job_type based on file type.
		$job_type = $is_audio ? 'audio' : 'stream';

		$response_from_transcoding = rtgodam_send_video_to_godam_for_transcoding( 
			'everestforms', 
			$form_title, 
			$file_url, 
			$entry_id,
			$job_type
		);

		if ( is_wp_error( $response_from_transcoding ) ) {
			return wp_send_json_error(
				$response_from_transcoding->get_error_message(),
				$response_from_transcoding->get_error_code()
			);
		}

		// If empty data or name send error.
		if ( empty( $response_from_transcoding->data ) || empty( $response_from_transcoding->data->name ) ) {
			return wp_send_json_error(
				__( 'Transcoding data not set', 'godam' ),
				404
			);
		}

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
