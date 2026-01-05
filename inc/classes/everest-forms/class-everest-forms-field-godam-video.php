<?php
/**
 * Register the Uppy Video field for Everest_Forms.
 *
 * @since 1.4.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Everest_Forms;

defined( 'ABSPATH' ) || exit;

if ( class_exists( 'EVF_Form_Fields_Upload' ) ) {
	/**
	 * Everest_Forms GoDAM Video Field Class
	 *
	 * @since 1.4.0
	 */
	class Everest_Forms_Field_GoDAM_Video extends \EVF_Form_Fields_Upload {

		/**
		 * Field id.
		 *
		 * @since 1.4.0
		 *
		 * @var string
		 */
		public $field_id;

		/**
		 * Field data.
		 *
		 * @since 1.4.0
		 * @var array
		 */
		public $field_data;

		/**
		 * Constructor.
		 *
		 * @since 1.4.0
		 */
		public function __construct() {
			$this->name     = esc_html__( 'GoDAM Record', 'godam' );
			$this->type     = 'godam_record';
			$this->icon     = 'evf-icon evf-icon-godam-record';
			$this->order    = 40;
			$this->group    = 'advanced';
			$this->settings = array(
				'basic-options'    => array(
					'field_options' => array(
						'label',
						'description',
						'file_selector',
						'button_text',
						'max_size',
						'required',
					),
				),
				'advanced-options' => array(
					'field_options' => array(
						'meta',
						'label_hide',
						'css',
					),
				),
			);

			parent::__construct();

			$this->render_evf_editor_scripts();

			// Add parent ajax events.
			parent::add_ajax_events();

			// To display field HTML in the entry meta.
			add_filter( 'everest_forms_html_field_value', array( $this, 'update_entry_meta_display_godam_recorder' ), 10, 4 );
		}

		/**
		 * Update entry meta display for GoDAM recorder field.
		 *
		 * @param string $meta_value Value to be displayed.
		 * @param array  $value      Value stored.
		 * @param array  $entry_meta Entry meta data.
		 * @param string $context    Context in which the meta is being displayed.
		 *
		 * @since 1.4.0
		 *
		 * @return string
		 */
		public function update_entry_meta_display_godam_recorder( $meta_value, $value, $entry_meta, $context ) {

			// Bail early.
			if ( 'entry-single' !== $context ) {
				return $meta_value;
			}

			// phpcs:disable WordPress.Security.NonceVerification.Recommended

			if ( ! isset( $_GET['view-entry'] ) || empty( $_GET['view-entry'] ) ) {
				return $meta_value;
			}

			$entry_id = absint( $_GET['view-entry'] );
			$form_id  = ! empty( $_GET['form_id'] ) ? absint( $_GET['form_id'] ) : 0;

			// phpcs:enable WordPress.Security.NonceVerification.Recommended

			$meta_key = array_search( $value, $entry_meta, true );

			if ( strpos( $meta_key, 'godam_record' ) === false ) {
				return $meta_value;
			}

			$entry_data = $entry_id ? evf_get_entry( $entry_id, false ) : false;

			$file_type = wp_check_filetype( $value );

			// Detect file type.
			$is_audio = godam_is_audio_file( $value );

			$transcoded_url_meta_key = 'rtgodam_transcoded_url_everestforms_' . $form_id . '_' . $entry_id;
			$transcoded_url_output   = '';

			if ( ! empty( $entry_data ) ) {
				$transcoded_url = esc_url( $entry_data->meta[ $transcoded_url_meta_key ] ?? '' );

				if ( ! empty( $transcoded_url ) ) {
					$transcoded_url        = "transcoded_url={$transcoded_url}";
					$transcoded_url_output = sprintf(
						"<div style='margin: 8px 0;' class='godam-transcoded-url-info'><span class='dashicons dashicons-yes-alt'></span><strong>%s</strong></div>",
						$is_audio 
							? esc_html__( 'Audio saved and transcoded successfully on GoDAM', 'godam' )
							: esc_html__( 'Video saved and transcoded successfully on GoDAM', 'godam' )
					);
				}
			}

			// Add override style for everest forms.
			$style  = '<style>#everest-forms-entry-fields:not(.postbox) table tbody tr td span {margin: 0 !important;}</style>';
			$style .= '<style>.evf-godam-video-preview .easydam-video-container{height:100%;}.evf-godam-video-preview .easydam-video-container .easydam-player.video-js{margin-top:0;}</style>';

			// Render audio or video player.
			if ( $is_audio ) {
				$audio_output = '<audio controls style="width: 100%; margin-top: 10px;">';
				if ( ! empty( $transcoded_url ) ) {
					$audio_src     = str_replace( 'transcoded_url=', '', $transcoded_url );
					$audio_output .= sprintf( '<source src="%s" type="audio/mpeg">', esc_url( $audio_src ) );
				}
				$audio_output .= sprintf( '<source src="%s" type="%s">', esc_url( $value ), esc_attr( $file_type['type'] ) );
				$audio_output .= esc_html__( 'Your browser does not support the audio element.', 'godam' );
				$audio_output .= '</audio>';
				
				// Workaround, replace all line breaks and new lines with empty string.
				$audio_output = str_replace( array( "\r", "\n" ), '', $audio_output );
				$audio_output = '<div class="evf-godam-audio-preview">' . $audio_output . '</div>';
				
				$media_output = $audio_output;
			} else {
				$video_output = do_shortcode( "[godam_video src='{$value}' {$transcoded_url} ]" );

				// Workaround, replace all line breaks and new lines with empty string.
				$video_output = str_replace( array( "\r", "\n" ), '', $video_output );
				$video_output = '<div class="gf-godam-video-preview evf-godam-video-preview">' . $video_output . '</div>';
				
				$media_output = $video_output;
			}

			// Download URL.
			$download_url = sprintf(
				'<div style="margin: 12px 0;"><a type="button" class="button" target="_blank" href="%s">%s</a></div>',
				esc_url( $value ),
				__( 'Click to view', 'godam' )
			);

			$output = $style . $download_url . $transcoded_url_output . $media_output;

			return $output;
		}

		/**
		 * Define additional field properties.
		 *
		 * @since 1.4.0
		 *
		 * @param array $properties Field properties.
		 * @param array $field      Field settings.
		 * @param array $form_data  Form data and settings.
		 *
		 * @return array of additional field properties.
		 */
		public function field_properties( $properties, $field, $form_data ) {
			$this->form_data  = (array) $form_data;
			$this->form_id    = absint( $this->form_data['id'] );
			$this->field_id   = $field['id'];
			$this->field_data = $this->form_data['form_fields'][ $this->field_id ];

			// Input Primary: adjust name.
			$properties['inputs']['primary']['attr']['name'] = "everest_forms_{$this->form_id}_{$this->field_id}";

			// Input Primary: max file size.
			$properties['inputs']['primary']['data']['rule-maxsize'] = $this->max_file_size();

			return $properties;
		}

		/**
		 * Field preview inside the builder.
		 *
		 * @since 1.4.0
		 *
		 * @param array $field Field data.
		 */
		public function field_preview( $field ) {

			// Label.
			$this->field_preview_option( 'label', $field );

			// Define data.
			$placeholder   = ! empty( $field['placeholder'] ) ? $field['placeholder'] : '';
			$default_value = ! empty( $field['default_value'] ) ? $field['default_value'] : '';

			// Primary input.
			printf(
				'<input type="hidden" placeholder="%s" value="%s" class="primary-input" readonly>',
				esc_attr( $placeholder ),
				esc_attr( $default_value )
			);

			// Render upload button.
			printf( '<button type="button" class="button uppy-video-upload-button">' );
			printf( '<span class="dashicons dashicons-video-alt"></span>' );
			printf( esc_html( $field['button_text'] ?? __( 'Start Recording', 'godam' ) ) );
			printf( '</button>' );

			// Description.
			$this->field_preview_option( 'description', $field );

			// Add Max file size info.
			printf(
				'<div class="evf-description">%s</div>',
				esc_html(
					sprintf(
						/* translators: %s is the max file size in MB */
						__( 'Max file size: %s MB', 'godam' ),
						$field['max_size'] ? (int) $field['max_size'] : (int) wp_max_upload_size() / ( 1024 * 1024 )
					)
				)
			);
		}

		/**
		 * Field display on the form front-end.
		 *
		 * @since 1.4.0
		 *
		 * @param array $field Field Data.
		 * @param array $field_atts Field attributes.
		 * @param array $form_data All Form Data.
		 */
		public function field_display( $field, $field_atts, $form_data ) {
			$godam_file_selectors = $this->extract_file_selectors_from_field( $field );

			/**
			 * Render the frontend scripts for the recorder.
			 */
			$this->render_evf_recorder_scripts();

			require untrailingslashit( RTGODAM_PATH ) . '/inc/classes/everest-forms/everest-forms-field-godam-record-frontend.php';
		}

		/**
		 * Extract and return file selectors from the field.
		 *
		 * @since 1.4.0
		 *
		 * @param array $field Field data.
		 * @param array $default_file_selectors Default file selectors.
		 *
		 * @return array
		 */
		public function extract_file_selectors_from_field( $field, $default_file_selectors = array( 'webcam', 'screen_capture' ) ) {
			// Attributes - File Selectors.
			$raw_file_selectors = array_filter(
				$field,
				function ( $value, $key ) {
					return 0 === strpos( $key, 'file-selector_' ) && '1' === $value;
				},
				ARRAY_FILTER_USE_BOTH
			);

			$raw_file_selectors = array_keys( $raw_file_selectors );

			$file_selectors = array_reduce(
				$raw_file_selectors,
				function ( $result, $file_selector ) {
					// Remove the prefix 'file-selector_' from the key.
					$selector_key = str_replace( 'file-selector_', '', $file_selector );
					$result[]     = $selector_key;
					return $result;
				},
				array()
			);

			$file_selectors = empty( $file_selectors ) ? $default_file_selectors : $file_selectors;

			return $file_selectors;
		}

		/**
		 * Type field option.
		 *
		 * @param array $video_field Field data.
		 */
		public function file_selector( $video_field ) {
			$file_selectors_from_field = $this->extract_file_selectors_from_field( $video_field );

			$label = $this->field_element(
				'label',
				$video_field,
				array(
					'slug'    => 'file-selector',
					'value'   => esc_html__( 'Choose file selector', 'godam' ),
					'tooltip' => esc_html__( 'List of file selectors', 'godam' ),
				),
				false
			);

			$file_selectors = array(
				'file_input'     => esc_html__( 'Local Files', 'godam' ),
				'webcam'         => esc_html__( 'Webcam', 'godam' ),
				'screen_capture' => esc_html__( 'Screencast', 'godam' ),
				'audio'          => esc_html__( 'Audio', 'godam' ),
			);

			$checkboxes = '';
			foreach ( $file_selectors as $selector_slug => $selector_label ) {
				$checkboxes .= $this->field_element(
					'toggle',
					$video_field,
					array(
						'slug'  => "file-selector_{$selector_slug}",
						'desc'  => $selector_label,
						'value' => in_array( $selector_slug, $file_selectors_from_field, true ) ? '1' : '0',
					),
					false
				) . '<br>';
			}

			// Remove the last <br> to avoid extra line break.
			$checkboxes = substr( $checkboxes, 0, -1 * strlen( '<br>' ) );

			$this->field_element(
				'row',
				$video_field,
				array(
					'slug'    => 'file-selector',
					'content' => $label . $checkboxes,
				)
			);
		}

		/**
		 * Type field option for button text.
		 *
		 * @param array $video_field Field data.
		 *
		 * @since 1.4.0
		 *
		 * @return void
		 */
		public function button_text( $video_field ) {

			/**
			 * Get the label for the button text.
			 */
			$label = $this->field_element(
				'label',
				$video_field,
				array(
					'slug'    => 'button-text-label',
					'value'   => esc_html__( 'Record Button Text', 'godam' ),
					'tooltip' => esc_html__( 'Text for the start recording button', 'godam' ),
				),
				false
			);

			/**
			 * Get the button.
			 */
			$button = $this->field_element(
				'text',
				$video_field,
				array(
					'slug'    => 'button_text',
					'value'   => ! empty( $video_field['button_text'] ) ? $video_field['button_text'] : esc_html__( 'Start Recording', 'godam' ),
					'label'   => esc_html__( 'Button Text', 'godam' ),
					'tooltip' => esc_html__( 'Text for the start recording button', 'godam' ),
				),
				false
			);

			/**
			 * Render the row for the button text.
			 */
			$this->field_element(
				'row',
				$video_field,
				array(
					'slug'    => 'button-text-row',
					'content' => $label . $button . '</br>',
				)
			);
		}

		/**
		 * Format global files array in more manageable structure.
		 *
		 * @since 1.4.0
		 *
		 * @param array $files Global files array.
		 * @param int   $field_id Field ID.
		 *
		 * @return array
		 */
		public function format_global_files_array( $files, $field_id = null ) {
			if ( ! isset( $files['everest_forms']['name']['fields'] ) ) {
				return array();
			}

			$field_ids_in_files = array_map( 'intval', array_keys( $files['everest_forms']['name']['fields'] ) );

			// Convert the $_FILES array to a more manageable format.
			$new_files = array();
			foreach ( $field_ids_in_files as $field_id_in_file ) {
				foreach ( $files['everest_forms'] as $key => $value ) {
					if ( ! isset( $value['fields'][ $field_id_in_file ] ) ) {
						continue;
					}

					$new_files[ $field_id_in_file ][ $key ] = $value['fields'][ $field_id_in_file ];
				}
			}

			return ! is_null( $field_id ) && isset( $new_files[ $field_id ] ) ? $new_files[ $field_id ] : $new_files;
		}

		/**
		 * Render Everest Forms recorder scripts.
		 *
		 * @since 1.4.0
		 *
		 * @return void
		 */
		private function render_evf_recorder_scripts() {
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

			if ( ! wp_script_is( 'everestforms-godam' ) ) {
				/**
				 * Enqueue script if not already enqueued.
				 */
				wp_enqueue_script(
					'everestforms-godam',
					RTGODAM_URL . 'assets/build/js/everestforms.min.js',
					array( 'jquery', 'wp-i18n' ),
					filemtime( RTGODAM_PATH . 'assets/build/js/everestforms.min.js' ),
					true
				);

				/**
				 * Localize the script for everest forms.
				 */
				wp_localize_script(
					'everestforms-godam',
					'RecorderEverestForms',
					array(
						'ajaxUrl'      => admin_url( 'admin-ajax.php' ),
						'uploadAction' => 'everest_forms_upload_file',
					)
				);
			}
		}

		/**
		 * Function to render Everest Forms editor scripts.
		 *
		 * @since 1.4.0
		 *
		 * @return void
		 */
		private function render_evf_editor_scripts() {

			/**
			 * Add the style for the Everest Forms recorder.
			 */
			if ( ! wp_style_is( 'everest-forms-recorder-style' ) ) {
				wp_enqueue_style(
					'everest-forms-recorder-style',
					RTGODAM_URL . 'assets/build/css/everest-forms-uppy-video.css',
					array(),
					filemtime( RTGODAM_PATH . 'assets/build/css/everest-forms-uppy-video.css' )
				);
			}
		}
	}
}
