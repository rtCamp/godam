<?php
/**
 * Class to handle Form Layer customization.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;
use WPCF7_ContactForm;

/**
 * Class Form_Layer
 */
class Form_Layer {

	use Singleton;

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
					// Add the filter to handle Contact Form 7 submissions.
					add_filter( 'wpcf7_form_elements', array( __CLASS__, 'handle_cf7_form' ) );
				}
				break;

			case 'gravity':
				// Add the identifier to Gravity Forms.
				self::$form_identifiers['gravity'][ $form_id ] = $godam_identifier;

				// Add the filter if it hasn't been added yet.
				if ( ! has_filter( 'gform_field_value_godam_source', array( __CLASS__, 'handle_gravity_form' ) ) ) {
					// Add the filter to handle Gravity Forms submissions.
					add_filter( 'gform_field_value_godam_source', array( __CLASS__, 'handle_gravity_form' ), 10, 2 );
				}
				break;
		}
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
}
