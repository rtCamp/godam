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
		 * Check for max file size and look for maximum value.
		 */
		foreach ( $submission_data as $key => $value ) {
			if ( str_ends_with( $key, '-max-file-size' ) ) {
				$accepted_file_size = $value > $accepted_file_size ? $value : $accepted_file_size;
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
			if ( ! str_ends_with( $input_key, '-recorder' ) ) {
				continue;
			}

			$temp_path  = $file_data['tmp_name'];
			$file_name  = $file_data['name'];
			$file_size  = $file_data['size'];
			$file_type  = $file_data['type'];
			$file_error = $file_data['error'];

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

		$form_name = $form_submit_response['form_name'] ?? '';
		$entry_id  = $form_submit_response['entry_id'] ?? 0;

		/**
		 * Get form data.
		 */
		$form_data = $form_submit_response['data'];

		foreach ( $form_data as $key => $value ) {
			if ( str_ends_with( $key, '-input-recorder' ) ) {
				$this->send_data_to_godam( $form_name, $entry_id, $value );
			}
		}
	}

	/**
	 * Send files to GoDam for transcoding.
	 *
	 * @param string $form_name Form Name.
	 * @param int    $entry_id  Entry Id.
	 * @param string $file_url  File URL.
	 *
	 * @return void
	 */
	private function send_data_to_godam( $form_name, $entry_id, $file_url ) {

		$file_extension = pathinfo( $file_url, PATHINFO_EXTENSION );

		$default_settings = array(
			'video' => array(
				'adaptive_bitrate'     => true,
				'watermark'            => false,
				'watermark_text'       => '',
				'watermark_url'        => '',
				'video_thumbnails'     => 0,
				'overwrite_thumbnails' => false,
				'use_watermark_image'  => false,
			),
		);

		$godam_settings = get_option( 'rtgodam-settings', $default_settings );

		$rtgodam_watermark           = $godam_settings['video']['watermark'];
		$rtgodam_use_watermark_image = $godam_settings['video']['use_watermark_image'];
		$rtgodam_watermark_text      = sanitize_text_field( $godam_settings['video']['watermark_text'] );
		$rtgodam_watermark_url       = esc_url( $godam_settings['video']['watermark_url'] );

		$watermark_to_use = array();

		// Include watermark settings only if watermark is enabled.
		if ( $rtgodam_watermark ) {
			if ( $rtgodam_use_watermark_image && ! empty( $rtgodam_watermark_url ) ) {
				$watermark_to_use['watermark_url'] = $rtgodam_watermark_url;
			} elseif ( ! $rtgodam_use_watermark_image && ! empty( $rtgodam_watermark_text ) ) {
				$watermark_to_use['watermark_text'] = $rtgodam_watermark_text;
			}
		}

		$callback_url = rest_url( 'godam/v1/transcoder-callback' );

		/**
		 * Manually setting the rest api endpoint, we can refactor that later to use similar functionality as callback_url.
		 */
		$status_callback_url = get_rest_url( get_current_blog_id(), '/godam/v1/transcoding/transcoding-status' );

		/**
		 * Get API key.
		 */
		$api_key = get_site_option( 'rtgodam-api-key', '' );

		$body = array_merge(
			array(
				'api_token'       => $api_key,
				'job_type'        => 'stream',
				'job_for'         => 'srfm-godam-recorder',
				'file_origin'     => rawurlencode( $file_url ),
				'callback_url'    => rawurlencode( $callback_url ),
				'status_callback' => rawurlencode( $status_callback_url ),
				'force'           => 0,
				'formats'         => $file_extension,
				'thumbnail_count' => 0,
				'stream'          => true,
				'watermark'       => boolval( $rtgodam_watermark ),
				'resolutions'     => array( 'auto' ),
				'folder_name'     => $form_name ?? __( 'Sureforms', 'godam' ),
			),
			$watermark_to_use
		);

		$args = array(
			'method'    => 'POST',
			'sslverify' => false,
			'timeout'   => 60, // phpcs:ignore WordPressVIPMinimum.Performance.RemoteRequestTimeout.timeout_timeout
			'body'      => $body,
		);

		$transcoding_api_url = RTGODAM_API_BASE . '/api/';
		$transcoding_url     = $transcoding_api_url . 'resource/Transcoder Job';

		/**
		 * Do remote post.
		 */
		$upload_page = wp_remote_post( $transcoding_url, $args );

		if ( ! is_wp_error( $upload_page ) &&
			(
				isset( $upload_page['response']['code'] ) &&
				200 === intval( $upload_page['response']['code'] )
			)
		) {
			$upload_info = json_decode( $upload_page['body'] );

			if ( isset( $upload_info->data ) && isset( $upload_info->data->name ) ) {
				$job_id = $upload_info->data->name;
				add_option(
					$job_id,
					array(
						'source'   => 'srfm_godam_recorder',
						'entry_id' => $entry_id,
					)
				);
			}
		} else {
			wp_send_json_error(
				array(
					'message' => sprintf(
						/* translators: %s: Entry ID for which transcoding failed */
						__( 'Transcoding failed for sureforms entry: %s', 'godam' ),
						esc_attr( $entry_id )
					),
				)
			);
		}
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
