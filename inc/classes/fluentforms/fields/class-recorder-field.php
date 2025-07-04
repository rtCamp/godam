<?php
/**
 * Recorder field for fluent forms.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\FluentForms\Fields;

use RTGODAM\Inc\Traits\Singleton;
use FluentForm\App\Helpers\Helper;
use FluentForm\App\Services\FormBuilder\BaseFieldManager;

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
			'godam-recorder_field',
			'GoDAM Recorder',
			array( 'godam', 'recorder' ),
			'general',
		);

		// Add ajax action for the recorder field to upload the file to temp folder.
		add_action( 'wp_ajax_ff_godam_recorder_upload', array( $this, 'upload_file_to_temp' ) );
		add_action( 'wp_ajax_nopriv_ff_godam_recorder_upload', array( $this, 'upload_file_to_temp' ) );

		/**
		 * Initialize all values.
		 */
		$this->editor_label = __( 'Godam Recorder', 'godam' );
		$this->button_text  = __( 'Record Video', 'godam' );
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
					'required'       => array(
						'value'          => false,
						'global'         => true,
						'message'        => Helper::getGlobalDefaultMessage( 'required' ),
						'global_message' => Helper::getGlobalDefaultMessage( 'required' ),
					),
					'max_file_size'  => array(
						'value'          => wp_max_upload_size(),
						'_valueFrom'     => 'MB',
						'global'         => true,
						'message'        => Helper::getGlobalDefaultMessage( 'max_file_size' ),
						'global_message' => Helper::getGlobalDefaultMessage( 'max_file_size' ),
					),
					'max_file_count' => array(
						'value'          => 1,
						'message'        => Helper::getGlobalDefaultMessage( 'max_file_count' ),
						'global_message' => Helper::getGlobalDefaultMessage( 'max_file_count' ),
						'global'         => true,
					),
				),
				'conditional_logics' => array(),
			),
			'editor_options' => array(
				'title'      => $this->editor_label,
				'icon_class' => 'ff-edit-keyboard-o',
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
				array( 'jquery' ),
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
	 * @param array<mixed> $form Form data.
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
		$name                   = $data['attributes']['name'] ?? 'recoder_field';
		$id                     = $this->makeElementId( $data, $form );
		$class                  = $data['attributes']['class'] ?? 'godam-recorder';
		$unique_element_key     = $data['uniqElKey'] ?? '';
		$input_id               = $id . '_' . $unique_element_key;
		$video_upload_button_id = wp_unique_id( 'uppy-video-upload-' );
		$button_text            = $data['settings']['btn_text'] ?? __( 'Record Video', 'godam' );
		$file_selectors         = $data['settings']['file_selector'] ?? array( 'screen_capture', 'webcam' );

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
			<div class="ff-godam-recorder-wrapper">
				<input
					type="hidden"
					name="max-file-size"
					value="<?php echo esc_attr( $max_file_size ); ?>"
				/>
				<input
					name="<?php echo esc_attr( $name . '-godam-input-recorder' ); ?>"
					id="<?php echo esc_attr( $input_id ); ?>"
					type="file"
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
									$max_file_size / 1048576,
								)
							);
						?>
					</div>
					<div id="<?php echo esc_attr( $uppy_preview_id ); ?>" class="uppy-video-upload-preview"></div>
					<div id="<?php echo esc_attr( $uppy_file_name_id ); ?>" class="upp-video-upload-filename srfm-description"></div>
				</div>
				<div style="display: none;" class="ff-uploaded-list godam-recorder">
					<div class="ff-upload-preview" data-src=""></div>
				</div>
			</div>
		<?php
		$return_content = ob_get_clean();

		echo $return_content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
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

			$data_to_send[] = array(
				'file' => $move_file['file'],
				'url'  => $move_file['url'],
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
}