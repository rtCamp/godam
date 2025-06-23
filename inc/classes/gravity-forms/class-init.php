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
		add_action( 'gform_entry_detail', array( $this, 'enqueue_entry_detail_scripts' ) );
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
			RTGODAM_URL . 'assets/build/js/gf-godam-recorder.min.js',
			array( 'jquery' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/gf-godam-recorder.min.js' ),
			true
		);
	}

	/**
	 * Enqueue scripts and styles for the entry detail page.
	 */
	public function enqueue_entry_detail_scripts() {
		wp_enqueue_script(
			'gf-entry-detail-script',
			RTGODAM_URL . 'assets/build/js/gf-entry-detail.min.js',
			array( 'jquery' ),
			filemtime( RTGODAM_PATH . 'assets/build/js/gf-entry-detail.min.js' ),
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
					<input type="checkbox" id="field_godam_video_sync" class="field_godam_video_sync" name="field_godam_video_sync" checked" />
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
					$this->send_to_godam( $form_title, $file_url, $entry['id'], $field_id, $index );
				}
			} else {
				// Single file.
				$this->send_to_godam( $form_title, $file_value, $entry['id'], $field_id );
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
	 */
	private function send_to_godam( $form_title, $file_url, $entry_id, $field_id, $index = 0 ) {

		// Get file extension.
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

		$api_key = get_site_option( 'rtgodam-api-key', '' );

		$body = array_merge(
			array(
				'api_token'       => $api_key,
				'job_type'        => 'stream',
				'job_for'         => 'gf-godam-recorder',
				'file_origin'     => rawurlencode( $file_url ),
				'callback_url'    => rawurlencode( $callback_url ),
				'status_callback' => rawurlencode( $status_callback_url ),
				'force'           => 0,
				'formats'         => $file_extension,
				'thumbnail_count' => 0,
				'stream'          => true,
				'watermark'       => boolval( $rtgodam_watermark ),
				'resolutions'     => array( 'auto' ),
				'folder_name'     => $form_title ?? 'Gravity Forms',
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
				gform_update_meta( $entry_id, 'rtgodam_transcoding_job_id_' . $field_id . '_' . $index, $job_id );
				add_option(
					$job_id,
					array(
						'source'   => 'gform_godam_recorder',
						'entry_id' => $entry_id,
						'field_id' => $field_id,
						'index'    => $index,
					)
				);
			}
		}

		// Todo: Handle error cases.
	}
}
