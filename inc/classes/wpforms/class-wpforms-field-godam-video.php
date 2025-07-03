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

			add_filter( 'wpforms_process_before_filter', array( $this, 'process_video_file' ), 10, 2 );

			// Format field value for emails.
			add_filter( 'wpforms_plaintext_field_value', array( $this, 'format_video_field_value_for_plaintext_email' ), 10, 3 );
			add_filter( 'wpforms_html_field_value', array( $this, 'format_video_field_value_for_html_email' ), 10, 3 );
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
			wp_enqueue_style(
				'wpforms-uppy-video-style',
				RTGODAM_URL . 'assets/build/css/wpforms-uppy-video.css',
				array(),
				filemtime( RTGODAM_PATH . 'assets/build/css/wpforms-uppy-video.css' )
			);

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
			printf( '<button type="button" class="uppy-video-upload-button">' );
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
			$video_upload_button_id = wp_unique_id( 'uppy-video-upload-' );

			// Define data.
			$primary = $field['properties']['inputs']['primary'];

			$form_id       = isset( $form_data['id'] ) ? absint( $form_data['id'] ) : 0;
			$field_id      = isset( $field['id'] ) ? absint( $field['id'] ) : 0;
			$file_input_id = "wpforms_file_input_{$form_id}_{$field_id}";

			// Attributes - Max Upload Size
			$max_upload_size = isset( $field['max_file_size'] ) ? absint( $field['max_file_size'] ) : 0;
			$max_upload_size = $max_upload_size > 0 ? $max_upload_size * 1024 * 1024 : wp_max_upload_size(); // Convert MB to bytes.

			// Attributes - File Selectors
			$file_selectors = $this->extract_file_selectors_from_field( $field );
			$file_selectors = join( ',', $file_selectors );

			// Uppy container.
			$uppy_container_id = "uppy_container_{$form_id}_{$field_id}";
			$uppy_file_name_id = "uppy_filename_{$form_id}_{$field_id}";
			$uppy_preview_id   = "uppy_preview_{$form_id}_{$field_id}";

			?>
			<input
				type="file"
				id="<?php echo esc_attr( $file_input_id ); ?>"
				style="display: none;"
				<?php echo wpforms_html_attributes( $primary['id'], $primary['class'], $primary['data'], $primary['attr'] ); ?>
				<?php echo $primary['required']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			/>
			<div
				data-max-file-size="<?php echo esc_attr( $max_upload_size ); ?>"
				id="<?php echo esc_attr( $uppy_container_id ); ?>"
				class="uppy-video-upload <?php echo esc_attr( join( ' ', $primary['class'] ) ); ?>"
				data-input-id="<?php echo esc_attr( $file_input_id ); ?>"
				data-video-upload-button-id="<?php echo esc_attr( $video_upload_button_id ); ?>"
				data-file-selectors="<?php echo esc_attr( $file_selectors ); ?>"
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
			<?php
			echo ob_get_clean();
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

			wp_enqueue_style(
				'wpforms-uppy-video-style',
				RTGODAM_URL . 'assets/build/css/wpforms-uppy-video.css',
				array(),
				filemtime( RTGODAM_PATH . 'assets/build/css/wpforms-uppy-video.css' )
			);

			wp_enqueue_script(
				'wpforms-godam-recorder-script',
				RTGODAM_URL . 'assets/build/js/wpforms-godam-recorder.min.js',
				array( 'jquery' ),
				filemtime( RTGODAM_PATH . 'assets/build/js/wpforms-godam-recorder.min.js' ),
				true
			);
		}

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
		 * Validate field on form submitting.
		 *
		 * @since 1.0.0
		 *
		 * @param string|int $field_id     Field ID as a numeric string.
		 * @param mixed      $field_submit Submitted field value (raw data).
		 * @param array      $form_data    Form data and settings.
		 */
		public function validate( $field_id, $field_submit, $form_data ) {
			parent::validate( $field_id, $field_submit, $form_data );
		}

		public function process_video_file( $entry, $form_data ) {

			if ( ! isset( $_FILES['wpforms']['name']['fields'] ) ) {
				return $entry;
			}

			$field_ids = array_map( 'intval', array_keys( $_FILES['wpforms']['name']['fields'] ) );

			// Filter field ids without errors.
			$field_ids = array_filter(
				$field_ids,
				function ( $field_id ) {
					return isset( $_FILES["wpforms"]["error"]["fields"][$field_id] ) && UPLOAD_ERR_OK === $_FILES["wpforms"]["error"]["fields"][$field_id];
				}
			);

			// Convert the $_FILES array to a more manageable format.
			$files = [];
			foreach( $field_ids as $field_id ) {
				foreach( $_FILES['wpforms'] as $key => $value ) {
					if ( ! isset( $value['fields'][$field_id] ) ) {
						continue;
					}

					$files[$field_id][$key] = $value['fields'][$field_id];
				}
			}

			require_once ABSPATH . 'wp-admin/includes/media.php';
			require_once ABSPATH . 'wp-admin/includes/file.php';
			require_once ABSPATH . 'wp-admin/includes/image.php';

			// Loop through each file, and creates attachments for video files.
			foreach( $files as $field_id => $file ) {
				// Check if the file is a video.
				if ( ! isset( $file['type'] ) || ! str_starts_with( $file['type'], 'video/' )) {
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
		public function format_video_field_value_for_plaintext_email( $value, $field, $form_data ) {
			// Check if the field is not a video field.
			if ( ! isset( $field['type'] ) || 'godam-video' !== $field['type'] ) {
				return $value;;
			}

			if ( 0 === $value || ! is_numeric( $value ) ) {
				return $value;;
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
		 *
		 * @return mixed
		 */
		public function format_video_field_value_for_html_email( $value, $field, $form_data ) {
			// Check if the field is not a video field.
			if ( ! isset( $field['type'] ) || 'godam-video' !== $field['type'] ) {
				return $value;;
			}

			if ( 0 === $value || ! is_numeric( $value ) ) {
				return $value;;
			}

			$attachment = get_post( $value );

			if ( null === $attachment || 'attachment' !== $attachment->post_type ) {
				return $value;
			}

			$attachment_url  = wp_get_attachment_url( $value );
			$attachment_name = $attachment->post_title;

			return sprintf('<a href="%s" target="_blank">%s</a>', esc_url( $attachment_url ), esc_html( $attachment_name ) );

			return $value;
		}
	}
}
