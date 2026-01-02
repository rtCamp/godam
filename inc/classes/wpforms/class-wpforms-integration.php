<?php
/**
 * Main WPForms Integration class.
 *
 * @since 1.3.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\WPForms;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * WPForms Integration class.
 *
 * @since 1.3.0
 */
class WPForms_Integration {
	use Singleton;

	/**
	 * Initialize.
	 *
	 * @since 1.3.0
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

			add_action( 'wpforms_process_entry_saved', array( $this, 'send_saved_files_for_transcoding' ), 10, 4 );

			add_action( 'rtgodam_handle_callback_finished', array( $this, 'handle_transcoded_webhook_callback' ), 10, 4 );
		}
	}

	/**
	 * Register all the assets.
	 *
	 * @since 1.3.0
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
			'wpforms-godam-recorder-editor',
			RTGODAM_URL . 'assets/build/js/wpforms-godam-recorder-editor.min.js',
			array( 'godam-player-frontend-script' ),
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
	 * @since 1.3.0
	 *
	 * @return void
	 */
	public function enqueue_admin_assets() {
		// GoDAM Video Editor page.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( isset( $_GET['page'] ) && 'rtgodam_video_editor' === $_GET['page'] ) {
			// Enqueue the WPForms styles.
			$frontend = wpforms()->obj( 'frontend' );
			$frontend->assets_css();

			wp_enqueue_style( 'wpforms-uppy-video-style' );
		}

		// Form builder page.
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		if ( isset( $_GET['page'], $_GET['view'] ) && 'wpforms-builder' === $_GET['page'] && 'fields' === $_GET['view'] ) {
			wp_enqueue_style( 'wpforms-uppy-video-style' );
		}
	}

	/**
	 * Load godam recorder script on success so that uppy states can be removed.
	 *
	 * @since 1.3.0
	 *
	 * @param array $confirmation Current confirmation data.
	 * @param array $form_data    Form data and settings.
	 * @param array $fields       Sanitized field data.
	 * @param int   $entry_id     Entry id.
	 * @return void
	 */
	public function load_godam_recorder_script_on_success( $confirmation, $form_data, $fields, $entry_id ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		$field_with_types = wp_list_pluck( $fields, 'type', 'id' );

		if ( in_array( 'godam_record', $field_with_types, true ) ) {
			wp_enqueue_script( 'godam-recorder-script' );
		}
	}

	/**
	 * Initialize godam field video.
	 *
	 * @since 1.3.0
	 *
	 * @return void
	 */
	public function init_godam_video_field() {
		new \RTGODAM\Inc\WPForms\WPForms_Field_GoDAM_Video();
	}

	/**
	 * Sent saved files by WPForms Recorder Field to the transcoding service.
	 *
	 * @since 1.3.0
	 *
	 * @param array $fields     Fields data.
	 * @param array $entry      User submitted data.
	 * @param array $form_data  Form data.
	 * @param int   $entry_id   Entry ID.
	 *
	 * @return \WP_Error|void
	 */
	public function send_saved_files_for_transcoding( $fields, $entry, $form_data, $entry_id ) {
		// Skip sending files for transcoding if the api key is invalid.
		if ( ! rtgodam_is_api_key_valid() ) {
			return;
		}

		$index      = 0;
		$form_title = isset( $form_data['settings']['form_title'] ) ? trim( $form_data['settings']['form_title'] ) : __( 'Untitled Form', 'godam' );
		$form_id    = isset( $form_data['id'] ) ? trim( $form_data['id'] ) : __( 'Untitled Form', 'godam' );

		foreach ( $fields as $field ) {
			if ( ! isset( $field['type'] ) || 'godam_record' !== $field['type'] ) {
				continue;
			}

			// Detect file type.
			$file_type = wp_check_filetype( $field['value'] );
			$is_audio  = strpos( $file_type['type'], 'audio' ) !== false;
			$is_video  = strpos( $file_type['type'], 'video' ) !== false;
			
			// Handle .webm files that might be audio.
			if ( 'webm' === $file_type['ext'] && godam_is_audio_file_by_name( $field['value'] ) ) {
				$is_audio = true;
				$is_video = false;
			}
			
			// Set job_type based on file type.
			$job_type = $is_audio ? 'audio' : 'stream';
			
			$response = rtgodam_send_video_to_godam_for_transcoding( 
				'wpforms', 
				$form_title, 
				$field['value'], 
				$entry_id,
				$job_type
			);

			if ( is_wp_error( $response ) ) {
				return wp_send_json_error(
					$response->get_error_message(),
					$response->get_error_code(),
				);
			}

			if ( empty( $response->data ) || empty( $response->data->name ) ) {
				return wp_send_json_error(
					__( 'Transcoding data not set', 'godam' ),
					404
				);
			}

			$job_id = $response->data->name;

			$entry_meta_obj = wpforms()->entry_meta;

			if ( $entry_meta_obj ) {
				$key = 'rtgodam_transcoding_job_id_' . $field['id'] . '_' . $index;

				$meta_value = $entry_meta_obj->get_meta(
					array(
						'entry_id' => $entry_id,
						'form_id'  => $form_id,
						'type'     => $key,
					)
				);

				if ( ! $meta_value ) {
					$entry_meta_obj->add(
						array(
							'entry_id' => $entry_id,
							'form_id'  => $form_id,
							'type'     => $key,
							'data'     => $job_id,
						)
					);
				}
			}

			add_option(
				$job_id,
				array(
					'source'   => 'wpforms_godam_recorder',
					'form_id'  => $form_id,
					'entry_id' => $entry_id,
					'field_id' => $field['id'],
					'index'    => $index,
				)
			);
		}
	}

	/**
	 * Handle webhook callback by the transcoder service once it has finished transcoding videos.
	 *
	 * @since 1.3.0
	 *
	 * @param number      $attachment_id  Attachment ID for which the callback has sent from the transcoder.
	 * @param number      $job_id         The transcoding job ID.
	 * @param string      $job_for        Job for.
	 * @param \WP_Request $request      WP_Request instance.
	 *
	 * @return void
	 */
	public function handle_transcoded_webhook_callback( $attachment_id, $job_id, $job_for, $request ) {
		if ( empty( $job_id ) || empty( $job_for ) ) {
			return;
		}

		if ( 'wpforms-godam-recorder' !== $job_for ) {
			return;
		}

		$post_array = $request->get_params();
		$data       = get_option( $job_id );

		$source   = isset( $data['source'] ) ? trim( $data['source'] ) : '';
		$form_id  = isset( $data['form_id'] ) ? absint( $data['form_id'] ) : 0;
		$entry_id = isset( $data['entry_id'] ) ? absint( $data['entry_id'] ) : 0;
		$field_id = isset( $data['field_id'] ) ? absint( $data['field_id'] ) : 0;
		$index    = isset( $data['index'] ) ? absint( $data['index'] ) : 0;

		if ( 'wpforms_godam_recorder' !== $source ) {
			return;
		}

		if ( 0 === $form_id || 0 === $entry_id || 0 === $field_id ) {
			return;
		}

		$entry_meta_obj = wpforms()->entry_meta;

		if ( $entry_meta_obj ) {
			$key = 'rtgodam_transcoding_job_id_' . $field_id . '_' . $index;

			$meta_value = $entry_meta_obj->get_meta(
				array(
					'entry_id' => $entry_id,
					'form_id'  => $form_id,
					'type'     => $key,
				)
			);

			if ( ! $meta_value ) {
				return;
			}


			$meta_values = array(
				array(
					'type' => "rtgodam_transcoded_url_{$field_id}_{$index}",
					'data' => $post_array['download_url'],
				),
				array(
					'type' => "rtgodam_hls_transcoded_url_{$field_id}_{$index}",
					'data' => $post_array['hls_path'],
				),
				array(
					'type' => "rtgodam_transcoded_status_{$field_id}_{$index}",
					'data' => $post_array['status'],
				),
				array(
					'type' => "rtgodam_transcoded_thumbnails_{$field_id}_{$index}",
					'data' => wp_json_encode( $post_array['thumbnail'] ),
				),
			);

			WPForms_Integration_Helper::save_meta_values_to_entry( $form_id, $entry_id, $meta_values );
		}
	}
}
