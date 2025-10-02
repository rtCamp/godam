<?php
/**
 * Recorder field for fluent forms.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\FluentForms\Fields;

use RTGODAM\Inc\Traits\Singleton;
use FluentForm\App\Helpers\Helper;
use FluentForm\App\Helpers\Protector;
use FluentForm\App\Modules\Form\FormFieldsParser;
use FluentForm\App\Services\FormBuilder\BaseFieldManager;
use FluentForm\Framework\Helpers\ArrayHelper;

defined( 'ABSPATH' ) || exit;

/**
 * Class Recorder_Field.
 */
class Recorder_Field extends BaseFieldManager {

	/**
	 * Singleton.
	 */
	use Singleton;

	/**
	 * Editor text.
	 *
	 * @var string
	 */
	private $editor_label;

	/**
	 * Button text.
	 *
	 * @var string
	 */
	private $button_text;

	/**
	 * Constructor.
	 */
	public function __construct() {

		// Call parent constructor.
		parent::__construct(
			'godam-recorder-field',
			'GoDAM Recorder',
			array( 'godam', 'recorder' ),
			'general',
		);

		// Add ajax action for the recorder field to upload the file to temp folder.
		add_action( 'wp_ajax_ff_godam_recorder_upload', array( $this, 'upload_file_to_temp' ) );
		add_action( 'wp_ajax_nopriv_ff_godam_recorder_upload', array( $this, 'upload_file_to_temp' ) );

		/**
		 * Filter the submission data.
		 */
		add_filter( 'fluentform/input_data_' . $this->key, array( $this, 'handle_recorder_field_data' ), 10, 2 );

		/**
		 * Validate input for empty field, other validation done on ajax request.
		 */
		add_filter( 'fluentform/validate_input_item_' . $this->key, array( $this, 'handle_recorder_field_validation' ), 10, 3 );

		/**
		 * Filter to change entry markup data.
		 */
		add_filter( 'fluentform/response_render_' . $this->key, array( $this, 'render_recorder_field_markup' ), 10, 4 );

		/**
		 * Register the script to eneque for the fluent forms admin.
		 */
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_player_scripts' ), PHP_INT_MAX );

		/**
		 * Initialize all values.
		 */
		$this->editor_label = __( 'Godam Recorder', 'godam' );
		$this->button_text  = __( 'Record Video', 'godam' );
	}

	/**
	 * Register the script to enqueue on entries.
	 *
	 * @return void
	 */
	public function enqueue_player_scripts() {

		/**
		 * Get entry details page.
		 */
		$fluent_form_route = empty( $_GET['route'] ) ? '' : sanitize_text_field( $_GET['route'] ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		/**
		 * Check for fluent forms page.
		 */
		if ( ! Helper::isFluentAdminPage() || 'entries' !== sanitize_text_field( $fluent_form_route ) ) {
			return;
		}

		/**
		 * Enqueue scripts.
		 */
		if ( ! wp_script_is( 'godam-fluentforms-editor' ) ) {
			wp_enqueue_script(
				'godam-fluentforms-editor',
				RTGODAM_URL . 'assets/build/js/godam-fluentforms-editor.min.js',
				array( 'wp-data', 'wp-url' ),
				filemtime( RTGODAM_PATH . 'assets/build/js/godam-fluentforms-editor.min.js' ),
				true
			);
		}

		wp_enqueue_script(
			'godam-player-frontend',
			RTGODAM_URL . 'assets/build/js/godam-player-frontend.min.js',
			array( 'godam-fluentforms-editor' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/godam-player-frontend.min.js' ),
			true
		);

		wp_enqueue_script(
			'godam-player-analytics',
			RTGODAM_URL . 'assets/build/js/godam-player-analytics.min.js',
			array( 'godam-player-frontend' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/godam-player-analytics.min.js' ),
			true
		);

		wp_enqueue_style(
			'godam-player-frontend-style',
			RTGODAM_URL . 'assets/build/css/godam-player-frontend.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/godam-player-frontend.css' )
		);

		wp_enqueue_style(
			'godam-player-style',
			RTGODAM_URL . 'assets/build/css/godam-player.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/godam-player.css' )
		);

		wp_enqueue_style(
			'godam-player-minimal-skin',
			RTGODAM_URL . 'assets/build/css/minimal-skin.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/minimal-skin.css' )
		);

		wp_enqueue_style(
			'godam-player-pills-skin',
			RTGODAM_URL . 'assets/build/css/pills-skin.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/pills-skin.css' )
		);

		wp_enqueue_style(
			'godam-player-bubble-skin',
			RTGODAM_URL . 'assets/build/css/bubble-skin.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/bubble-skin.css' )
		);

		/**
		 * Localize the script.
		 */
		wp_localize_script(
			'godam-player-frontend',
			'godamData',
			array(
				'apiBase' => RTGODAM_API_BASE,
			)
		);
	}

	/**
	 * Create component for the Recorder field.
	 *
	 * @return array<mixed>
	 */
	public function getComponent() {

		return array(
			'index'          => 1,
			'element'        => $this->key,
			'attributes'     => array(
				'name'  => $this->key,
				'value' => '',
				'type'  => 'file',
			),
			'settings'       => array(
				'label'              => $this->title,
				'help_message'       => '',
				'btn_text'           => $this->button_text,
				'file_selector'      => array( 'screen_capture', 'webcam' ),
				'validation_rules'   => array(
					'required'           => array(
						'value'          => false,
						'global'         => true,
						'message'        => Helper::getGlobalDefaultMessage( 'required' ),
						'global_message' => Helper::getGlobalDefaultMessage( 'required' ),
					),
					'max_file_size'      => array(
						'value'          => wp_max_upload_size(),
						'_valueFrom'     => 'MB',
						'global'         => true,
						'message'        => Helper::getGlobalDefaultMessage( 'max_file_size' ),
						'global_message' => Helper::getGlobalDefaultMessage( 'max_file_size' ),
					),
					'max_file_count'     => array(
						'value'          => 1,
						'message'        => Helper::getGlobalDefaultMessage( 'max_file_count' ),
						'global_message' => Helper::getGlobalDefaultMessage( 'max_file_count' ),
						'global'         => true,
					),
					'allowed_file_types' => array(
						'value'          => array( 'avi|divx|flv|mov|ogv|mkv|mp4|m4v|divx|mpg|mpeg|mpe|video/quicktime|qt|webm' ),
						'global'         => false,
						'message'        => Helper::getGlobalDefaultMessage( 'allowed_file_types' ),
						'global_message' => Helper::getGlobalDefaultMessage( 'allowed_file_types' ),
					),
				),
				'conditional_logics' => array(),
			),
			'editor_options' => array(
				'title'      => $this->editor_label,
				'icon_class' => 'ff-edit-files',
				'template'   => 'inputText',
			),
		);
	}

	/**
	 * Get general editor elements.
	 *
	 * @return string[]
	 */
	public function getGeneralEditorElements() {
		return array(
			'label',
			'btn_text',
			'validation_rules',
			'file_selector',
		);
	}

	/**
	 * Get Advanced Editor Elements.
	 *
	 * @return string[]
	 */
	public function getAdvancedEditorElements() {
		return array(
			'help_message',
			'name',
		);
	}

	/**
	 * Create custom general element, like selection for file selectors.
	 *
	 * @return array<mixed>
	 */
	public function generalEditorElement() {
		return array(
			'file_selector' => array(
				'template' => 'inputCheckbox',
				'label'    => __( 'Choose file selector', 'godam' ),
				'options'  => array(
					array(
						'value' => 'file_input',
						'label' => __( 'Local files', 'godam' ),
					),
					array(
						'value' => 'webcam',
						'label' => __( 'Webcam', 'godam' ),
					),
					array(
						'value' => 'screen_capture',
						'label' => __( 'Screencast', 'godam' ),
					),
					array(
						'value' => 'audio',
						'label' => __( 'Audio Recording', 'godam' ),
					),
				),
			),
		);
	}

	/**
	 * Render the uppy recorder script.
	 *
	 * @return void
	 */
	private function render_recorder_script() {

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

		if ( ! wp_script_is( 'fluentforms-godam' ) ) {
			/**
			 * Enqueue script if not already enqueued.
			 */
			wp_enqueue_script(
				'fluentforms-godam',
				RTGODAM_URL . 'assets/build/js/fluentforms.min.js',
				array( 'jquery', 'wp-i18n' ),
				filemtime( RTGODAM_PATH . 'assets/build/js/fluentforms.min.js' ),
				true
			);

			/**
			 * Localize the script for fluent forms.
			 */
			wp_localize_script(
				'fluentforms-godam',
				'RecorderFluentForms',
				array(
					'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
					'nonce'        => wp_create_nonce( 'recorder-fluentforms' ),
					'uploadAction' => 'ff_godam_recorder_upload',
				)
			);
		}
	}

	/**
	 * Render the input field.
	 *
	 * @param array<mixed> $data Field data.
	 * @param object       $form Form data.
	 *
	 * @return void
	 */
	public function render( $data, $form ) {

		/**
		 * Create duplicate data.
		 */
		$duplicate_data = $data;

		$this->render_recorder_script();

		/**
		 * Get required data for markup.
		 */
		$max_file_size          = $data['settings']['validation_rules']['max_file_size']['value'] ?? wp_max_upload_size();
		$name                   = $data['attributes']['name'] ?? 'godam-recorder';
		$id                     = $this->makeElementId( $data, $form );
		$class                  = $data['attributes']['class'] ?? 'godam-recorder';
		$unique_element_key     = $data['uniqElKey'] ?? '';
		$input_id               = $id . '_' . $unique_element_key;
		$video_upload_button_id = wp_unique_id( 'uppy-video-upload-' );
		$button_text            = $data['settings']['btn_text'] ?? __( 'Record Video', 'godam' );
		$file_selectors         = $data['settings']['file_selector'] ?? array( 'screen_capture', 'webcam' );
		$form_instance          = Helper::$formInstance; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
		$form_id                = $form->id;
		$form_instance_name     = 'fluent_form_ff_form_instance_' . $form_id . '_' . $form_instance;
		$required               = $data['settings']['validation_rules']['required']['value'] ?? false;

		/**
		 * Uppy container.
		 */
		$uppy_container_id = sprintf( 'uppy_container_%s_%s', $id, $unique_element_key );
		$uppy_file_name_id = sprintf( 'uppy_filename_%s_%s', $id, $unique_element_key );
		$uppy_preview_id   = sprintf( 'uppy_preview_%s_%s', $id, $unique_element_key );

		/**
		 * Update ID for duplicate data.
		 */
		$duplicate_data['attributes']['id'] = $video_upload_button_id;

		/**
		 * Build element label.
		 */
		$label_element = $this->buildElementLabel( $duplicate_data, $form );

		ob_start();
		?>
			<div class="ff-godam-recorder-wrapper ff-el-group">
				<div class="ff-el-input--content">
					<input
						type="hidden"
						name="max-file-size"
						value="<?php echo esc_attr( $max_file_size ); ?>"
					/>
					<input
						name="<?php echo esc_attr( $name ); ?>"
						id="<?php echo esc_attr( $input_id ); ?>"
						data-form-id="<?php echo esc_attr( $form_id ); ?>"
						data-form-instance="<?php echo esc_attr( $form_instance_name ); ?>"
						type="file"
						multiple="1"
						aria-required="<?php echo esc_attr( $required ? 'true' : '' ); ?>"
						style="display: none;"
						class="rtgodam-hidden <?php echo esc_attr( $class ); ?>"
					/>

					<?php echo $label_element; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
					<div
						style="margin: 4px 0;"
						data-max-size="<?php echo esc_attr( $max_file_size ); ?>"
						id="<?php echo esc_attr( $uppy_container_id ); ?>"
						class="uppy-video-upload"
						data-input-id="<?php echo esc_attr( $input_id ); ?>"
						data-video-upload-button-id="<?php echo esc_attr( $video_upload_button_id ); ?>"
						data-file-selectors="<?php echo esc_attr( implode( ',', $file_selectors ) ); ?>"
					>
						<button
							type="button"
							id="<?php echo esc_attr( $video_upload_button_id ); ?>"
							class="uppy-video-upload-button ff-btn ff-btn-submit ff-btn-md ff_btn_style"
						>
							<span class="dashicons dashicons-video-alt"></span>
							<?php echo esc_html( $button_text ); ?>
						</button>
						<div style="margin: 4px 0;">
							<?php
								echo esc_html(
									sprintf(
										// Translators: %s will be replaced with the maximum file upload size allowed on the server (e.g., "300MB").
										__( 'Maximum allowed on this server: %s MB', 'godam' ),
										(int) ( $max_file_size / 1048576 ),
									)
								);
							?>
						</div>
						<div id="<?php echo esc_attr( $uppy_preview_id ); ?>" class="uppy-video-upload-preview"></div>
						<div id="<?php echo esc_attr( $uppy_file_name_id ); ?>" class="upp-video-upload-filename"></div>
					</div>
					<div style="display: none;" class="ff-uploaded-list godam-recorder">
					</div>
				</div>
			</div>
		<?php
		$return_content = ob_get_clean();

		echo $return_content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}

	/**
	 * Filter the submitted value for the recorder element.
	 *
	 * @param array|string $value Value from request.
	 * @param array<mixed> $field Current field.
	 *
	 * @return array Updated value.
	 */
	public function handle_recorder_field_data( $value, $field ) {

		// Bail early.
		if ( $field['element'] !== $this->key ) {
			return $value;
		}

		/**
		 * Get the current value.
		 */
		$current_value = is_array( $value ) ? $value[0] : $value;

		/**
		 * Decrypt the URL.
		 */
		$decrypted_value = $this->decrypt_url_for_recorder( $current_value );

		if ( empty( $decrypted_value ) ) {
			return $value;
		}

		/**
		 * Update the value.
		 */
		if ( is_array( $value ) ) {
			$value[0] = $decrypted_value;
		} else {
			$value = $decrypted_value;
		}

		return $value;
	}

	/**
	 * Handle validation for the required field.
	 *
	 * @param string       $error_message Error Message.
	 * @param array<mixed> $field         Current Field.
	 * @param array<mixed> $form_data     Form Data.
	 *
	 * @return string
	 */
	public function handle_recorder_field_validation( $error_message, $field, $form_data ) {

		/**
		 * Get input name.
		 */
		$input_name = ArrayHelper::get( $field, 'raw.attributes.name' );

		/**
		 * Get value.
		 */
		$value = ArrayHelper::get( $form_data, $input_name );

		// Bail if we have value.
		if ( is_array( $value ) && ! empty( $value[0] ) ) {
			return $error_message;
		} elseif ( empty( $value ) ) {
			return $error_message;
		}

		$is_required = ArrayHelper::get( $field, 'raw.settings.validation_rules.required.value' );

		// Bail if input is not required.
		if ( ! $is_required ) {
			return $error_message;
		}

		/**
		 * Extract error message for empty field, that is required.
		 */
		$error_message = ArrayHelper::get( $field, 'raw.settings.validation_rules.required.message' );

		// Return erorr message string for required.
		return $error_message;
	}

	/**
	 * Upload the file to temp folder.
	 *
	 * @return void
	 */
	public function upload_file_to_temp() {

		/**
		 * Verify nonce and ajax referrer.
		 */
		if ( ! check_ajax_referer( 'recorder-fluentforms', 'nonce' ) ) {
			wp_send_json_error( __( 'Nonce is not valid', 'godam' ), 400 );
		}

		/**
		 * Get form ID.
		 */
		$form_id = ! empty( $_REQUEST['ff-form-id'] ) ? sanitize_text_field( $_REQUEST['ff-form-id'] ) : 0;

		if ( ! function_exists( 'wpFluent' ) ) {
			wp_send_json_error(
				__( 'Fluent forms does not exists.', 'godam' ),
				400
			);
		}

		/**
		 * Get the form.
		 */
		$form = wpFluent()->table( 'fluentform_forms' )->find( $form_id );

		if ( empty( $form ) ) {
			wp_send_json_error(
				__( 'Form does not exists', 'godam' ),
				400,
			);
		}

		$data_to_send = array();

		/**
		 * Change the upload dir.
		 */
		add_filter( 'upload_dir', array( $this, 'change_upload_dir' ) );

		// Work with files.
		foreach ( $_FILES as $input_key => $file_data ) {

			if ( false === strpos( $input_key, '-godam-input-recorder' ) ) {
				continue;
			}

			/**
			 * Get the field data.
			 */
			$field = FormFieldsParser::getField(
				$form,
				array( 'godam-recorder-field' ),
				'godam-recorder-field',
				array( 'rules', 'settings' )
			);

			if ( $field ) {
				$validation_rules = $field['godam-recorder-field']['settings']['validation_rules'];
				$errors           = $this->validate_file( $validation_rules, $file_data );

				if ( $errors ) {
					wp_send_json(
						array(
							'error' => $errors,
						),
						422,
					);
				}
			}

			$temp_path  = $file_data['tmp_name'];
			$file_name  = $file_data['name'];
			$file_size  = $file_data['size'];
			$file_type  = $file_data['type'];
			$file_error = $file_data['error'];

			/**
			 * Handle size, error, 0 means no size.
			 */
			if ( ( 0 === $file_size || $file_error ) ) {
				wp_send_json_error(
					array(
						'message' => __( 'Error in file.', 'godam' ),
					)
				);
			}

			$file_name = $this->update_filename( $file_name );

			$uploaded_file = array(
				'name'     => $file_name,
				'type'     => $file_type,
				'tmp_name' => $temp_path,
				'error'    => $file_error,
				'size'     => $file_size,
			);

			$upload_overrides  = array(
				'test_form' => false,
			);
			$move_file         = wp_handle_upload( $uploaded_file, $upload_overrides );
			$move_file['file'] = wp_basename( $move_file['file'] );

			$file = ArrayHelper::get( $move_file, 'file' );

			/**
			 * Encrypt using fleuntforms class.
			 */
			$move_file['file'] = Protector::encrypt( $file );
			$move_file['url']  = str_replace( $file, $move_file['file'], $move_file['url'] );

			$data_to_send[] = array(
				'file' => $move_file['file'],
				'url'  => $move_file['url'],
				'type' => $move_file['type'],
			);
		}

		/**
		 * Remove the filter.
		 */
		remove_filter( 'upload_dir', array( $this, 'change_upload_dir' ) );

		/**
		 * Send the data.
		 */
		wp_send_json_success(
			$data_to_send,
			200
		);
	}

	/**
	 * Change upload dir to godam directory in uploads.
	 *
	 * @param array<mixed> $dirs upload directory.
	 *
	 * @return array<mixed>
	 */
	public function change_upload_dir( $dirs ) {

		$dirs['subdir'] = '/godam-ff/temp';
		$dirs['path']   = $dirs['basedir'] . $dirs['subdir'];
		$dirs['url']    = $dirs['baseurl'] . $dirs['subdir'];

		return $dirs;
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
		$prefix = 'godam-ff-' . md5( uniqid( wp_rand() ) ) . '-godam-ff-';

		return $prefix . sanitize_file_name( $filename );
	}

	/**
	 * Validate the given file with the validation errors.
	 *
	 * @param array<mixed> $validation_rules Validation rules.
	 * @param array<mixed> $file_data        File data.
	 *
	 * @return string[]
	 */
	private function validate_file( $validation_rules, $file_data ) {

		$file_size = $file_data['size'];
		$file_name = $file_data['name'];

		$max_size  = $validation_rules['max_file_size']['value'] ?? 1048576;
		$file_type = $validation_rules['allowed_file_types']['value'] ?? array( 'avi|divx|flv|mov|ogv|mkv|mp4|m4v|divx|mpg|mpeg|mpe|video\/quicktime|qt|webm' );

		$types_flat = array();

		/**
		 * Add to pattern foreach file type.
		 */
		foreach ( $file_type as $item ) {
			$split = explode( '|', $item );
			foreach ( $split as $type ) {
				$types_flat[] = trim( $type );
			}
		}

		$escaped_types = array_map(
			function ( $type ) {
				return preg_quote( $type, '/' );
			},
			$types_flat
		);

		$errors = array();

		if ( $max_size < $file_size ) {
			$errors[] = $validation_rules['max_file_size']['message'];
		}

		$pattern  = '/(' . implode( '|', $escaped_types ) . '|webm)/i';
		$file_ext = strtolower( pathinfo( $file_name, PATHINFO_EXTENSION ) );

		if ( ! preg_match( $pattern, $file_ext ) ) {
			$errors[] = $validation_rules['allowed_file_types']['message'];
		}

		return $errors;
	}

	/**
	 * Function to decrypt the URL.
	 *
	 * @param string $url URL to be decrypted.
	 *
	 * @return string
	 */
	private function decrypt_url_for_recorder( $url ) {

		/**
		 * Create upload dir.
		 */
		$upload_dir = str_replace( '/', '\/', '/godam-ff/temp' ); // phpcs:ignore WordPressVIPMinimum.Security.StaticStrreplace.StaticStrreplace

		/**
		 * Create pattern.
		 */
		$pattern = "/(?<={$upload_dir}\/).*$/";

		/**
		 * Match the pattern with URL.
		 */
		preg_match( $pattern, $url, $match );

		if ( ! empty( $match ) ) {
			$url = str_replace( $match[0], Protector::decrypt( $match[0] ), $url );
		}

		return $url;
	}

	/**
	 * To add the entry detail markup for the recorder field.
	 *
	 * @param array<mixed> $response Response.
	 * @param array<mixed> $field    Field Id.
	 * @param int          $form_id  Form Id.
	 * @param bool         $is_html  Is HTML markup to use.
	 *
	 * @return string
	 */
	public function render_recorder_field_markup( $response, $field, $form_id, $is_html ) {

		// Bail early.
		if ( empty( $response ) || empty( $response[0] ) ) {
			return $response;
		}

		if ( ! $is_html ) {
			return $response;
		}
		
		$file_path = $response[0];
		$file_type = wp_check_filetype( $file_path );
		$is_video  = strpos( $file_type['type'], 'video' ) !== false;
		$is_audio  = strpos( $file_type['type'], 'audio' ) !== false;
		
		// if webm file extension and mime type is not detected correctly then check by file name.
		// The files created by uppy webcam, screen capture, and audio plugin are in same format, so we are checking the filename to determine if it's an audio file.
		if ( 'webm' === $file_type['ext'] && godam_is_audio_file_by_name( $file_path ) ) {
			$is_video = false;
			$is_audio = true;
		}

		// Fetch the entry id.
		$entry_id = 0;

		// Global object.
		global $wp;

		/**
		 * Get entry ID from rest route.
		 */
		if ( ! empty( $wp->query_vars['rest_route'] ) && preg_match( '#^/fluentform/v1/submissions/(\d+)$#', $wp->query_vars['rest_route'], $matches ) ) {
			$entry_id = intval( $matches[1] );
		}

		if ( 0 === $entry_id ) {
			return $response;
		}

		/**
		 * Fetch the transcoding URL from meta.
		 */
		$transcoded_url_meta_key = 'rtgodam_transcoded_url_fluentforms_' . $form_id . '_' . $entry_id;

		/**
		 * Get submission meta data.
		 */
		$submission_meta = wpFluent()->table( 'fluentform_submission_meta' )
							->where( 'meta_key', $transcoded_url_meta_key )
							->where( 'form_id', $form_id )
							->where( 'response_id', $entry_id )
							->first();

		/**
		 * Transcoded URL output.
		 */
		$transcoded_url_output          = '';
		$transcoded_url_shortcode_param = '';

		if ( ! empty( $submission_meta ) ) {
			$transcoded_url                = esc_url( $submission_meta->value );
			$transcoded_url_shortcode_param = "transcoded_url={$transcoded_url}";
			$transcoded_url_output          = sprintf(
				"<div style='margin: 8px 0;' class='godam-transcoded-url-info'><span class='dashicons dashicons-yes-alt'></span><strong>%s</strong></div>",
				esc_html__( 'Video saved and transcoded successfully on GoDAM', 'godam' )
			);
		}

		if ( $is_video ) {
			/**
			 * Generate video output.
			 */
			$video_output = do_shortcode( "[godam_video src='$file_path' $transcoded_url_shortcode_param]" );
			$video_output = '<div class="gf-godam-video-preview">' . $video_output . '</div>';
			
			$download_url = sprintf(
				'<div style="margin: 12px 0;"><a type="button" class="el-button el-button--primary el-button--small" target="_blank" href="%s">%s</a></div>',
				esc_url( $file_path ),
				__( 'Click to view', 'godam' )
			);
			
			$video_output = $download_url . $transcoded_url_output . $video_output;
			return $video_output;
		}
		
		if ( $is_audio ) {
			$audio_output = sprintf(
				'<audio controls><source src="%1$s" type="%2$s">Your browser does not support the audio element.</audio>',
				esc_url( $file_path ),
				esc_attr( $file_type['type'] )
			);
			$audio_output = '<div class="gf-godam-audio-preview">' . $audio_output . '</div>';
			return $audio_output;
		}
		
		return '';
	}
}
