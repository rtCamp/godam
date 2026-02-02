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
		add_action( 'gform_after_submission', array( $this, 'process_file_upload_to_godam' ), 10, 2 );
		add_action( 'wp_head', array( $this, 'maybe_enqueue_gf_hooks' ) );
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
	 * Add identifier tooltip.
	 *
	 * @param Array $tooltips A list of tooltip content.
	 *
	 * @return Array
	 */
	public function add_godam_settings_tooltip( $tooltips ) {
		$tooltips['godam_file_selector_setting'] = sprintf( '<h6>%s</h6><p>%s</p>', __( 'Video file selector', 'godam' ), __( 'Select the file selection options from where user can upload/record video', 'godam' ) );
		$tooltips['godam_video_sync_setting']    = sprintf( '<p>%s</p>', __( 'Save submitted video on GoDAM storage', 'godam' ) );

		return $tooltips;
	}

	/**
	 * Add custom field settings to the form editor.
	 *
	 * @param int $position The position of the field setting.
	 */
	public function add_godam_recorder_field_setting( $position ) {

		$valid_godam_license = rtgodam_is_api_key_valid();

		if ( 50 == $position ) {
			?>
			<li class="godam-video-field-setting field_setting <?php echo $valid_godam_license ? 'rtgodam-hidden' : ''; ?>" style="display: none;">
				<label class="section_label">
					<?php esc_html_e( 'Save submitted video on GoDAM', 'godam' ); ?>
					<?php gform_tooltip( 'godam_video_sync_setting' ); ?>
				</label>

				<!-- Checkbox-->
				<div class="field_godam_video_sync <?php echo $valid_godam_license ? '' : 'godam_no_license'; ?>">
					<input type="checkbox" id="field_godam_video_sync" class="field_godam_video_sync" name="field_godam_video_sync" checked />
					<label for="field_godam_video_sync">
						<?php esc_html_e( 'Sync video', 'godam' ); ?>
					</label>
				</div>
				<?php if ( ! $valid_godam_license ) : ?>
					<p class="description"><?php esc_html_e( 'You need a GoDAM paid plan to use this feature', 'godam' ); ?></p>
				<?php endif; ?>
			</li>
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

					<div>
						<input type="checkbox" name="field_godam_video_file_selector" id="field_godam_video_file_selector_audio" value="audio">
						<label class="inline" for="field_godam_video_file_selector_audio">
							<?php esc_html_e( 'Audio', 'godam' ); ?>
						</label>
					</div>
				</div>
			</li>
			<li class="godam-video-field-setting field_setting">
				<label class="section_label" for="field_godam_max_duration">
					<?php esc_html_e( 'Max duration (seconds)', 'godam' ); ?>
				</label>
				<input type="number" min="1" step="1" id="field_godam_max_duration" name="field_godam_max_duration" value="" />
				<p class="description">
					<?php esc_html_e( 'Leave empty to allow any duration. Example: 180 = 3 minutes.', 'godam' ); ?>
				</p>
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
			RTGODAM_URL . 'assets/build/js/gf-godam-recorder-editor.min.js',
			array( 'jquery' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/gf-godam-recorder-editor.min.js' ),
			true
		);
	}

	/**
	 * Process file upload to GoDAM.
	 *
	 * @param array $entry The entry object.
	 * @param array $form The form object.
	 */
	public function process_file_upload_to_godam( $entry, $form ) {

		$form_title          = $form['title'];
		$valid_godam_license = rtgodam_is_api_key_valid();

		// Check if the form contains a godam_record field.
		foreach ( $form['fields'] as $field ) {

			if ( 'godam_record' !== $field->type ) {
				continue;
			}

			if ( ! $valid_godam_license ) {
				// If not valid license set to sync with GoDAM, skip processing.
				continue;
			}

			// Process the file upload to GoDAM.
			// Get the uploaded file URL.
			$field_id   = $field->id;
			$file_value = rgar( $entry, $field_id );

			$file_type = wp_check_filetype( $file_value );
			$is_audio  = strpos( $file_type['type'], 'audio' ) !== false;
			$is_video  = strpos( $file_type['type'], 'video' ) !== false;

			if ( 'webm' === $file_type['ext'] && godam_is_audio_file_by_name( $file_value ) ) {
				$is_video = false;
				$is_audio = true;
			}

			if ( empty( $file_value ) ) {
				continue;
			}

			// For multiple files.
			if ( $field->multipleFiles ) { // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
				$files = json_decode( $file_value, true );
				if ( ! is_array( $files ) ) {
					$files = array( $file_value );
				}

				foreach ( $files as $index => $file_url ) {
					$this->send_to_godam( $form_title, $file_url, $entry['id'], $field_id, $index, $is_audio ? 'audio' : 'stream' );
				}
			} else {
				// Single file.
				$this->send_to_godam( $form_title, $file_value, $entry['id'], $field_id, 0, $is_audio ? 'audio' : 'stream' );
			}
		}
	}

	/**
	 * Send file to GoDAM for transcoding.
	 *
	 * @param string $form_title The title of the form.
	 * @param string $file_url The URL of the file to be sent.
	 * @param int    $entry_id The ID of the entry.
	 * @param int    $field_id The ID of the field.
	 * @param int    $index The index of the file (for multiple files).
	 * @param string $job_type Job type, Default is 'stream'.
	 */
	private function send_to_godam( $form_title, $file_url, $entry_id, $field_id, $index = 0, $job_type = 'stream' ) {

		/**
		 * Bail early if no file to send.
		 */
		if ( empty( $file_url ) ) {
			return;
		}

		/**
		 * Form Title.
		 */
		$form_title = ! empty( $form_title ) ? $form_title : __( 'Gravity forms', 'godam' );

		/**
		 * Send for transcoding.
		 */
		$response_from_transcoding = rtgodam_send_video_to_godam_for_transcoding( 'gf', $form_title, $file_url, $entry_id, $job_type );

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
		 * Update gravity forms entry meta data.
		 */
		gform_update_meta(
			$entry_id,
			'rtgodam_transcoding_job_id' . $field_id . '_' . $index,
			$job_id
		);

		/**
		 * Add the job to options table.
		 */
		add_option(
			$job_id,
			array(
				'source'   => 'gf_godam_recorder',
				'entry_id' => $entry_id,
				'field_id' => $field_id,
				'index'    => $index,
			)
		);
	}

	/**
	 * Adds Gravity Forms hooks on Video preview page.
	 *
	 * This ensures the global `gform` object (from gforms_hooks.js) is available in the document head
	 * on the GoDAM video-preview page.
	 *
	 * @return void
	 */
	public function maybe_enqueue_gf_hooks() {
		// Ensure Gravity Forms is present.
		if ( ! class_exists( 'GFCommon' ) ) {
			return;
		}

		$godam_page = get_query_var( 'godam_page' );

		if ( 'video-preview' === $godam_page ) {
			$script_body = \GFCommon::get_hooks_javascript_code();
			// phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Output is trusted JS generated by Gravity Forms, required for functioning of Gravity Forms hooks on the video preview page.
			printf( '<script type="text/javascript">%s</script>', $script_body );
		}
	}
}
