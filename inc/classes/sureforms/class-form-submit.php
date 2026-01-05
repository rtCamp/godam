<?php
/**
 * Sureforms after form submit process.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Sureforms;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

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
	 * Setup hooks for after submission process.
	 *
	 * @return void
	 */
	public function setup_hooks() {

		/**
		 * SureForms prepare recorder field data.
		 */
		add_filter( 'srfm_before_prepare_submission_data', array( $this, 'prepare_submission_data' ) );

		/**
		 * Send entry to godam.
		 */
		add_action( 'srfm_form_submit', array( $this, 'after_submission_process' ) );

		/**
		 * SureForms filter to render custom value for field.
		 */
		add_filter( 'srfm_entry_render_field_custom_value', array( $this, 'render_custom_field' ), 10, 2 );

		/**
		 * SureForms to render custom markup for field.
		 */
		add_filter( 'srfm_entry_custom_value', array( $this, 'render_custom_field_markup' ), 10, 2 );
	}

	/**
	 * Prepare submission data.
	 *
	 * @param array<mixed> $submission_data Current submitted data.
	 *
	 * @return array<mixed>
	 */
	public function prepare_submission_data( $submission_data ) {

		// Bail early.
		if ( ! isset( $_FILES ) || empty( $_FILES ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			return $submission_data;
		}

		/**
		 * Max upload size.
		 */
		$max_file_size      = wp_max_upload_size();
		$accepted_file_size = 0;

		/**
		 * Is file required?
		 */
		$is_required = false;
		$message     = __( 'The field is required', 'godam' );

		/**
		 * Check for max file size and look for maximum value.
		 */
		foreach ( $submission_data as $key => $value ) {
			if ( str_ends_with( $key, '-max-file-size' ) ) {
				$accepted_file_size = $value > $accepted_file_size ? $value : $accepted_file_size;
				unset( $submission_data[ $key ] );
			}

			if ( str_ends_with( $key, '-error-message' ) ) {
				$is_required = true;
				$message     = $submission_data[ $key ];
				unset( $submission_data[ $key ] );
			}
		}

		if ( $accepted_file_size > $max_file_size ) {
			$accepted_file_size = $max_file_size;
		}

		/**
		 * Change upload dir to `godam`.
		 */
		add_filter( 'upload_dir', array( $this, 'change_upload_dir' ) );

		// Loop through each file and check for `recorder` field data.
		foreach ( $_FILES as $input_key => $file_data ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			if ( false === strpos( $input_key, '-input-recorder' ) ) {
				continue;
			}

			$temp_path  = $file_data['tmp_name'];
			$file_name  = $file_data['name'];
			$file_size  = $file_data['size'];
			$file_type  = $file_data['type'];
			$file_error = $file_data['error'];

			/**
			 * Handle size, error, 0 means no size.
			 */
			if ( ( 0 === $file_size || $file_error ) && $is_required ) {
				wp_send_json_error(
					array(
						'message' => $message,
					)
				);
			}

			if ( ! $file_name && ! $temp_path && ! $file_size && ! $file_type ) {
				$submission_data[ $input_key ][] = '';
				continue;
			}

			/**
			 * Send the error if file size limit exceeds.
			 */
			if ( $file_size > $accepted_file_size ) {
				wp_send_json_error(
					array(
						'message' => __( 'File size limit exceeds.', 'godam' ),
					)
				);
			}

			$uploaded_file = array(
				'name'     => sanitize_file_name( $file_name ),
				'type'     => $file_type,
				'tmp_name' => $temp_path,
				'error'    => $file_error,
				'size'     => $file_size,
			);

			$upload_overrides = array(
				'test_form' => false,
			);
			$move_file        = wp_handle_upload( $uploaded_file, $upload_overrides );

			if ( $move_file && ! isset( $move_file['error'] ) ) {
				$submission_data[ $input_key ] = $move_file['url'];
			} else {
				wp_send_json_error(
					array(
						'message' => __( 'File is not uploaded', 'godam' ),
					)
				);
			}
		}

		/**
		 * Remove the upload DIR filter.
		 */
		remove_filter( 'upload_dir', array( $this, 'change_upload_dir' ) );

		return $submission_data;
	}

	/**
	 * On form submission response.
	 *
	 * @param array<mixed> $form_submit_response Response on form submission.
	 *
	 * @return void
	 */
	public function after_submission_process( $form_submit_response ) {

		if ( empty( $form_submit_response['data'] ) ) {
			return;
		}

		// Skip sending files for transcoding if the api key is invalid.
		if ( ! rtgodam_is_api_key_valid() ) {
			return;
		}

		$form_name = $form_submit_response['form_name'] ?? '';
		$form_id   = $form_submit_response['form_id'] ?? 0;
		$entry_id  = $form_submit_response['entry_id'] ?? 0;

		/**
		 * Get form data.
		 */
		$form_data = $form_submit_response['data'];

		foreach ( $form_data as $key => $value ) {
			if ( false !== strpos( $key, 'input-recorder' ) ) {
				$this->send_data_to_godam( $form_name, $form_id, $entry_id, $value );
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
		$form_title = ! empty( $form_title ) ? $form_title : __( 'Sureforms', 'godam' );

		// Detect file type to determine job_type.
		$is_audio = godam_is_audio_file( $file_url );
		
		// Set job_type based on file type.
		$job_type = $is_audio ? 'audio' : 'stream';
		
		/**
		 * Send for transcoding.
		 */
		$response_from_transcoding = rtgodam_send_video_to_godam_for_transcoding( 
			'sureforms', 
			$form_title, 
			$file_url, 
			$entry_id,
			$job_type
		);

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
				'source'   => 'sureforms_godam_recorder',
				'entry_id' => $entry_id,
				'form_id'  => $form_id,
			)
		);
	}

	/**
	 * To render the custom value for the upload field.
	 *
	 * @param bool   $value        Render custom markup.
	 * @param string $field_name   Field Name.
	 *
	 * @return bool
	 */
	public function render_custom_field( $value, $field_name ) {
		/**
		 * Return true if we have custom recorder field.
		 */
		if ( false !== strpos( $field_name, '-input-recorder' ) ) {
			return true;
		}

		return $value;
	}

	/**
	 * To render the custom markup for the recorder field.
	 *
	 * @param string $markup Current markup.
	 * @param string $value  Field value.
	 *
	 * @return string
	 */
	public function render_custom_field_markup( $markup, $value ) {

		// Bail early, if value is empty or array.
		if ( empty( $value ) || is_array( $value ) ) {
			return $markup;
		}

		$entry_id = isset( $_GET['entry_id'] ) ? intval( sanitize_text_field( wp_unslash( $_GET['entry_id'] ) ) ) : null; // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		if ( ! $entry_id ) {
			return $markup;
		}

		if ( ! class_exists( 'SRFM\Inc\Database\Tables\Entries' ) ) {
			return $markup;
		}

		$entry_data = \SRFM\Inc\Database\Tables\Entries::get( $entry_id );

		if ( empty( $entry_data ) ) {
			return $markup;
		}

		$form_id = $entry_data['form_id'];

		$file_type = wp_check_filetype( $value );

		// Detect if this is an audio file.
		$is_audio = godam_is_audio_file( $value );

		/**
		 * Fetch the transcoding URL from meta.
		 */
		$transcoded_url_meta_key = 'rtgodam_transcoded_url_sureforms_' . $form_id . '_' . $entry_id;
		$transcoded_url          = get_post_meta( $form_id, $transcoded_url_meta_key, true );
		$transcoded_url_output   = '';

		if ( ! empty( $transcoded_url ) ) {
			$transcoded_url        = esc_url( $transcoded_url );
			$transcoded_url        = "transcoded_url={$transcoded_url}";
			$transcoded_url_output = sprintf(
				"<div style='margin: 8px 0;' class='godam-transcoded-url-info'><span class='dashicons dashicons-yes-alt'></span><strong>%s</strong></div>",
				$is_audio 
					? esc_html__( 'Audio saved and transcoded successfully on GoDAM', 'godam' )
					: esc_html__( 'Video saved and transcoded successfully on GoDAM', 'godam' )
			);
		}

		$download_url = sprintf(
			'<div style="margin: 12px 0;"><a class="button" target="_blank" href="%s">%s</a></div>',
			esc_url( $value ),
			__( 'Click to view', 'godam' )
		);

		// Render audio or video player.
		if ( $is_audio ) {
			$audio_output = '<audio controls">';
			if ( ! empty( $transcoded_url ) ) {
				$audio_output .= sprintf( '<source src="%s" type="audio/mpeg">', esc_url( str_replace( 'transcoded_url=', '', $transcoded_url ) ) );
			}
			$audio_output .= sprintf( '<source src="%s" type="%s">', esc_url( $value ), esc_attr( $file_type['type'] ) );
			$audio_output .= esc_html__( 'Your browser does not support the audio element.', 'godam' );
			$audio_output .= '</audio>';
			
			$media_output = '<div class="gf-godam-audio-preview">' . $audio_output . '</div>';
		} else {
			$video_output = do_shortcode( "[godam_video src='{$value}' {$transcoded_url} ]" );
			$media_output = '<div class="gf-godam-video-preview">' . $video_output . '</div>';
		}
		
		$output = '<td style="width: 75%;">' . $download_url . $transcoded_url_output . $media_output . '</td>';
		
		return $output;
	}

	/**
	 * Change upload dir to godam directory in uploads.
	 *
	 * @param array<mixed> $dirs upload directory.
	 *
	 * @return array<mixed>
	 */
	public function change_upload_dir( $dirs ) {

		$dirs['subdir'] = '/godam/sureforms';
		$dirs['path']   = $dirs['basedir'] . $dirs['subdir'];
		$dirs['url']    = $dirs['baseurl'] . $dirs['subdir'];

		return $dirs;
	}
}
