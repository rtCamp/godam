<?php
/**
 * GoDAM Identifier for FluentForms
 *
 * This class handles the automatic injection of hidden fields into FluentForms
 * when forms are created or updated. It ensures that every FluentForm contains
 * a 'godam_source' hidden field with the form ID as its value.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\FluentForms;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Identifier Class
 *
 * Manages the injection of hidden fields into FluentForms to track form sources.
 * Uses the Singleton pattern to ensure only one instance exists.
 */
class Identifier {

	use Singleton;

	/**
	 * Constructor
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup WordPress hooks and filters
	 */
	protected function setup_hooks() {
		/**
		 * This action is triggered when a new FluentForm is created.
		 * We use it to ensure the hidden field is added to the database.
		 */
		add_action( 'fluentform/inserted_new_form', array( $this, 'ensure_hidden_field_db' ) );

		/**
		 * This filter is triggered when form fields are updated in the editor.
		 * We use it to ensure the hidden field is included in the form structure.
		 */
		add_filter( 'fluentform/form_fields_update', array( $this, 'ensure_hidden_field_json' ), 10, 2 );
	}

	/**
	 * Ensure hidden field exists in database for new forms
	 *
	 * @param int $form_id The ID of the newly created form.
	 * @return void
	 */
	public function ensure_hidden_field_db( $form_id ) {
		// Get the current form fields from the database.
		$form_fields = $this->get_form_fields_from_db( $form_id );
		
		// Ensure the hidden field exists in the form structure.
		$updated_fields = $this->ensure_hidden_field_exists( $form_fields, $form_id );

		// Only update the database if changes were made.
		if ( $updated_fields !== $form_fields ) {
			wpFluent()->table( 'fluentform_forms' )
				->where( 'id', $form_id )
				->update(
					array(
						'form_fields' => wp_json_encode( $updated_fields ),
					)
				);
		}
	}

	/**
	 * Ensure hidden field exists in form fields JSON
	 * 
	 * @param string $form_fields_json The form fields as a JSON string.
	 * @param int    $form_id         The ID of the form being updated.
	 * @return string The modified form fields JSON string.
	 */
	public function ensure_hidden_field_json( $form_fields_json, $form_id ) {
		// Decode the JSON string to work with the form fields array.
		$form_fields = json_decode( $form_fields_json, true );
		
		if ( ! is_array( $form_fields ) ) {
			return $form_fields_json;
		}

		// Ensure the hidden field exists in the form structure.
		$updated_fields = $this->ensure_hidden_field_exists( $form_fields, $form_id );
		
		// Return the modified form fields as JSON.
		return wp_json_encode( $updated_fields );
	}

	/**
	 * Ensure the godam_source hidden field exists in form fields
	 *
	 * Checks if the hidden field already exists in the form fields array.
	 * If not, it adds the hidden field with the proper structure.
	 *
	 * @param array $form_fields The form fields array.
	 * @param int   $form_id     The form ID.
	 * @return array The updated form fields array.
	 */
	private function ensure_hidden_field_exists( array $form_fields, $form_id ) {
		// Ensure the fields array exists and is properly structured.
		if ( empty( $form_fields['fields'] ) || ! is_array( $form_fields['fields'] ) ) {
			$form_fields['fields'] = array();
		}

		// Check if the godam_source field already exists.
		foreach ( $form_fields['fields'] as $field ) {
			if ( isset( $field['name'] ) && 'godam_source' === $field['name'] ) {
				return $form_fields;
			}
		}

		// Add the hidden field to the form fields array.
		$form_fields['fields'][] = array(
			'element'        => 'input_hidden',
			'id'             => 'godam_source_' . $form_id,
			'name'           => 'godam_source',
			'attributes'     => array(
				'name'  => 'godam_source',
				'type'  => 'hidden',
				// The default `$form_id` is further used to identify the form ID when to render the corresponding video source ID.
				'value' => $form_id,
			),
			'settings'       => array(
				'admin_field_label' => 'GoDAM Source',
				'label'             => 'GoDAM Source',
			),
			'editor_options' => array(
				'title'      => 'GoDAM Source',
				'icon_class' => 'ff-edit-hidden-field',
				'template'   => 'inputHidden',
			),
		);

		return $form_fields;
	}

	/**
	 * Get form fields from database
	 *
	 * Retrieves the form fields from the FluentForms database table
	 * and decodes the JSON structure.
	 * 
	 * @param int $form_id The form ID.
	 * @return array The decoded form fields array.
	 */
	private function get_form_fields_from_db( $form_id ) {
		// Get the form record from the database.
		$form = wpFluent()->table( 'fluentform_forms' )->where( 'id', $form_id )->first();
		
		if ( ! $form ) {
			return array( 'fields' => array() );
		}

		// Decode the JSON form fields.
		$decoded = json_decode( $form->form_fields, true );
		
		// Return the decoded fields or an empty fields array if decoding fails.
		return is_array( $decoded ) ? $decoded : array( 'fields' => array() );
	}
}
