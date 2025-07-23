<?php
/**
 * Register the Uppy Video field for Everest_Forms.
 *
 * @since n.e.x.t
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Everest_Forms;

defined( 'ABSPATH' ) || exit;

if ( class_exists( 'EVF_Form_Fields_Upload' ) ) {
	/**
	 * Everest_Forms GoDAM Video Field Class
	 *
	 * @since n.e.x.t
	 */
	class Everest_Forms_Field_GoDAM_Video extends \EVF_Form_Fields_Upload {

		/**
		 * Field id.
		 *
		 * @since n.e.x.t
		 *
		 * @var sting
		 */
		public $field_id;

		/**
		 * Field data.
		 *
		 * @since n.e.x.t
		 * @var array
		 */
		public $field_data;

		/**
		 * Constructor.
		 *
		 * @since n.e.x.t
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

			// Register assets.
			add_action( 'admin_enqueue_scripts', array( $this, 'register_assets' ) );
			add_action( 'wp_enqueue_scripts', array( $this, 'register_assets' ) );

			add_filter( 'everest_forms_process_before_filter', array( $this, 'save_video_file' ), 10, 2 );
		}

		/**
		 * Define additional field properties.
		 *
		 * @since n.e.x.t
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
			$properties['inputs']['primary']['attr']['name'] = "evf_{$this->form_id}_{$this->field_id}";

			// Input Primary: max file size.
			$properties['inputs']['primary']['data']['rule-maxsize'] = $this->max_file_size();

			return $properties;
		}

		/**
		 * Field preview inside the builder.
		 *
		 * @param array $field Field data.
		 */
		public function field_preview( $field ) {
			wp_enqueue_style( 'everest-forms-uppy-video-style' );

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
			printf( '<button type="button" class="wpforms-btn uppy-video-upload-button">' );
			printf( '<span class="dashicons dashicons-video-alt"></span>' );
			printf( esc_html__( 'Record Video', 'godam' ) );
			printf( '</button>' );

			// Description.
			$this->field_preview_option( 'description', $field );
		}

		/**
		 * Field display on the form front-end.
		 *
		 * @since n.e.x.t
		 *
		 * @param array $field Field Data.
		 * @param array $field_atts Field attributes.
		 * @param array $form_data All Form Data.
		 */
		public function field_display( $field, $field_atts, $form_data ) {
			$file_selectors = $this->extract_file_selectors_from_field( $field );
			require untrailingslashit( RTGODAM_PATH ) . '/inc/classes/everest-forms/everest-forms-field-godam-record-frontend.php';
		}

		/**
		 * Register assets.
		 *
		 * @since n.e.x.t
		 *
		 * @param array $atts Shortcode attributes.
		 */
		public function register_assets( $atts ) {
			wp_register_style(
				'everest-forms-uppy-video-style',
				RTGODAM_URL . 'assets/build/css/everest-forms-uppy-video.css',
				array(),
				filemtime( RTGODAM_PATH . 'assets/build/css/everest-forms-uppy-video.css' )
			);

			// Common godam recorder script.
			wp_register_script(
				'godam-recorder-script',
				RTGODAM_URL . 'assets/build/js/godam-recorder.min.js',
				array( 'jquery' ),
				filemtime( RTGODAM_PATH . 'assets/build/js/godam-recorder.min.js' ),
				true
			);
		}

		/**
		 * Register/queue frontend scripts.
		 *
		 * @since n.e.x.t
		 *
		 * @param array $atts Shortcode attributes.
		 */
		public function load_assets( $atts ) {
			wp_enqueue_style( 'everest-forms-uppy-video-style' );

			// Common godam recorder script.
			wp_enqueue_script( 'godam-recorder-script' );
		}

		/**
		 * Extract and return file selectors from the field.
		 *
		 * @since n.e.x.t
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
		 * @param array $field Field data.
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
		 * Save godam video file.
		 *
		 * @since n.e.x.t
		 *
		 * @param array $entry Entry submitted data.
		 * @param array $form_data Form data and settings.
		 *
		 * @return array
		 */
		public function save_video_file( $entry, $form_data ) {
			global $wp_filesystem;

			require_once ABSPATH . 'wp-admin/includes/file.php';

			WP_Filesystem();

			if ( null === $wp_filesystem ) {
				return $entry;
			}

			$upload_dir        = wp_get_upload_dir();
			$everest_forms_dir = untrailingslashit( $upload_dir['basedir'] ) . '/godam/everest-forms';

			if ( false === wp_mkdir_p( $everest_forms_dir ) ) {
				return $entry;
			}

			// No need to perform nonce verification as this is already done by the Everest Forms forms processor.
			// phpcs:ignore WordPress.Security.NonceVerification.Missing
			$files = $this->format_global_files_array( $_FILES );

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

				$filename = wp_unique_filename( $everest_forms_dir, $file['name'] );

				$moved_file = $wp_filesystem->move( $file['tmp_name'], "{$everest_forms_dir}/{$filename}" );

				if ( $moved_file ) {
					$saved_file_url               = untrailingslashit( $upload_dir['baseurl'] ) . "/godam/everest-forms/{$filename}";
					$entry['fields'][ $field_id ] = $saved_file_url;
				}
			}

			return $entry;
		}
	}
}
