<?php
/**
 * GoDAM Recorder Ninja Forms field.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Ninja_Forms;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Ninja_Forms_Godam_Recorder
 *
 * @since n.e.x.t
 */
class Ninja_Forms_Field_Godam_Recorder extends \NF_Abstracts_Field {

	/**
	 * Field type.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	public static $field_type = 'godam_recorder';

	// phpcs:disable PSR2.Classes.PropertyDeclaration.Underscore

	/**
	 * Field parent type.
	 *
	 * @since n.e.x.t
	 *
	 * @access protected
	 *
	 * @var string
	 */
	protected $_parent_type = 'textbox';

	/**
	 * Field section.
	 *
	 * @since n.e.x.t
	 *
	 * @access protected
	 *
	 * @var string
	 */
	protected $_section = 'common';

	/**
	 * Field templates.
	 *
	 * @since n.e.x.t
	 *
	 * @access protected
	 *
	 * @var string
	 */
	protected $_templates = 'godam_recorder';

	/**
	 * Field icon.
	 *
	 * @since n.e.x.t
	 *
	 * @access protected
	 *
	 * @var string
	 */
	protected $_icon = 'file';

	/**
	 * Field test value.
	 *
	 * @since n.e.x.t
	 *
	 * @access protected
	 *
	 * @var bool
	 */
	protected $_test_value = false;

	/**
	 * All settings fields.
	 *
	 * @since n.e.x.t
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
	 * @since n.e.x.t
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

		// Submission table row value.
		add_filter( 'ninja_forms_custom_columns', array( $this, 'submission_table_row_value' ), 10, 2 );
	}

	/**
	 * Config.
	 *
	 * @param string $file_name File Name to include.
	 *
	 * @since n.e.x.t
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
	 * @since n.e.x.t
	 *
	 * @return mixed
	 */
	private function template( $file_name ) {
		return include RTGODAM_PATH . 'inc/classes/ninja-forms/templates/' . $file_name;
	}

	/**
	 * Add Template for the field builder.
	 *
	 * @since n.e.x.t
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
	 * @since n.e.x.t
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

		$settings['record_button_text'] = ! empty( $settings['record_button_text'] ) ? $settings['record_button_text'] : __( 'Record Video', 'godam' );

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
	 * @since n.e.x.t
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
	 * @since n.e.x.t
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
	 * @return void
	 */
	public function ajax_upload() {

		$field_id = ! empty( $_POST['field_id'] ) ? intval( $_POST['field_id'] ) : 0;

		if ( ! check_ajax_referer( 'godam_recorder_' . $field_id, 'nonce' ) ) {
			wp_send_json_error( __( 'Nonce is not valid', 'godam' ), 400 );
		}

		$form_id = ! empty( $_POST['form_id'] ) ? intval( $_POST['form_id'] ) : 0;

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
}
