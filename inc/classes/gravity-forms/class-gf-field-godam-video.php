<?php
/**
 * Register the Uppy Video field for Gravity Forms.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Gravity_Forms;

defined( 'ABSPATH' ) || exit;

if ( class_exists( 'GF_Field' ) ) {

	// phpcs:disable WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
	/**
	 * Class GF_Field_GoDAM_Video
	 *
	 * @package GoDAM
	 */
	class GF_Field_GoDAM_Video extends \GF_Field_FileUpload {

		/**
		 * The field type.
		 *
		 * @var string
		 */
		public $type = 'godam_record';

		/**
		 * Returns the field's form editor title.
		 *
		 * @return string
		 */
		public function get_form_editor_field_title() {
			return esc_attr__( 'GoDAM Record', 'godam' );
		}

		/**
		 * Returns the field's form editor description.
		 *
		 * @return string
		 */
		public function get_form_editor_field_description() {
			return esc_attr__( 'Allows users to record webcam video', 'godam' );
		}

		/**
		 * Returns the field's form editor icon.
		 *
		 * This could be an icon url or a gform-icon class.
		 *
		 * @return string
		 */
		public function get_form_editor_field_icon() {
			return 'dashicons-video-alt';
		}

		/**
		 * Returns the form editor field settings.
		 *
		 * @return array
		 */
		public function get_form_editor_field_settings() {
			return array(
				'conditional_logic_field_setting',
				'error_message_setting',
				'label_setting',
				'label_placement_setting',
				'admin_label_setting',
				'rules_setting',
				'file_size_setting',
				// 'multiple_files_setting',
				'visibility_setting',
				'description_setting',
				'css_class_setting',
			);
		}

		/**
		 * Generates the HTML markup for the field input in the form.
		 *
		 * @param array  $form  The form object.
		 * @param string $value The field value.
		 * @param array  $entry The entry object (optional).
		 *
		 * @return string The HTML markup for the field input.
		 */
		public function get_field_input( $form, $value = '', $entry = null ) {
			$lead_id         = absint( rgar( $entry, 'id' ) );
			$form_id         = absint( $form['id'] );
			$is_entry_detail = $this->is_entry_detail();
			$is_form_editor  = $this->is_form_editor();

			$id                     = absint( $this->id );
			$field_id               = ! $form_id
				? sprintf( 'input_%s', $id )
				: sprintf( 'input_%1$s_%2$s', $form_id, $id );
			$video_upload_button_id = wp_unique_id( 'uppy-video-upload-' );

			$size         = $this->size;
			$class_suffix = $is_entry_detail ? '_admin' : '';
			$class        = $size . $class_suffix;
			$class        = esc_attr( $class );

			$disabled_text = $is_form_editor ? 'disabled="disabled"' : '';

			$tabindex       = $this->get_tabindex();
			$multiple_files = $this->multipleFiles;
			$file_list_id   = 'gform_preview_' . $form_id . '_' . $id;

			// Generate upload rules messages.
			$upload_rules_messages = array();

			// Extensions.
			$allowed_extensions = ! empty( $this->allowedExtensions ) ? join( ',', \GFCommon::clean_extensions( explode( ',', strtolower( $this->allowedExtensions ) ) ) ) : '';
			if ( ! empty( $allowed_extensions ) ) {
				// translators: %s is the allowed file types.
				$upload_rules_messages[] = esc_attr( sprintf( __( 'Accepted file types: %s', 'godam' ), str_replace( ',', ', ', $allowed_extensions ) ) );
			}

			// File size.
			$max_upload_size = $this->maxFileSize > 0 ? $this->maxFileSize * 1048576 : wp_max_upload_size();
			// translators: %s is the maximum file size allowed.
			$upload_rules_messages[] = esc_attr( sprintf( __( 'Max. file size: %s', 'godam' ), \GFCommon::format_file_size( $max_upload_size ) ) );

			// No. of files.
			$max_files = ( $multiple_files && $this->maxFiles > 0 ) ? $this->maxFiles : 0;
			if ( $max_files ) {
				// translators: %s is the maximum number of files allowed.
				$upload_rules_messages[] = esc_attr( sprintf( __( 'Max. files: %s', 'godam' ), $max_files ) );
			}

			$rules_messages    = implode( ', ', $upload_rules_messages ) . '.';
			$rules_messages_id = empty( $rules_messages ) ? '' : "gfield_upload_rules_{$this->formId}_{$this->id}";
			$describedby       = $this->get_aria_describedby( array( $rules_messages_id ) );

			// Uppy container.
			$uppy_container_id = "uppy_container_{$form_id}_{$id}";
			$uppy_file_name_id = "uppy_filename_{$form_id}_{$id}";
			$uppy_preview_id   = "uppy_preview_{$form_id}_{$id}";

			// Build the uppy UI.
			ob_start();

			$file_selectors = ! empty( $this->godamVideoFileSelectors ) ? implode( ',', $this->godamVideoFileSelectors ) : 'webcam,screen_capture';
			?>
			<div class="ginput_container" data-allowed-extensions="<?php echo esc_attr( $allowed_extensions ); ?>" data-max-files="<?php echo esc_attr( $max_files ); ?>">
				<?php if ( $max_upload_size <= 2047 * 1048576 ) : // Hidden file input that will be populated by Uppy. ?>
					<input type="hidden" name="MAX_FILE_SIZE" value="<?php echo esc_attr( $max_upload_size ); ?>" />
				<?php endif; ?>
				<?php // Standard file input that's hidden (will be populated with selected file) . ?>
				<input 
					name="<?php echo esc_attr( 'input_' . $id ); ?>" 
					id="<?php echo esc_attr( $field_id ); ?>" 
					type="file"
					style="display: none;" 
					class="<?php echo esc_attr( $class ); ?> gfield_visibility_hidden rtgodam-hidden" 
					<?php echo $disabled_text; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Already escaped in above scope. ?> 
				/>
				<div 
					data-max-size="<?php echo esc_attr( $max_upload_size ); ?>" 
					id="<?php echo esc_attr( $uppy_container_id ); ?>"
					class="uppy-video-upload" 
					data-input-id="<?php echo esc_attr( $field_id ); ?>"
					data-video-upload-button-id="<?php echo esc_attr( $video_upload_button_id ); ?>"
					data-file-selectors="<?php echo esc_attr( $file_selectors ); ?>"
				>
					<button 
						type="button"
						id="<?php echo esc_attr( $video_upload_button_id ); ?>"
						class="uppy-video-upload-button"
						<?php echo $disabled_text; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Already escaped in above scope. ?>
					>
						<span class="dashicons dashicons-video-alt"></span>
						<?php esc_html_e( 'Start Recording', 'godam' ); ?>
					</button>
					<div id="<?php echo esc_attr( $uppy_preview_id ); ?>" class="uppy-video-upload-preview"></div>
					<div id="<?php echo esc_attr( $uppy_file_name_id ); ?>" class="upp-video-upload-filename"></div>
				</div>
				<?php if ( $rules_messages ) : ?>
					<span class="gfield_description gform_fileupload_rules" id="<?php echo esc_attr( $rules_messages_id ); ?>">
						<?php echo esc_html( $rules_messages ); ?>
					</span>
				<?php endif; ?>
			</div>
			<?php
			$upload = ob_get_clean();

			return $upload;
		}

		/**
		 * Returns the field value for the entry list.
		 *
		 * @param string $value The field value.
		 * @param array  $entry The entry object (optional).
		 * @param int    $field_id The field ID.
		 * @param array  $columns The columns in the entry list.
		 * @param array  $form The form object (optional).
		 *
		 * @return string The formatted field value.
		 */
		public function get_value_entry_list( $value, $entry, $field_id, $columns, $form ) {
			if ( $this->multipleFiles ) {
				if ( is_array( $value ) ) {
					$uploaded_files_arr = $value;
				} else {
					$uploaded_files_arr = json_decode( $value, true );
					if ( ! is_array( $uploaded_files_arr ) ) {
						$uploaded_files_arr = array( $value );
					}
				}

				$file_count = count( $uploaded_files_arr );
				if ( 1 < $file_count ) {
					// translators: %d is the number of files.
					$value = empty( $uploaded_files_arr ) ? '' : sprintf( esc_html__( '%d files', 'godam' ), count( $uploaded_files_arr ) );
					return $value;
				} elseif ( 1 == $file_count ) {
					$value = current( $uploaded_files_arr );
				} elseif ( 0 == $file_count ) {
					return;
				}
			}

			$file_path = $value;
			if ( ! empty( $file_path ) ) {
				// displaying thumbnail (if file is an image) or an icon based on the extension.
				$thumb     = \GFEntryList::get_icon_url( $file_path );
				$file_path = $this->get_download_url( $file_path );
				$file_path = esc_attr( $file_path );
				$value     = "<a href='$file_path' target='_blank' aria-label='" . esc_attr__( 'View the image', 'godam' ) . "'><img src='$thumb' alt='' /></a>";
			}
			return $value;
		}

		/**
		 * Returns the field value for the entry detail page.
		 *
		 * @param string $value The field value.
		 * @param string $currency The currency code (optional).
		 * @param bool   $use_text Whether to use text format (optional).
		 * @param string $format The format of the output (optional).
		 * @param string $media The media type (optional).
		 *
		 * @return string The formatted field value.
		 */
		public function get_value_entry_detail( $value, $currency = '', $use_text = false, $format = 'html', $media = 'screen' ) {
			if ( empty( $value ) ) {
				return '';
			}

			$output     = '';
			$output_arr = array();

			$files = json_decode( $value, true );
			if ( ! is_array( $files ) ) {
				$files = array( $value );
			}

			$force_download = in_array( 'download', $this->get_modifiers(), true );

			if ( is_array( $files ) ) {
				foreach ( $files as $index => $file_path ) {

					// File type check.
					$file_type = wp_check_filetype( $file_path );
					$is_video  = strpos( $file_type['type'], 'video' ) !== false;
					$is_audio  = strpos( $file_type['type'], 'audio' ) !== false;

					// if webm file extension and mime type is not detected correctly then check by file name.
					// The files created by uppy webcam, screen capture, and audio plugin are in same format so we are checking the filename to determine if it's an audio file.
					if ( 'webm' === $file_type['ext'] && godam_is_audio_file_by_name( $file_path ) ) {
						$is_video = false;
						$is_audio = true;
					}

					if ( is_array( $file_path ) ) {
						$basename  = rgar( $file_path, 'uploaded_name' );
						$file_path = rgar( $file_path, 'tmp_url' );
					} else {
						$basename = wp_basename( $file_path );
					}

					$file_path = $this->get_download_url( $file_path, $force_download );

					/**
					 * Allow for override of SSL replacement
					 *
					 * By default Gravity Forms will attempt to determine if the schema of the URL should be overwritten for SSL.
					 * This is not ideal for all situations, particularly domain mapping. Setting $field_ssl to false will prevent
					 * the override.
					 *
					 * @since 2.1.1.23
					 *
					 * @param bool                $field_ssl True to allow override if needed or false if not.
					 * @param string              $file_path The file path of the download file.
					 * @param GF_Field_FileUpload $field     The field object for further context.
					 */
					// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Gravity Forms hook.
					$field_ssl = apply_filters( 'gform_secure_file_download_is_https', true, $file_path, $this );

					if ( \GFCommon::is_ssl() && strpos( $file_path, 'http:' ) && $field_ssl ) {
						$file_path = str_replace( 'http:', 'https:', $file_path );
					}

					/**
					 * Allows for the filtering of the file path before output.
					 *
					 * @since 2.1.1.23
					 *
					 * @param string              $file_path The file path of the download file.
					 * @param GF_Field_FileUpload $field     The field object for further context.
					 */
					// phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedHooknameFound -- Gravity Forms hook.
					$file_path    = str_replace( ' ', '%20', apply_filters( 'gform_fileupload_entry_value_file_path', $file_path, $this ) );
					$output_arr[] = 'text' == $format ? $file_path : sprintf( "<li><strong>%s:</strong> <a href='%s' target='_blank' aria-label='%s'>%s</a></li>", _x( 'URL', 'GF entry detail page', 'godam' ), esc_attr( $file_path ), esc_attr__( 'Click to view', 'godam' ), $basename );

					// Get the entry ID from GFAPI context.
					$entry_id = 0;
					if ( function_exists( 'rgget' ) ) {
						$entry_id = rgget( 'lid' ) ? rgget( 'lid' ) : rgget( 'entry' );
					}

					// Get and display the transcoding job ID if available.
					$transcoded_url = '';
					if ( $entry_id && function_exists( 'gform_get_meta' ) ) {
						$meta_key = 'rtgodam_transcoding_job_id_' . $this->id . '_' . $index;
						$job_id   = gform_get_meta( $entry_id, $meta_key );

						$meta_key       = 'rtgodam_transcoded_url_' . $this->id . '_' . $index;
						$transcoded_url = gform_get_meta( $entry_id, $meta_key );

						if ( $transcoded_url ) {
							$output_arr[] = sprintf(
								"<li class='godam-transcoded-url-info'><span class='dashicons dashicons-yes-alt'></span><strong>%s</strong></li>",
								esc_html__( 'File saved and transcoded successfully on GoDAM', 'godam' )
							);
						}
					}
				}

				if ( $is_video ) {

					if ( $transcoded_url ) {
						$transcoded_url = esc_url( $transcoded_url );
					}

					$video_output = do_shortcode( "[godam_video src='{$file_path}' transcoded_url='{$transcoded_url}' aspectRatio='']" );
					$video_output = '<div class="gf-godam-video-preview">' . $video_output . '</div>';
					$output_arr[] = $video_output;
				}

				if ( $is_audio ) {
					ob_start();
					?>
						<audio controls>
							<?php if ( $transcoded_url ) : ?>
								<source src="<?php echo esc_url( $transcoded_url ); ?>" type="<?php echo esc_attr( $file_type['type'] ); ?>">
							<?php endif; ?>
							<source src="<?php echo esc_url( $file_path ); ?>" type="<?php echo esc_attr( $file_type['type'] ); ?>">
							Your browser does not support the audio element.
						</audio>
					<?php
					$audio_output = ob_get_clean();

					$audio_output = '<div class="gf-godam-audio-preview">' . $audio_output . '</div>';
					$output_arr[] = $audio_output;
				}

				$output = join( PHP_EOL, $output_arr );
			}

			return empty( $output ) || 'text' === $format ? $output : sprintf( '<ul>%s</ul>', $output );
		}
	}
	// phpcs:enable WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase

}

