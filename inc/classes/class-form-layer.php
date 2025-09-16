<?php
/**
 * Class to handle Form Layer customization.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use Forminator_API;
use Forminator_Hidden;
use RTGODAM\Inc\Traits\Singleton;
use WPCF7_ContactForm;

/**
 * Class Form_Layer
 */
class Form_Layer {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {

		$this->setup_hooks();
	}

	/**
	 * Setup hooks for the Form Layer.
	 */
	protected function setup_hooks() {
		/**
		 * Add filter to handle Forminator hidden field value.
		 * on GET request, inject the video_id into the hidden field.
		 * on POST request, retrieve submitted value for this hidden field.
		 */
		add_filter( 'forminator_field_hidden_field_value', array( __CLASS__, 'update_forminator_hidden_field_value' ), 10, 3 );
		add_filter( 'everest_forms_process_before_form_data', array( __CLASS__, 'add_everest_forms_entry_godam_identifier' ), 10, 2 );
		add_filter( 'everest_forms_entry_single_data', array( __CLASS__, 'update_' ), 10, 2 );
	}

	/**
	 * Static array to hold form identifiers.
	 *
	 * @var array
	 */
	protected static $form_identifiers = array();

	/**
	 * Adds the godam identifier to the appropriate form type.
	 *
	 * @param int    $video_id Video ID.
	 * @param string $form_type Form type (e.g., 'cf7', 'gravity').
	 * @param int    $form_id Form ID.
	 *
	 * @return void
	 */
	public static function add_form_godam_identifier( $video_id, $form_type, $form_id ) {
		// Bail early if any of the parameters are empty.
		if ( empty( $video_id ) || empty( $form_type ) || empty( $form_id ) ) {
			return;
		}

		$godam_identifier = array(
			'video_id' => $video_id,
		);

		// Register the identifier for the specific form type and ID.
		self::$form_identifiers[ $form_type ][ $form_id ] = $godam_identifier;

		switch ( strtolower( $form_type ) ) {
			case 'cf7':
				// Add the filter only if it hasn't been added yet.
				if ( ! has_filter( 'wpcf7_form_elements', array( __CLASS__, 'handle_cf7_form' ) ) ) {
					add_filter( 'wpcf7_form_elements', array( __CLASS__, 'handle_cf7_form' ) );
				}
				break;

			case 'gravity':
				// Add the filter if it hasn't been added yet.
				if ( ! has_filter( 'gform_field_value_godam_source', array( __CLASS__, 'handle_gravity_form' ) ) ) {
					add_filter( 'gform_field_value_godam_source', array( __CLASS__, 'handle_gravity_form' ), 10, 2 );
				}
				break;

			case 'sureforms':
				// Add the filter if it hasn't been added yet.
				// TODO: update the filter name to `render_block_srfm/hidden` after testing with SureForms Premium.
				if ( ! has_filter( 'render_block_srfm/input', array( __CLASS__, 'handle_sureforms' ) ) ) {
					add_filter( 'render_block_srfm/input', array( __CLASS__, 'handle_sureforms' ), 10, 2 );
				}
				break;

			case 'forminator':
				// Add the hidden field to the Forminator form.
				self::may_be_add_forminator_form_field( $form_id );
				// NOTE: filter for Forminator is already added in the constructor.
				break;
			
			case 'fluentforms':
				// Add the filter if it hasn't been added yet.
				if ( ! has_filter( 'fluentform/rendering_form', array( __CLASS__, 'handle_fluentforms' ) ) ) {
					add_filter( 'fluentform/rendering_form', array( __CLASS__, 'handle_fluentforms' ), 10, 1 );
				}
				break;

			case 'everestforms':
				// Add the filter if it hasn't been added yet.
				if ( ! has_filter( 'everest_forms_frontend_form_data', array( __CLASS__, 'handle_everest_forms' ) ) ) {
					add_filter( 'everest_forms_frontend_form_data', array( __CLASS__, 'handle_everest_forms' ), 10, 1 );
				}
				break;
		}
	}

	/**
	 * Update Forminator hidden field value based on request method.
	 * This method handles GET and POST requests differently. because Forminator take the default value not the actual value for the hidden field.
	 * 
	 * @param mixed $value      The current value of the field.
	 * @param mixed $save_value The value to be saved.
	 * @param array $field      The field data.
	 * 
	 * @return mixed Updated value for the field.
	 */
	public static function update_forminator_hidden_field_value( $value, $save_value, $field ) {
		// Check if Forminator classes exist.
		if ( ! class_exists( 'Forminator_Hidden' ) ) {
			return $value;
		}

		// Safely get the form ID from the default value.
		$form_id = $field['default_value'];

		// Bail early if form ID is not set.
		if ( empty( $form_id ) ) {
			return $value;
		}

		// Normalize request method just in case.
		$request_method = strtoupper( sanitize_text_field( $_SERVER['REQUEST_METHOD'] ?? 'GET' ) );

		if ( 'GET' === $request_method && ! empty( self::$form_identifiers['forminator'][ $form_id ] ) ) {
			// On GET, inject the video_id into the hidden field.
			$value = wp_json_encode( 
				self::$form_identifiers['forminator'][ $form_id ],
				JSON_UNESCAPED_SLASHES
			);

		} elseif ( 'POST' === $request_method && 'godam_source' === $field['name'] ) {
			// On POST, retrieve submitted value for this hidden field.
			$value = Forminator_Hidden::get_post_data( $field['element_id'] );
		}

		return $value;
	}

	/**
	 * Add a hidden field to the Forminator form if it doesn't exist.
	 * This method checks if the 'godam_source' field exists in the form.
	 *
	 * @param int $form_id The ID of the Forminator form.
	 *
	 * @return void
	 */
	public static function may_be_add_forminator_form_field( $form_id ) {
		// Check if Forminator classes exist.
		if ( ! class_exists( 'Forminator_API' ) ) {
			return;
		}

		// Get the current form fields.
		$form   = Forminator_API::get_form( $form_id );
		$fields = $form->get_fields_as_array();

		foreach ( $fields as $field ) {
			if ( isset( $field['name'] ) && 'godam_source' === $field['name'] ) {
				return; // Exit early if the field already exists.
			}
		}

		$field_data = array(
			'field_label'   => 'GoDAM Source',
			'name'          => 'godam_source',
			'required'      => false,
			'cols'          => 12,
			'default_value' => $form_id, // Store the form ID as the default value to identify the form while injecting dynamic value.
		);
		Forminator_API::add_form_field( $form_id, 'hidden', $field_data );
	}

	/**
	 * Handle Contact Form 7 integration.
	 *
	 * @param string $content The form content.
	 *
	 * @return string Modified form content.
	 */
	public static function handle_cf7_form( $content ) {
		// Check if Contact Form 7 is active and the class exists.
		if ( ! class_exists( 'WPCF7_ContactForm' ) ) {
			return $content;
		}

		// Get the current Contact Form 7 instance.
		$current_form = WPCF7_ContactForm::get_current();

		if ( ! $current_form || ! (int) $current_form->id() ) {
			return $content;
		}
		// Get the current form ID.
		$current_form_id = (int) $current_form->id();

		// Check if the current form ID is present on the $form_identifiers cf7.
		if ( ! isset( self::$form_identifiers['cf7'][ $current_form_id ] ) ) {
			return $content;
		}

		$hidden_input = sprintf(
			'<input type="hidden" name="godam_source" value="%s">',
			esc_attr( wp_json_encode( self::$form_identifiers['cf7'][ $current_form_id ], JSON_UNESCAPED_SLASHES ) )
		);

		return $content . $hidden_input;
	}

	/**
	 * Handle Gravity Forms integration.
	 *
	 * @param array  $value The value of the field.
	 * @param object $field The field object.
	 *
	 * @return mixed Modified value for the field.
	 */
	public static function handle_gravity_form( $value, $field ) {
		if ( $field && $field->formId ) { // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase
			$form_id = $field->formId; // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase

			// Check if the form ID is present in the identifiers.
			if ( ! isset( self::$form_identifiers['gravity'][ $form_id ] ) ) {
				return $value;
			}
			$godam_identifier = self::$form_identifiers['gravity'][ $form_id ];

			return wp_json_encode( $godam_identifier, JSON_UNESCAPED_SLASHES );
		}
		return $value;
	}

	/**
	 * Handle SureForms block rendering and update input value for a specific slug.
	 *
	 * @param string $block_content The block's rendered HTML content.
	 * @param array  $block         The block data array including attributes.
	 * @return string Modified block content with updated input value.
	 */
	public static function handle_sureforms( $block_content, $block ) {
		$target_slug = 'godam_source';

		// Check if the block has attributes and if the slug matches the target slug.
		if (
			empty( $block['attrs'] ) || ! is_array( $block['attrs'] ) ||
			( $block['attrs']['slug'] ?? '' ) !== $target_slug
		) {
			return $block_content;
		}

		$form_id   = $block['attrs']['formId'] ?? 0;
		$sureforms = self::$form_identifiers['sureforms'] ?? array();

		// Check if the form ID exists in the identifiers.
		if ( ! $form_id || ! isset( $sureforms[ $form_id ] ) ) {
			return $block_content;
		}

		// Prepare the new value.
		$new_value = wp_json_encode( $sureforms[ $form_id ], JSON_UNESCAPED_SLASHES );

		if ( empty( $new_value ) ) {
			return $block_content;
		}

		// Replace the first occurrence of the value attribute in input tag.
		$block_content = preg_replace(
			'/(<input[^>]*\svalue=)"[^"]*"/i',
			'${1}"' . esc_attr( $new_value ) . '"',
			$block_content,
			1
		);

		return $block_content;
	}

	/**
	 * Updates the godam_source hidden field value for FluentForms.
	 *
	 * @param object $form The form object.
	 *
	 * @return object Modified form object.
	 */
	public static function handle_fluentforms( $form ) {
		// Get the current FluentForms instance.
		$current_form_id = $form->id ?? 0;

		// Check if the current form ID is present on the $form_identifiers fluentforms.
		if ( ! isset( self::$form_identifiers['fluentforms'][ $current_form_id ] ) ) {
			return $form;
		}

		// Check if godam_source field already exists in the form fields.
		if ( isset( $form->fields['fields'] ) && is_array( $form->fields['fields'] ) ) {
			foreach ( $form->fields['fields'] as &$field ) {
				if ( isset( $field['name'] ) && 'godam_source' === $field['name'] ) {
					// Get the video ID based on the current form ID.
					$field['attributes']['value'] = wp_json_encode(
						self::$form_identifiers['fluentforms'][ $current_form_id ],
						JSON_UNESCAPED_SLASHES
					);

					break;
				}
			}
		}

		return $form;
	}

	/**
	 * Handle Everest Forms integration using frontend form data filter.
	 * This method modifies the form data to include a hidden field with GoDAM identifier.
	 *
	 * @param array $form_data The form data array.
	 *
	 * @return array Modified form data with GoDAM hidden field.
	 */
	public static function handle_everest_forms( $form_data ) {
		if ( empty( $form_data ) || empty( $form_data['id'] ) ) {
			return $form_data;
		}

		$current_form_id = (int) $form_data['id'];

		if ( ! isset( self::$form_identifiers['everestforms'][ $current_form_id ] ) ) {
			return $form_data;
		}

		$godam_identifier = self::$form_identifiers['everestforms'][ $current_form_id ];
		$hidden_field     = self::build_godam_hidden_field( $current_form_id, $godam_identifier );

		self::inject_godam_hidden_field( $form_data, $hidden_field, $current_form_id );

		return $form_data;
	}

	/**
	 * Add submitted GoDAM source back into the form data for entry display or processing.
	 *
	 * @param array $form_data The form data array.
	 * @param array $entry The entry data array.
	 *
	 * @return array Modified form data with GoDAM source included.
	 */
	public static function add_everest_forms_entry_godam_identifier( $form_data, $entry ) {
		if ( empty( $form_data ) || empty( $form_data['id'] ) ) {
			return $form_data;
		}

		$current_form_id = (int) $form_data['id'];
		$hidden_field_id = 'hidden_field_godam_source_' . $current_form_id;
		$entry_fields    = $entry['form_fields'] ?? array();

		if ( ! isset( $entry_fields[ $hidden_field_id ] ) ) {
			return $form_data;
		}

		$godam_source = sanitize_text_field( wp_unslash( $entry_fields[ $hidden_field_id ] ) );
		$hidden_field = self::build_godam_hidden_field( $current_form_id, $godam_source );

		self::inject_godam_hidden_field( $form_data, $hidden_field, $current_form_id );

		return $form_data;
	}

	/**
	 * Update the entry's godam_source field for display.
	 *
	 * @param array $entry The entry data array.
	 * @param array $form_data The form data array.
	 *
	 * @return array Modified entry data with GoDAM source included.
	 */
	public static function update_( $entry, $form_data ) {
		// Handle both array and object formats.
		$form_id = is_array( $form_data ) ? ( $form_data['id'] ?? null ) : ( $form_data->form_id ?? null );

		if ( empty( $form_id ) || ! isset( $entry['godam_source'] ) ) {
			return $entry;
		}

		$godam_source_raw     = $entry['godam_source'];
		$godam_source_decoded = json_decode( $godam_source_raw, true );

		if ( is_array( $godam_source_decoded ) ) {
			$entry['godam_source'] = 'video id: ' . ( $godam_source_decoded['video_id'] ?? 'N/A' );
		} else {
			$entry['godam_source'] = sanitize_text_field( wp_unslash( $godam_source_raw ) );
		}

		return $entry;
	}

	/**
	 * Build the hidden GoDAM field.
	 *
	 * @param int   $form_id The form ID.
	 * @param mixed $value   The value to be stored in the hidden field.
	 */
	private static function build_godam_hidden_field( $form_id, $value ) {
		return array(
			'id'             => 'hidden_field_godam_source_' . $form_id,
			'type'           => 'hidden',
			'label'          => 'GoDAM Source',
			'label_disabled' => 1,
			'default_value'  => wp_json_encode( $value, JSON_UNESCAPED_SLASHES ),
			'css'            => 'godam-hidden-field',
			'meta-key'       => 'godam_source',
		);
	}

	/**
	 * Inject the hidden field into form fields and structure.
	 *
	 * @param array $form_data The form data array (passed by reference).
	 * @param array $hidden_field The hidden field data to be injected.
	 * @param int   $form_id The form ID.
	 *
	 * @return void
	 */
	private static function inject_godam_hidden_field( &$form_data, $hidden_field, $form_id ) {
		$hidden_field_id = $hidden_field['id'];

		if ( ! isset( $form_data['form_fields'] ) || ! is_array( $form_data['form_fields'] ) ) {
			$form_data['form_fields'] = array();
		}

		$form_data['form_fields'][ $hidden_field_id ] = $hidden_field;

		if ( ! isset( $form_data['structure'] ) || ! is_array( $form_data['structure'] ) ) {
			$form_data['structure'] = array();
		}

		$form_data['structure'][ 'row_godam_source_' . $form_id ] = array(
			'grid_1' => array( $hidden_field_id ),
		);
	}
}
