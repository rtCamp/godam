<?php
/**
 * GoDAM Recorder Ninja Forms field.
 *
 * @since 1.4.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Ninja_Forms;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Ninja_Forms_Godam_Recorder
 *
 * @since 1.4.0
 */
class Ninja_Forms_Field_Godam_Recorder extends \NF_Abstracts_Field {

	use Singleton;

	/**
	 * Field type.
	 *
	 * @since 1.4.0
	 *
	 * @var string
	 */
	public static $field_type = 'godam_recorder';

	// phpcs:disable PSR2.Classes.PropertyDeclaration.Underscore

	/**
	 * Field parent type.
	 *
	 * @since 1.4.0
	 *
	 * @access protected
	 *
	 * @var string
	 */
	protected $_parent_type = 'textbox';

	/**
	 * Field section.
	 *
	 * @since 1.4.0
	 *
	 * @access protected
	 *
	 * @var string
	 */
	protected $_section = 'common';

	/**
	 * Field templates.
	 *
	 * @since 1.4.0
	 *
	 * @access protected
	 *
	 * @var string
	 */
	protected $_templates = 'godam_recorder';

	/**
	 * Field icon.
	 *
	 * @since 1.4.0
	 *
	 * @access protected
	 *
	 * @var string
	 */
	protected $_icon = 'file';

	/**
	 * Field test value.
	 *
	 * @since 1.4.0
	 *
	 * @access protected
	 *
	 * @var bool
	 */
	protected $_test_value = false;

	/**
	 * All settings fields.
	 *
	 * @since 1.4.0
	 *
	 * @access protected
	 *
	 * @var array
	 */
	protected $_settings_all_fields = array(
		'key',
		'label',
		'label_pos',
		'required',
		'classes',
		'manual_key',
		'description',
	);

	// phpcs:enable PSR2.Classes.PropertyDeclaration.Underscore

	/**
	 * Constructor.
	 *
	 * @since 1.4.0
	 */
	public function __construct() {

		$this->_name     = self::$field_type;
		$this->_type     = self::$field_type;
		$this->_nicename = __( 'GoDAM Recorder', 'godam' );

		parent::__construct();

		// Load the field settings.
		$settings        = $this->config( 'field-settings' );
		$this->_settings = array_merge( $this->_settings, $settings );

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
		// Add backend template for the field.
		add_action( 'nf_admin_enqueue_scripts', array( $this, 'admin_enqueue_scripts' ) );

		// Enqueue frontend scripts.
		add_filter( 'ninja_forms_localize_fields', array( $this, 'frontend_enqueue_scripts' ) );
		add_filter( 'ninja_forms_localize_fields_preview', array( $this, 'frontend_enqueue_scripts' ) );

		// Ajax action for upload.
		add_action( 'wp_ajax_nf_godam_upload', array( $this, 'ajax_upload' ) );
		add_action( 'wp_ajax_nopriv_nf_godam_upload', array( $this, 'ajax_upload' ) );

		// After submission.
		add_action( 'ninja_forms_after_submission', array( $this, 'handle_recorder_submission' ) );

		// Handle transcoding callback.
		add_action( 'rtgodam_handle_callback_finished', array( $this, 'handle_transcoding_callback' ), 10, 4 );
	}

	/**
	 * Config.
	 *
	 * @param string $file_name File Name to include.
	 *
	 * @since 1.4.0
	 *
	 * @return mixed
	 */
	private function config( $file_name ) {
		return include RTGODAM_PATH . 'inc/classes/ninja-forms/config/' . $file_name . '.php';
	}

	/**
	 * Add template for the field backend editor.
	 *
	 * @param string $file_name File Name to include.
	 *
	 * @since 1.4.0
	 *
	 * @return mixed
	 */
	private function template( $file_name ) {
		return include RTGODAM_PATH . 'inc/classes/ninja-forms/templates/' . $file_name;
	}

	/**
	 * Add Template for the field builder.
	 *
	 * @since 1.4.0
	 *
	 * @return void
	 */
	public function admin_enqueue_scripts() {
		$this->template( 'fields-godam_recorder.html' );
	}

	/**
	 * Update the localization settings.
	 *
	 * @param array  $settings Field settings.
	 * @param object $form     Form object.
	 *
	 * @since 1.4.0
	 *
	 * @return array
	 */
	public function localize_settings( $settings, $form ) {

		$form_id = is_array( $form ) ? $form['id'] : $form->get_id();

		$max_file_size_mb = wp_max_upload_size() / ( 1024 * 1024 );
		if ( isset( $settings['max_file_size'] ) && ! empty( $settings['max_file_size'] ) ) {
			$max_file_size_mb = $settings['max_file_size'];
		}

		$settings['max_file_size_mb'] = $max_file_size_mb;
		$settings['max_file_size']    = $settings['max_file_size_mb'] * 1024 * 1024;

		$nonce_data                        = $this->create_nonce_field( $settings['id'] );
		$settings['recorder_nonce']        = $nonce_data['nonce'];
		$settings['recorder_nonce_expiry'] = $nonce_data['nonce_expiry'];

		$settings['record_button_text'] = ! empty( $settings['record_button_text'] ) ? $settings['record_button_text'] : __( 'Start Recording', 'godam' );

		$file_selector_arr = array();

		if ( ! empty( $settings['file_selector-local'] ) ) {
			$file_selector_arr[] = 'file_input';
		}
		if ( ! empty( $settings['file_selector-webcam'] ) ) {
			$file_selector_arr[] = 'webcam';
		}
		if ( ! empty( $settings['file_selector-screen_capture'] ) ) {
			$file_selector_arr[] = 'screen_capture';
		}
		if ( ! empty( $settings['file_selector-audio'] ) ) {
			$file_selector_arr[] = 'audio';
		}

		// If none are set, default to webcam and screen_capture.
		if ( empty( $file_selector_arr ) ) {
			$file_selector_arr = array( 'webcam', 'screen_capture' );
		}

		$settings['file_selectors'] = trim( implode( ',', $file_selector_arr ), ',' );
		$settings['form_id']        = $form_id;

		// Add uppy containers data.
		$uppy_container_id      = sprintf( 'uppy_container_%s_%s', strval( $settings['id'] ), $form_id );
		$uppy_file_name_id      = sprintf( 'uppy_filename_%s_%s', strval( $settings['id'] ), $form_id );
		$uppy_preview_id        = sprintf( 'uppy_preview_%s_%s', strval( $settings['id'] ), $form_id );
		$video_upload_button_id = wp_unique_id( 'uppy-video-upload-' );

		$settings['uppy_container_id']      = $uppy_container_id;
		$settings['uppy_file_name_id']      = $uppy_file_name_id;
		$settings['uppy_preview_id']        = $uppy_preview_id;
		$settings['video_upload_button_id'] = $video_upload_button_id;

		$settings['max_allowed_file_size_info'] = sprintf(
			// Translators: %s will be replaced with the maximum file upload size allowed on the server (e.g., "300MB").
			__( 'Maximum allowed on this server: %s MB', 'godam' ),
			(int) $max_file_size_mb
		);

		return $settings;
	}

	/**
	 * Process the field value.
	 *
	 * @since 1.4.0
	 *
	 * @param object $field Current field object.
	 * @param array  $data  Submitted form data.
	 *
	 * @return void
	 */
	public function process( $field, $data ) {

		// Bail early.
		if ( empty( $field['files'] ) ) {
			return;
		}

		$submission_url = '';

		// Get the submission URL from the uploaded files.
		foreach ( $field['files'] as $file ) {
			$submission_url = $file['path'];
		}

		// Update the value of submission URL.
		foreach ( $data['fields'] as $key => $data_field ) {
			if ( $data_field['id'] === $field['id'] ) {
				// Update the field value with the submission URL.
				$data['fields'][ $key ]['value'] = $submission_url;
				break;
			}
		}

		return $data;
	}

	/**
	 * Enqueue scripts for the frontend.
	 *
	 * @param array|object $field Field settings or object.
	 *
	 * @since 1.4.0
	 *
	 * @return array|object $field
	 */
	public function frontend_enqueue_scripts( $field ) {
		if ( is_array( $field ) && ! isset( $field['settings']['type'] ) ) {
			return $field;
		}

		if ( self::$field_type !== $field['settings']['type'] ) {
			return $field;
		}

		if ( ! wp_script_is( 'godam-uppy-video-style' ) ) {
			/**
			 * Enqueue style for the uppy video.
			 */
			wp_enqueue_style(
				'godam-uppy-video-style',
				RTGODAM_URL . 'assets/build/css/gf-uppy-video.css',
				array(),
				filemtime( RTGODAM_PATH . 'assets/build/css/gf-uppy-video.css' )
			);
		}

		if ( ! wp_script_is( 'godam-recorder-script' ) ) {
			/**
			 * Enqueue script if not already enqueued.
			 */
			wp_enqueue_script(
				'godam-recorder-script',
				RTGODAM_URL . 'assets/build/js/godam-recorder.min.js',
				array( 'jquery' ),
				filemtime( RTGODAM_PATH . 'assets/build/js/godam-recorder.min.js' ),
				true
			);
		}

		if ( ! wp_script_is( 'nf-godam-recorder-upload' ) ) {
			/**
			 * Enqueue script if not already enqueued.
			 */
			wp_enqueue_script(
				'nf-godam-recorder-upload',
				RTGODAM_URL . 'assets/build/js/ninja-forms.min.js',
				array( 'backbone', 'jquery', 'wp-i18n' ),
				filemtime( RTGODAM_PATH . 'assets/build/js/ninja-forms.min.js' ),
				true
			);

			wp_localize_script(
				'nf-godam-recorder-upload',
				'nfGodamRecorderUpload',
				array(
					'ajaxUrl'          => admin_url( 'admin-ajax.php' ),
					'maxFileSizeError' => __( 'File exceeds maximum file size. File must be under %nMB.', 'godam' ),
				)
			);
		}

		return $field;
	}

	/**
	 * Create nonce.
	 *
	 * @param int $field_id Field ID.
	 *
	 * @since 1.4.0
	 *
	 * @return array
	 */
	private function create_nonce_field( $field_id ) {
		return array(
			'nonce'        => wp_create_nonce( 'godam_recorder_' . $field_id ),
			'nonce_expiry' => time() + wp_nonce_tick(),
		);
	}

	/**
	 * Ajax upload handler.
	 *
	 * @since 1.4.0
	 *
	 * @return void
	 */
	public function ajax_upload() {

		$field_id = ! empty( $_POST['field_id'] ) ? intval( sanitize_text_field( wp_unslash( $_POST['field_id'] ) ) ) : 0;
		$nonce    = ! empty( $_POST['nonce'] ) ? sanitize_text_field( wp_unslash( $_POST['nonce'] ) ) : '';

		if ( empty( $nonce ) || ! wp_verify_nonce( $nonce, 'godam_recorder_' . $field_id ) ) {
			wp_send_json_error( __( 'Nonce is not valid', 'godam' ), 400 );
		}

		$form_id = ! empty( $_POST['form_id'] ) ? intval( sanitize_text_field( wp_unslash( $_POST['form_id'] ) ) ) : 0;

		if ( ! function_exists( 'Ninja_Forms' ) ) {
			wp_send_json_error( __( 'Ninja Forms is not active', 'godam' ), 400 );
		}

		$field = Ninja_Forms()->form( $form_id )->field( $field_id )->get();

		if ( ! $field ) {
			wp_send_json_error( __( 'Field not found', 'godam' ), 404 );
		}

		$file_key = 'files-' . $field_id;

		if ( empty( $_FILES[ $file_key ] ) || ! is_array( $_FILES[ $file_key ] ) ) { // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
			wp_send_json_error( __( 'No files uploaded', 'godam' ), 400 );
		}

		$file_data = $_FILES[ $file_key ]; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized

		// Validate file size.
		$max_file_size_mb   = intval( $field->get_setting( 'max_file_size' ) );
		$max_file_size      = $max_file_size_mb * 1024 * 1024;
		$uploaded_file_size = $file_data['size'];

		if ( $max_file_size && $uploaded_file_size > $max_file_size ) {
			wp_send_json_error(
				sprintf(
					// Translators: %s: Maximum allowed file size in MB.
					__( 'File exceeds maximum file size. File must be under %sMB.', 'godam' ),
					$max_file_size_mb
				),
				400
			);
		}

		// Filter to change the upload dir to a custom location.
		add_filter( 'upload_dir', array( $this, 'change_upload_dir' ) );

		$temp_path  = $file_data['tmp_name'];
		$file_name  = $file_data['name'];
		$file_size  = $file_data['size'];
		$file_type  = $file_data['type'];
		$file_error = $file_data['error'];

		$file_name = $this->update_filename( $file_name );

		$upload_file       = array(
			'name'     => $file_name,
			'type'     => $file_type,
			'tmp_name' => $temp_path,
			'error'    => $file_error,
			'size'     => $file_size,
		);
		$upload_overrides  = array(
			'test_form' => false,
		);
		$move_file         = wp_handle_upload( $upload_file, $upload_overrides );
		$move_file['file'] = wp_basename( $move_file['file'] );

		remove_filter( 'upload_dir', array( $this, 'change_upload_dir' ) );

		wp_send_json_success(
			array(
				'file_name' => $move_file['file'],
				'file_path' => $move_file['url'],
			)
		);
	}

	/**
	 * Update the filename to be unique.
	 *
	 * @since 1.4.0
	 *
	 * @param string $filename Current filename.
	 *
	 * @return string
	 */
	private function update_filename( $filename ) {

		/**
		 * Create a unique prefix.
		 */
		$prefix = 'godam-nf-' . md5( uniqid( wp_rand() ) ) . '-godam-nf-';

		return $prefix . sanitize_file_name( $filename );
	}

	/**
	 * Change upload dir to godam directory in uploads.
	 *
	 * @since 1.4.0
	 *
	 * @param array<mixed> $dirs upload directory.
	 *
	 * @return array<mixed>
	 */
	public function change_upload_dir( $dirs ) {

		$dirs['subdir'] = '/godam/ninja-forms/temp';
		$dirs['path']   = $dirs['basedir'] . $dirs['subdir'];
		$dirs['url']    = $dirs['baseurl'] . $dirs['subdir'];

		return $dirs;
	}

	/**
	 * Handle recorder submission.
	 *
	 * @param array<mixed> $form_data Form data.
	 *
	 * @since 1.4.0
	 *
	 * @return void
	 */
	public function handle_recorder_submission( $form_data ) {

		if ( ! rtgodam_is_api_key_valid() ) {
			return;
		}

		// Bail early.
		if ( empty( $form_data ) || empty( $form_data['fields'] ) ) {
			return;
		}

		$form_name = $form_data['settings']['title'] ?? __( 'Ninja Forms', 'godam' );
		$form_id   = $form_data['form_id'] ?? 0;
		$insert_id = $form_data['actions']['save']['sub_id'] ?? 0;

		if ( 0 === $insert_id ) {
			return;
		}

		// Send each recorder type for transcoding.
		foreach ( $form_data['fields'] as $field ) {
			if ( self::$field_type !== $field['type'] ) {
				continue;
			}

			$file_type = wp_check_filetype( $field['value'] );
			$is_audio  = strpos( $file_type['type'], 'audio' ) !== false;
			$is_video  = strpos( $file_type['type'], 'video' ) !== false;

			if ( 'webm' === $file_type['ext'] && godam_is_audio_file_by_name( $field['value'] ) ) {
				$is_audio = true;
				$is_video = false;
			}
			// Send to godam for transcoding.
			$this->send_data_to_godam( $form_name, $form_id, $insert_id, $field['value'], $is_audio ? 'audio' : 'stream' );
		}
	}

	/**
	 * Send files to GoDam for transcoding.
	 *
	 * @since 1.4.0
	 *
	 * @param string $form_title Form Name.
	 * @param int    $form_id    Form Id.
	 * @param int    $entry_id   Entry Id.
	 * @param string $file_url   File URL.
	 * @param string $job_type   Job Type.
	 */
	private function send_data_to_godam( $form_title, $form_id, $entry_id, $file_url, $job_type = 'stream' ) {

		/**
		 * Bail early if no file to send.
		 */
		if ( empty( $file_url ) ) {
			return;
		}

		/**
		 * Form Title.
		 */
		$form_title = ! empty( $form_title ) ? $form_title : __( 'Ninja Forms', 'godam' );

		/**
		 * Send for transcoding.
		 */
		$response_from_transcoding = rtgodam_send_video_to_godam_for_transcoding( 'ninja-forms', $form_title, $file_url, $entry_id, $job_type );

		/**
		 * Error handling.
		 */
		if ( is_wp_error( $response_from_transcoding ) ) {
			wp_send_json_error(
				$response_from_transcoding->get_error_message(),
				$response_from_transcoding->get_error_code(),
			);
		}

		/**
		 * If empty data or name send error.
		 */
		if ( empty( $response_from_transcoding->data ) || empty( $response_from_transcoding->data->name ) ) {
			wp_send_json_error(
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
				'source'   => 'ninja-forms_godam_recorder',
				'entry_id' => $entry_id,
				'form_id'  => $form_id,
			)
		);
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
		if ( ! empty( $job_for ) && 'ninja-forms-godam-recorder' === $job_for && ! empty( $job_id ) && function_exists( 'Ninja_Forms' ) ) {
			$post_array = $request->get_params();

			// Get data stored in options based on job id.
			$data = get_option( $job_id );

			if ( ! empty( $data ) && 'ninja-forms_godam_recorder' === $data['source'] ) {
				$entry_id = $data['entry_id'];
				$form_id  = '';

				if ( empty( $entry_id ) ) {
					return;
				}

				$form_id = get_post_meta( $entry_id, '_form_id', true );

				if ( empty( $form_id ) ) {
					return;
				}

				$meta_key   = 'rtgodam_transcoded_url_ninja-forms_' . $form_id . '_' . $entry_id;
				$meta_value = $post_array['download_url'] ?? '';

				update_post_meta( $entry_id, $meta_key, $meta_value );
			}
		}
	}
}
