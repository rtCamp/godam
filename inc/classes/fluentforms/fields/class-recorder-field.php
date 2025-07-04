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
			'recorder_field',
			'GoDAM Recorder',
			array( 'godam', 'recorder' ),
			'general',
		);

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
					name="<?php echo esc_attr( $name . '_' . $unique_element_key . '-godam-recorder' ); ?>"
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
			</div>

		<?php
		$return_content = ob_get_clean();

		echo $return_content; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	}
}