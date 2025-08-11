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
		$godam_identifier = array(
			'video_id' => $video_id,
		);

		switch ( strtolower( $form_type ) ) {
			case 'cf7':
				// Add the identifier to Contact Form 7.
				self::$form_identifiers['cf7'][ $form_id ] = $godam_identifier;

				// Add the filter only if it hasn't been added yet.
				if ( ! has_filter( 'wpcf7_form_elements', array( __CLASS__, 'handle_cf7_form' ) ) ) {
					add_filter( 'wpcf7_form_elements', array( __CLASS__, 'handle_cf7_form' ) );
				}
				break;

			case 'gravity':
				// Add the identifier to Gravity Forms.
				self::$form_identifiers['gravity'][ $form_id ] = $godam_identifier;

				// Add the filter if it hasn't been added yet.
				if ( ! has_filter( 'gform_field_value_godam_source', array( __CLASS__, 'handle_gravity_form' ) ) ) {
					add_filter( 'gform_field_value_godam_source', array( __CLASS__, 'handle_gravity_form' ), 10, 2 );
				}
				break;

			case 'sureforms':
				// Add the identifier to SureForms.
				self::$form_identifiers['sureforms'][ $form_id ] = $godam_identifier;

				// Add the filter if it hasn't been added yet.
				// TODO: update the filter name to `render_block_srfm/hidden` after testing with SureForms Premium.
				if ( ! has_filter( 'render_block_srfm/input', array( __CLASS__, 'handle_sureforms' ) ) ) {
					add_filter( 'render_block_srfm/input', array( __CLASS__, 'handle_sureforms' ), 10, 2 );
				}
				break;

			case 'forminator':
				// Add the identifier to Forminator.
				self::$form_identifiers['forminator'][ $form_id ] = $godam_identifier;
				
				// Add the hidden field to the Forminator form.
				self::may_be_add_forminator_form_field( $form_id );
				// NOTE: filter for Forminator is already added in the constructor.
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
}
