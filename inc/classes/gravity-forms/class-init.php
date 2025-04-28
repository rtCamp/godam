<?php
/**
 * Extend gravity forms
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Gravity_Forms;

use RTGODAM\Inc\Traits\Singleton;
use RTGODAM\Inc\Gravity_Forms\GF_Field_GoDAM_Video;

defined( 'ABSPATH' ) || exit;

/**
 * Class Init
 *
 * @package GoDAM
 */
class Init {

	use Singleton;

	/**
	 * Constructor method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup hooks.
	 *
	 * @return void
	 */
	public function setup_hooks() {
		
		/**
		 * Filters
		 */
		add_filter( 'gform_tooltips', array( $this, 'add_godam_settings_tooltip' ) );

		/**
		 * Actions
		 */
		add_action( 'gform_loaded', array( $this, 'register_custom_gf_field' ) );
		add_action( 'gform_enqueue_scripts', array( $this, 'enqueue_godam_recorder_scripts' ), 10, 2 );
		add_action( 'gform_field_standard_settings', array( $this, 'add_godam_recorder_field_setting' ), 10, 2 );
		add_action( 'gform_editor_js', array( $this, 'add_editor_script' ) );
	}

	/**
	 * Register custom gravity form field.
	 * 
	 * @return void
	 */
	public function register_custom_gf_field() {
		if ( class_exists( 'GF_Field' ) ) {
			\GF_Fields::register( new GF_Field_GoDAM_Video() );
		}
	}

	/**
	 * Enqueue scripts and styles for the form.
	 *
	 * @param array $form The form object.
	 */
	public function enqueue_godam_recorder_scripts( $form ) {

		// Only enqueue the scripts and styles if the form contains a godam_record field.
		$has_godam_field = false;
	
		// Check if form has godam_record fields.
		if ( ! empty( $form['fields'] ) ) {
			// Loop through all fields to find a godam_record field.
			foreach ( $form['fields'] as $field ) {
				if ( 'godam_record' === $field->type ) {
					$has_godam_field = true;
					break;
				}
			}
		}
		
		if ( ! $has_godam_field ) {
			return;
		}

		wp_enqueue_style(
			'gf-uppy-video-style',
			RTGODAM_URL . 'assets/build/css/gf-uppy-video.css',
			array(),
			filemtime( RTGODAM_PATH . 'assets/build/css/gf-uppy-video.css' )
		);

		wp_enqueue_script( 
			'gf-godam-recorder-script',
			RTGODAM_URL . 'assets/build/js/gf-godam-recorder.js',
			array( 'jquery' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/gf-godam-recorder.js' ), 
			true 
		);
	}

	/**
	 * Add identifier tooltip.
	 *
	 * @param Array $tooltips A list of tooltip content.
	 *
	 * @return Array
	 */
	public function add_godam_settings_tooltip( $tooltips ) {
		$tooltips['godam_file_selector_setting'] = sprintf( '<h6>%s</h6><p>%s</p>', __( 'Video file selector', 'godam' ), __( 'Select the file selection options from where user can upload/record video', 'godam' ) );
		return $tooltips;
	}

	/**
	 * Add custom field settings to the form editor.
	 *
	 * @param int $position The position of the field setting.
	 */
	public function add_godam_recorder_field_setting( $position ) {
		if ( 50 == $position ) {
			?>
			<li class="godam-video-field-setting field_setting" style="display: none;">
				<label class="section_label">
					<?php esc_html_e( 'Choose file selector', 'godam' ); ?>
					<?php gform_tooltip( 'godam_file_selector_setting' ); ?>
				</label>

				<!-- Checkboxes -->
				<div class="field_godam_video_file_selector" style="display: flex; flex-direction: column; gap: 8px;">
					<div>
						<input type="checkbox" name="field_godam_video_file_selector" id="field_godam_video_file_selector_file_input" value="file_input">
						<label class="inline" for="field_godam_video_file_selector_file_input">
							<?php esc_html_e( 'Local files', 'godam' ); ?>
						</label>
					</div>

					<div>
						<input type="checkbox" name="field_godam_video_file_selector" id="field_godam_video_file_selector_webcam" value="webcam" checked>
						<label class="inline" for="field_godam_video_file_selector_webcam">
							<?php esc_html_e( 'Webcam', 'godam' ); ?>
						</label>
					</div>

					<div>
						<input type="checkbox" name="field_godam_video_file_selector" id="field_godam_video_file_selector_screen_capture" value="screen_capture" checked>
						<label class="inline" for="field_godam_video_file_selector_screen_capture">
							<?php esc_html_e( 'Screencast', 'godam' ); ?>
						</label>
					</div>
				</div>
			</li>
			<?php
		}
	}

	/**
	 * Add editor script
	 */
	public function add_editor_script() {
		wp_enqueue_script(
			'gf-godam-recorder-editor-script',
			RTGODAM_URL . 'assets/build/js/gf-godam-recorder-editor.js',
			array( 'jquery' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/gf-godam-recorder-editor.js' ),
			true
		);
	}
}
