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
		 * Get max upload file size.
		 */
		$max_file_size = $submission_data['godam-max-file-size-lbl-hidden'] ?? wp_max_upload_size();

		/**
		 * Change upload dir to `godam`.
		 */
		add_filter( 'upload_dir', array( $this, 'change_upload_dir' ) );

		// Loop through each file and check for `recorder` field data.
		foreach ( $_FILES as $input_key => $file_data ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			if ( ! str_ends_with( $input_key, '-recorder' ) ) {
				continue;
			}

			$temp_path  = $file_data['tmp_name'];
			$file_name  = $file_data['name'];
			$file_size  = $file_data['size'];
			$file_type  = $file_data['type'];
			$file_error = $file_data['error'];

			if ( ! $file_name && ! $temp_path && ! $file_size && ! $file_type ) {
				$form_data[ $input_key ][] = '';
				continue;
			}

			/**
			 * Send the error if file size limit exceeds.
			 */
			if ( $file_size > $max_file_size ) {
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

			/**
			 * Remove the upload DIR filter.
			 */
			remove_filter( 'upload_dir', array( $this, 'change_upload_dir' ) );

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

		return $submission_data;
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
		if ( str_ends_with( $field_name, '-input-recorder' ) ) {
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

		$video_output = do_shortcode( "[godam_video src='{$value}']" );
		$video_output = '<div class="gf-godam-video-preview">' . $video_output . '</div>';

		$download_url = sprintf(
			'<div style="margin: 12px 0;"><a class="button" target="_blank" href="%s">%s</a></div>',
			esc_url( $value ),
			__( 'Download Video', 'godam' )
		);

		$video_output = '<td style="width: 75%;">' . $download_url . $video_output . '</td>';

		return $video_output;
	}

	/**
	 * Change upload dir to godam directory in uploads.
	 *
	 * @param array<mixed> $dirs upload directory.
	 *
	 * @return array<mixed>
	 */
	public function change_upload_dir( $dirs ) {

		$dirs['subdir'] = '/godam';
		$dirs['path']   = $dirs['basedir'] . $dirs['subdir'];
		$dirs['url']    = $dirs['baseurl'] . $dirs['subdir'];

		return $dirs;
	}
}
