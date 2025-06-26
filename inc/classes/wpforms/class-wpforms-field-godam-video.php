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
		 * @since 1.0.0
		 */
		public function init() {

			// Define field type information.
			$this->name     = esc_html__( 'GoDAM Record', 'godam' );
			$this->keywords = esc_html__( 'godam, video', 'godam' );
			$this->type     = 'video';
			$this->icon     = 'fa-video-camera';
			$this->order    = 30;

			// Define additional field properties.
			// add_filter( 'wpforms_field_properties_text', [ $this, 'field_properties' ], 5, 3 );
			// add_action( 'wpforms_frontend_js', [ $this, 'frontend_js' ] );
		}

		/**
		 * Create the field options panel. Used by subclasses.
		 *
		 * @since 1.0.0
		 * @since 1.5.0 Converted to abstract method, as it's required for all fields.
		 *
		 * @param array $video_field Field data and settings.
		 */
		public function field_options( $video_field ) {

			// Populate basic field options
			$this->field_option( 'basic-options', $video_field, array( 'markup' => 'open' ) );
			$this->field_option( 'label', $video_field );
			$this->file_selector_field_element( $video_field );
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

			// Define data.
			$placeholder   = ! empty( $field['placeholder'] ) ? $field['placeholder'] : '';
			$default_value = ! empty( $field['default_value'] ) ? $field['default_value'] : '';

			// Label.
			$this->field_preview_option( 'label', $field );

			// Primary input.
			echo '<input type="file" placeholder="' . esc_attr( $placeholder ) . '" value="' . esc_attr( $default_value ) . '" class="primary-input" readonly>';

			// Description.
			$this->field_preview_option( 'description', $field );
		}

		/**
		 * Field display on the form front-end.
		 *
		 * @since 1.0.0
		 *
		 * @param array $field      Field settings.
		 * @param array $deprecated Deprecated.
		 * @param array $form_data  Form data and settings.
		 */
		public function field_display( $field, $deprecated, $form_data ) {

			// Define data.
			$primary = $field['properties']['inputs']['primary'];

			if ( isset( $field['limit_enabled'] ) ) {
				$limit_count = isset( $field['limit_count'] ) ? absint( $field['limit_count'] ) : 0;
				$limit_mode  = isset( $field['limit_mode'] ) ? sanitize_key( $field['limit_mode'] ) : 'characters';

				$primary['data']['form-id']  = $form_data['id'];
				$primary['data']['field-id'] = $field['id'];

				if ( 'characters' === $limit_mode ) {
					$primary['class'][]            = 'wpforms-limit-characters-enabled';
					$primary['attr']['maxlength']  = $limit_count;
					$primary['data']['text-limit'] = $limit_count;
				} else {
					$primary['class'][]            = 'wpforms-limit-words-enabled';
					$primary['data']['text-limit'] = $limit_count;
				}
			}

			// Primary field.
			printf(
				'<input type="text" %s %s>',
				wpforms_html_attributes( $primary['id'], $primary['class'], $primary['data'], $primary['attr'] ),
				$primary['required'] // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
			);
		}

		protected function file_selector_field_element( $video_field ) {
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
				'local'      => esc_html__( 'Local Files', 'godam' ),
				'webcam'     => esc_html__( 'Webcam', 'godam' ),
				'screencast' => esc_html__( 'Screencast', 'godam' ),
			);

			$checkboxes = '';
			foreach ( $file_selectors as $selector_slug => $selector_label ) {
				$checkboxes .= $this->field_element(
					'toggle',
					$video_field,
					array(
						'slug'  => "file-selector_{$selector_slug}",
						'desc'  => $selector_label,
						'value' => isset( $video_field[ "file-selector_{$selector_slug}" ] ) ? '1' : '0',
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
	}
}
