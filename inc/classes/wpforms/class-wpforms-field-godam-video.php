<?php
/**
 * Register the Uppy Video field for WPForms.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\WPForms;

defined( 'ABSPATH' ) || exit;

if ( class_exists( 'WPForms_Field' ) ) {
	/**
	 * WPForms GoDAM Video Field Class
	 *
	 * @since n.e.x.t
	 */
	class WPForms_Field_GoDAM_Video extends \WPForms_Field {

		/**
		 * Primary class constructor.
		 *
		 * @since n.e.x.t
		 */
		public function init() {

			// Define field type information.
			$this->name     = esc_html__( 'GoDAM Record', 'godam' );
			$this->keywords = esc_html__( 'godam, video', 'godam' );
			$this->type     = 'godam-video';
			$this->icon     = 'fa-video-camera';
			$this->order    = 30;

			// Define additional field properties.
			// add_filter( 'wpforms_field_properties_text', [ $this, 'field_properties' ], 5, 3 );
			add_action( 'wpforms_frontend_js', array( $this, 'enqueue_frontend_js' ) );

			add_filter( 'wpforms_process_before_filter', array( $this, 'save_video_file' ), 10, 2 );

			// Format field value for emails.
			add_filter( 'wpforms_plaintext_field_value', array( $this, 'format_field_value_for_plaintext' ), 10, 3 );
			add_filter( 'wpforms_html_field_value', array( $this, 'format_field_value_for_html' ), 10, 4 );

			add_filter( 'wpforms_pro_admin_entries_edit_field_editable', function( $editable, $type ) {
				return 'godam-video' === $type ? true : $editable;
			}, 10, 2 );
		}

		/**
		 * Create the field options panel. Used by subclasses.
		 *
		 * @since n.e.x.t
		 *
		 * @param array $video_field Field data and settings.
		 */
		public function field_options( $video_field ) {
			// Populate basic field options
			$this->field_option( 'basic-options', $video_field, array( 'markup' => 'open' ) );
			$this->field_option( 'label', $video_field );
			$this->file_selection_field_element( $video_field );
			$this->max_file_size_field_element( $video_field );
			$this->field_option( 'description', $video_field );
			$this->field_option( 'required', $video_field );
			$this->field_option( 'basic-options', $video_field, array( 'markup' => 'close' ) );

			// Populate advanced field options
			$this->field_option( 'advanced-options', $video_field, array( 'markup' => 'open' ) );
			$this->field_option( 'size', $video_field );
			$this->field_option( 'css', $video_field );
			$this->field_option( 'label_hide', $video_field );
			$this->field_option( 'advanced-options', $video_field, array( 'markup' => 'close' ) );
		}

		/**
		 * Field preview inside the builder.
		 *
		 * @since 1.0.0
		 *
		 * @param array $field Field settings.
		 */
		public function field_preview( $field ) {
			wp_enqueue_style('wpforms-uppy-video-style');

			// Define data.
			$placeholder   = ! empty( $field['placeholder'] ) ? $field['placeholder'] : '';
			$default_value = ! empty( $field['default_value'] ) ? $field['default_value'] : '';

			// Label.
			$this->field_preview_option( 'label', $field );

			// Primary input.
			printf(
				'<input type="file" style="display: none;" placeholder="%s" value="%s" class="primary-input" readonly>',
				esc_attr( $placeholder ),
				esc_attr( $default_value )
			);

			// Render upload button.
			printf( '<button type="button" class="wpforms-btn uppy-video-upload-button">' );
			printf( '<span class="dashicons dashicons-video-alt"></span>' );
			printf( esc_html__( 'Record Video', 'godam' ) );

			// Description.
			$this->field_preview_option( 'description', $field );
		}

		/**
		 * Field display on the form front-end.
		 *
		 * @since n.e.x.t
		 *
		 * @param array $field      Field settings.
		 * @param array $deprecated Deprecated.
		 * @param array $form_data  Form data and settings.
		 */
		public function field_display( $field, $deprecated, $form_data ) {
			if ( \wpforms_is_admin_page('entries', 'edit' ) ) {
				wp_enqueue_style('wpforms-uppy-video-style');
				wp_enqueue_media();

				require __DIR__ . '/wpforms-field-godam-video-edit.php';
			} else {
				require __DIR__ .'/wpforms-field-godam-video-frontend.php';
			}
		}

		/**
		 * Render file selection field element.
		 *
		 * @since n.e.x.t
		 *
		 * @param array $video_field Video field.
		 * @return void
		 */
		protected function file_selection_field_element( $video_field ) {
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
				) . '</br>';
			}

			// Remove the last </br> to avoid extra line break.
			$checkboxes = substr( $checkboxes, 0, -1 * strlen( '</br>' ), );

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
		 * Render max file upload size field element.
		 *
		 * @since n.e.x.t
		 *
		 * @param array $video_field Video field settings.
		 * @return void
		 */
		protected function max_file_size_field_element( $video_field ) {
			$label = $this->field_element(
				'label',
				$video_field,
				array(
					'slug'    => 'max_file_size',
					'value'   => esc_html__( 'Maximum File Size(MB)', 'godam' ),
					'tooltip' => esc_html__( 'Allows to set maximum file size that can be uploaded.', 'godam' ),
				),
				false
			);

			$field = $this->field_element(
				'text',
				$video_field,
				array(
					'type'        => 'number',
					'slug'        => 'max_file_size',
					'placeholder' => '100MB',
					'value'       => isset( $video_field['max_file_size'] ) ? absint( $video_field['max_file_size'] ) : absint( size_format( wp_max_upload_size() ) ),
					'after'       => esc_html__( 'Maximum allowed on this server: ' . size_format( wp_max_upload_size() ), 'godam' ),
					'class'       => array( 'wpforms-field-options-column', 'max-quantity-input' ),
					'attrs'       => array(
						'min'  => 0,
						'step' => 25,
					),
				),
				false
			);

			$this->field_element(
				'row',
				$video_field,
				array(
					'slug'    => 'file-selector',
					'content' => $label . $field,
				)
			);
		}

		/**
		 * Form frontend JS enqueues.
		 *
		 * @since n.e.x.t
		 *
		 * @param array $forms Forms on the current page.
		 */
		public function enqueue_frontend_js( $forms ) {
			// Get fields.
			$fields = array_map(
				function ( $form ) {
					return empty( $form['fields'] ) ? array() : $form['fields'];
				},
				(array) $forms
			);

			// Make fields flat.
			$fields = array_reduce(
				$fields,
				function ( $accumulator, $current ) {
					return array_merge( $accumulator, $current );
				},
				array()
			);

			$field_types = wp_list_pluck( $fields, 'type' );

			// Do not enqueue if there are no video fields.
			if ( ! in_array( 'godam-video', $field_types, true ) ) {
				return;
			}

			wp_enqueue_style('wpforms-uppy-video-style');
			// wp_enqueue_script('wpforms-godam-recorder');
			wp_enqueue_script('godam-recorder-script');

		}

		/**
		 * Extract and return file selectors from the field.
		 *
		 * @since n.e.x.t
		 *
		 * @param array $field Field data.
		 * @param array $default Default values.
		 *
		 * @return array
		 */
		public function extract_file_selectors_from_field( $field, $default = array( 'webcam', 'screen_capture' ) ) {
			// Attributes - File Selectors
			$raw_file_selectors = array_filter(
				$field,
				function ( $value, $key ) {
					return strpos( $key, 'file-selector_' ) === 0 && $value === '1';
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

			$file_selectors = empty( $file_selectors ) ? $default : $file_selectors;

			return $file_selectors;
		}

		/**
		 * Save godam video file.
		 *
		 * @since n.e.x.t
		 *
		 * @param array $entry Entry submitted data.
		 * @param array $form_data Form data and settings
		 *
		 * @return array
		 */
		public function save_video_file( $entry, $form_data ) {
			$files = $this->format_global_files_array( $_FILES );

			require_once ABSPATH . 'wp-admin/includes/media.php';
			require_once ABSPATH . 'wp-admin/includes/file.php';
			require_once ABSPATH . 'wp-admin/includes/image.php';

			// Loop through each file, and creates attachments for video files.
			foreach ( $files as $field_id => $file ) {
				// Bail if there is not error set.
				if ( ! isset( $file['error'] ) ) {
					continue;
				}

				// Check for upload errors.
				if ( UPLOAD_ERR_OK !== $file['error'] ) {
					$entry['fields'][ $field_id ] = '';
					continue;
				}

				// Check if the file is a video.
				if ( ! isset( $file['type'] ) || ! str_starts_with( $file['type'], 'video/' ) ) {
					continue;
				}

				$attachment_id = media_handle_sideload( $file );

				if ( ! is_wp_error( $attachment_id ) ) {
					$entry['fields'][ $field_id ] = $attachment_id;
				}
			}

			return $entry;
		}

		/**
		 * Format video field value for plain-text email.
		 *
		 * @since n.e.x.t
		 *
		 * @param mixed $value Field value.
		 * @param array $field Field data.
		 * @param array $form_data Form data and settings.
		 *
		 * @return mixed
		 */
		public function format_field_value_for_plaintext( $value, $field, $form_data ) {
			// Check if the field is not a video field.
			if ( ! isset( $field['type'] ) || 'godam-video' !== $field['type'] ) {
				return $value;

			}

			if ( 0 === $value || ! is_numeric( $value ) ) {
				return $value;

			}

			$attachment = get_post( $value );

			if ( null === $attachment || 'attachment' !== $attachment->post_type ) {
				return $value;
			}

			return wp_get_attachment_url( $value ) . PHP_EOL . PHP_EOL;
		}

		/**
		 * Format video field value for HTML email.
		 *
		 * @since n.e.x.t
		 *
		 * @param mixed $value Field value.
		 * @param array $field Field data.
		 * @param array $form_data Form data and settings.
		 * @param string $context Context: 'entry-single' or 'email-html'
		 *
		 * @return mixed
		 */
		public function format_field_value_for_html( $value, $field, $form_data, $context ) {
			// Check if the field is not a video field.
			if ( ! isset( $field['type'] ) || 'godam-video' !== $field['type'] ) {
				return $value;
			}

			if ( 0 === $value || ! is_numeric( $value ) ) {
				return $value;
			}

			$attachment = get_post( $value );

			if ( null === $attachment || 'attachment' !== $attachment->post_type ) {
				return __('Video not found', 'godam' ) ;
			}

			$attachment_url  = wp_get_attachment_url( $value );
			$attachment_name = $attachment->post_title;

			$formatted_value = sprintf( '<a href="%s" target="_blank">%s</a>', esc_url( $attachment_url ), esc_html( $attachment_name ) );

			return $formatted_value;
		}

		/**
		 * Validate field on form submit.
		 *
		 * @since n.e.x.t
		 *
		 * @param int   $field_id     Field ID.
		 * @param array $field_submit Submitted field value (raw data).
		 * @param array $form_data    Form data.
		 */
		public function validate( $field_id, $field_submit, $form_data ) {
			parent::validate( $field_id, $field_submit, $form_data );

			// Bail if there is already an error present for the field.
			if ( isset( wpforms()->obj( 'process' )->errors[ $form_data['id'] ][ $field_id ] ) ) {
				return;
			}

			$file_upload_errors = array(
				UPLOAD_ERR_OK         => esc_html__( 'There is no error, the file uploaded with success', 'godam' ),
				UPLOAD_ERR_INI_SIZE   => esc_html__( 'The uploaded file exceeds the upload_max_filesize directive in php.ini', 'godam' ),
				UPLOAD_ERR_FORM_SIZE  => esc_html__( 'The uploaded file exceeds the MAX_FILE_SIZE directive that was specified in the HTML form', 'godam' ),
				UPLOAD_ERR_PARTIAL    => esc_html__( 'The uploaded file was only partially uploaded', 'godam' ),
				UPLOAD_ERR_NO_FILE    => esc_html__( 'No file was uploaded', 'godam' ),
				UPLOAD_ERR_NO_TMP_DIR => esc_html__( 'Missing a temporary folder', 'godam' ),
				UPLOAD_ERR_CANT_WRITE => esc_html__( 'Failed to write file to disk.', 'godam' ),
				UPLOAD_ERR_EXTENSION  => esc_html__( 'A PHP extension stopped the file upload.', 'godam' ),
			);

			$file = $this->format_global_files_array( $_FILES, $field_id );

			if ( isset( $file['error'] ) && ! in_array( intval( $file['error'] ),  [ UPLOAD_ERR_OK, UPLOAD_ERR_NO_FILE ], true ) ) {
				\wpforms()->obj( 'process' )->errors[ $form_data['id'] ][ $field_id ] = esc_html__( $file_upload_errors[ $file['error'] ] );
				return;
			}
		}

		/**
		 * Format global files array in more manageable structure.
		 *
		 * @since n.e.x.t
		 *
		 * @param array $files Global files array.
		 * @param int   $field_id Field ID.
		 *
		 * @return array
		 */
		public function format_global_files_array( $files, $field_id = null ) {
			if ( ! isset( $files['wpforms']['name']['fields'] ) ) {
				return array();
			}

			$field_ids_in_files = array_map( 'intval', array_keys( $files['wpforms']['name']['fields'] ) );

			// Convert the $_FILES array to a more manageable format.
			$new_files = array();
			foreach ( $field_ids_in_files as $field_id_in_file ) {
				foreach ( $files['wpforms'] as $key => $value ) {
					if ( ! isset( $value['fields'][ $field_id_in_file ] ) ) {
						continue;
					}

					$new_files[ $field_id_in_file ][ $key ] = $value['fields'][ $field_id_in_file ];
				}
			}

			return ! is_null( $field_id ) && isset( $new_files[ $field_id ] ) ? $new_files[ $field_id ] : $new_files;
		}
	}
}
