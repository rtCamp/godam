<?php
/**
 * Forminator GoDAM Record Field.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Forminator_Forms;

if ( ! defined( 'ABSPATH' ) ) {
	die();
}

/**
 * Class Forminator_GoDAM_Record
 * This field allows users to record video via webcam or screen capture.
 */
class Forminator_GoDAM_Record extends \Forminator_Field {
	/**
	 * Field name
	 *
	 * @var string
	 */
	public $name = '';

	/**
	 * Field slug
	 *
	 * @var string
	 */
	public $slug = 'godam_record';

	/**
	 * Field type
	 *
	 * @var string
	 */
	public $type = 'godam_record';


	/**
	 * Field options
	 *
	 * @var array
	 */
	public $options = array();

	/**
	 * Field icon
	 *
	 * @var string
	 */
	public $icon = 'sui-icon-video-camera';

	/**
	 * Forminator_GoDAM_Record constructor.
	 */
	public function __construct() {
		parent::__construct();

		$this->name = esc_html__( 'GoDAM Record', 'godam' );
	}

	/**
	 * Field defaults
	 *
	 * @return array
	 */
	public function defaults() {
		return array(
			'field_label'          => esc_html__( 'Record Video', 'godam' ),
			'file_type'            => 'single',
			'file_limit'           => '50MB',
			'godam_file_selectors' => array( 'webcam', 'screen_capture', 'file_input' ),
			'godam_video_sync'     => true,
		);
	}

	/**
	 * Autofill Setting
	 *
	 * @param array $settings Settings.
	 * @return array
	 */
	public function autofill_settings( $settings = array() ) {
		// Unsupported Autofill.
		return array();
	}

	/**
	 * Field front-end markup
	 *
	 * @param array                  $field      Field.
	 * @param Forminator_Render_Form $views_obj  Forminator_Render_Form object.
	 * @return string
	 */
	public function markup( $field, $views_obj ) {
		$settings       = $views_obj->model->settings;
		$this->field    = $field;
		$id             = self::get_property( 'element_id', $field );
		$name           = $id;
		$required       = self::get_property( 'required', $field, false );
		$design         = $this->get_form_style( $settings );
		$label          = esc_html( self::get_property( 'field_label', $field, '' ) );
		$description    = self::get_property( 'description', $field, '' );
		$file_selectors = self::get_property( 'godam_file_selectors', $field, array( 'webcam', 'screen_capture' ) );
		$selectors_str  = is_array( $file_selectors ) ? implode( ',', $file_selectors ) : $file_selectors;
		$form_id        = isset( $settings['form_id'] ) ? $settings['form_id'] : 0;
		$uniq_id        = $id . '_' . \Forminator_CForm_Front::$uid;
		
		// Uppy container.
		$uppy_container_id      = "uppy_container_{$form_id}_{$id}";
		$uppy_file_name_id      = "uppy_filename_{$form_id}_{$id}";
		$uppy_preview_id        = "uppy_preview_{$form_id}_{$id}";
		$video_upload_button_id = "video_upload_button_{$form_id}_{$id}";

		ob_start();

		// Include scripts and styles needed for the GoDAM recorder.
		wp_enqueue_style(
			'godam-uppy-video-style',
			RTGODAM_URL . 'assets/build/css/gf-uppy-video.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/gf-uppy-video.css' )
		);

		wp_enqueue_script(
			'forminator-godam-recorder-script',
			RTGODAM_URL . 'assets/build/js/gf-godam-recorder.min.js',
			array( 'jquery' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/gf-godam-recorder.min.js' ),
			true
		);

		?>
		<div class="forminator-field">
			<?php if ( $label ) : ?>
				<label for="<?php echo esc_attr( $uniq_id ); ?>" class="forminator-label"<?php echo $required ? ' data-required="true"' : ''; ?>>
					<?php echo esc_html( $label ); ?>
					<?php if ( $required ) : ?>
						<span class="forminator-required">*</span>
					<?php endif; ?>
				</label>
			<?php endif; ?>

			<div class="forminator-field-godam-record">
				<input 
					name="<?php echo esc_attr( $name ); ?>" 
					id="<?php echo esc_attr( $id ); ?>" 
					type="file"
					style="display: none;" 
					class="forminator-input forminator-hidden" 
				/>
				<div 
					data-max-size="<?php echo esc_attr( wp_max_upload_size() ); ?>" 
					id="<?php echo esc_attr( $uppy_container_id ); ?>"
					class="uppy-video-upload" 
					data-input-id="<?php echo esc_attr( $id ); ?>"
					data-preview-id="<?php echo esc_attr( $uppy_preview_id ); ?>"
					data-filename-id="<?php echo esc_attr( $uppy_file_name_id ); ?>"
					data-video-upload-button-id="<?php echo esc_attr( $video_upload_button_id ); ?>"
					data-file-selectors="<?php echo esc_attr( $selectors_str ); ?>"
				>
					<button 
						type="button"
						id="<?php echo esc_attr( $video_upload_button_id ); ?>"
						class="uppy-video-upload-button"
					>
						<span class="dashicons dashicons-video-alt"></span>
						<?php esc_html_e( 'Record Video', 'godam' ); ?>
					</button>
					<div id="<?php echo esc_attr( $uppy_preview_id ); ?>" class="uppy-video-upload-preview"></div>
					<div id="<?php echo esc_attr( $uppy_file_name_id ); ?>" class="upp-video-upload-filename"></div>
				</div>

				<?php if ( $description ) : ?>
					<span class="forminator-description"><?php echo esc_html( $description ); ?></span>
				<?php endif; ?>
			</div>
		</div>
		<?php

		return ob_get_clean();
	}

	/**
	 * Field back-end validation
	 *
	 * @param array        $field Field.
	 * @param array|string $data  Data.
	 */
	public function validate( $field, $data ) {
		if ( $this->is_required( $field ) ) {
			$id               = self::get_property( 'element_id', $field );
			$required_message = self::get_property( 'required_message', $field, '' );
			if ( empty( $data ) ) {
				$this->validation_message[ $id ] = apply_filters(
					'forminator_godam_record_field_required_validation_message',
					( ! empty( $required_message ) ? $required_message : esc_html__( 'This field is required. Please record a video.', 'godam' ) ),
					$id,
					$field
				);
			}
		}
	}
}
