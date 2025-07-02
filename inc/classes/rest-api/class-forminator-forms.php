<?php
/**
 * Register REST API endpoints for Forminator Forms.
 * 
 * Get all Forminator Forms and a single Forminator Form.
 * 
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

use WP_Error;
use WP_REST_Request;
use WP_REST_Response;
use WP_REST_Server;

defined( 'ABSPATH' ) || exit;

/**
 * Class ForminatorForms
 * 
 * @since n.e.x.t
 */
class Forminator_Forms extends Base {

	/**
	 * Variable to check if Forminator is active.
	 * 
	 * @var bool
	 * @access private
	 */
	private $is_forminator_active = false; 

	/**
	 * Check if Forminator is active or not.
	 * 
	 * @return true|false true on active and false on not active.
	 */
	private function is_forminator_active() {
		return class_exists( 'Forminator_API' );
	}

	/**
	 * Get REST routes.
	 * 
	 * @return array
	 */
	public function get_rest_routes() {

		// Check for Forminator forms plugin activation.
		$this->is_forminator_active = $this->is_forminator_active();

		if ( ! $this->is_forminator_active ) {
			return array();
		}

		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/forminator-forms',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_forminator_forms' ),
						'permission_callback' => '__return_true',
						'args'                => $this->get_collection_params(),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/forminator-form',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_forminator_form' ),
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							array(
								'id' => array(
									'description'       => __( 'The ID of the Forminator Form.', 'godam' ),
									'type'              => 'integer',
									'required'          => true,
									'validate_callback' => function ( $param ) {
										return is_numeric( $param ) && $param > 0;
									},
									'sanitize_callback' => 'absint',
								),
							)
						),
					),
				),
			),
			/**
			 * TODO: Add the permission checks for these routes.
			 *       Reduce code duplicacy in the callbacks.
			 *       Re-verify the options for fields.
			 *       Check the direct usage of Forminator API once.
			 */
			array(
				'namespace' => $this->namespace,
				'route'     => '/forminator/check-form-field',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'check_form_field' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'form_id'    => array(
							'required'          => true,
							'validate_callback' => function ( $param ) {
								return is_numeric( $param );
							},
						),
						'field_type' => array(
							'required'          => true,
							'validate_callback' => function ( $param ) {
								return is_string( $param );
							},
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/forminator/add-form-field',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'add_form_field' ),
					'permission_callback' => '__return_true',
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/forminator/remove-form-field',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'remove_form_field' ),
					'permission_callback' => '__return_true',
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/forminator/update-form-field',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'update_form_field' ),
					'permission_callback' => '__return_true',
				),
			),
		);
	}

	/**
	 * Get all Forminator Forms.
	 * 
	 * @param WP_REST_Request $request Request Object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_forminator_forms( WP_REST_Request $request ) {
		if ( ! $this->is_forminator_active ) {
			return new WP_Error( 'forminator_not_active', __( 'Forminator plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$paged     = 1;
		$per_page  = 50; // Default number of forms to retrieve.
		$all_forms = array();

		do {
			$forms = \Forminator_API::get_forms(
				null,
				$paged,
				$per_page,
				'publish',
			);

			if ( empty( $forms ) ) {
				// No more forms to retrieve.
				break;
			}
			
			foreach ( $forms as $form ) {
				// Prepare the form data.
				$all_forms[] = array(
					'id'        => $form->id,
					'name'      => $form->name,
					'client_id' => $form->client_id,
					'status'    => $form->status,
				);
			}
			++$paged;
		} while ( true );
		
		if ( is_wp_error( $all_forms ) ) {
			return new WP_Error( 'forminator_forms_error', __( 'Error retrieving Forminator Forms.', 'godam' ), array( 'status' => 500 ) );
		}
		// Prepare response.
		$response = new WP_REST_Response( $all_forms );
		$response->set_status( 200 );
		return $response;
	}

	/**
	 * Get a single Forminator Form.
	 * 
	 * @param WP_REST_Request $request Request Object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_forminator_form( WP_REST_Request $request ) {
		if ( ! $this->is_forminator_active ) {
			return new WP_Error( 'forminator_not_active', __( 'Forminator plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}
		// Get Forminator Form ID from request.
		$form_id = $request->get_param( 'id' );
		if ( ! $form_id || ! is_numeric( $form_id ) ) {
			return new WP_Error( 'invalid_form_id', __( 'Invalid Forminator Form ID.', 'godam' ), array( 'status' => 400 ) );
		}
		// Get Forminator Form.
		$form = \Forminator_API::get_form( $form_id );
		if ( is_wp_error( $form ) ) {
			return new WP_Error( 'forminator_form_error', __( 'Error retrieving Forminator Form.', 'godam' ), array( 'status' => 500 ) );
		}

		$forminator_form = do_shortcode( "[forminator_form id='{$form_id}']" );

		// Remove the display:none style manually as we don't need heavy JS and AJAX from forms in admin panel.
		$forminator_form = str_replace( 'style="display: none;"', '', $forminator_form );

		// Remove edit link from shortcode output as we have custom edit button from js.
		$forminator_form = preg_replace( '/<a[^>]+class="forminator-module-edit-link"[^>]*>.*?<\/a>/i', '', $forminator_form );

		return new WP_REST_Response( $forminator_form );
	}

	/**
	 * Check permissions for the API endpoint
	 *
	 * @return bool
	 */
	public function check_permissions() {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Check if a form has a specific field type
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function check_form_field( $request ) {
		$form_id    = $request->get_param( 'form_id' );
		$field_type = $request->get_param( 'field_type' );

		// Check if Forminator API exists.
		if ( ! $this->is_forminator_active ) {
			return new \WP_REST_Response( 
				array( 
					'success'   => false,
					'has_field' => false,
					'message'   => 'Forminator API not found',
				),
				200
			);
		}

		try {
			$fields = \Forminator_API::get_form_fields( $form_id );
			
			if ( is_wp_error( $fields ) ) {
				return new \WP_REST_Response( 
					array( 
						'success'   => false,
						'has_field' => false,
						'message'   => $fields->get_error_message(),
					),
					200
				);
			}
			
			$has_field = false;
			
			foreach ( $fields as $field ) {
				if ( isset( $field->slug ) && str_contains( $field->slug, $field_type ) ) {
					$has_field = true;
					break;
				}
			}
			
			return new \WP_REST_Response( 
				array( 
					'success'   => true,
					'has_field' => $has_field,
				),
				200
			);
		} catch ( \Exception $e ) {
			return new \WP_REST_Response( 
				array( 
					'success'   => false,
					'has_field' => false,
					'message'   => $e->getMessage(),
				),
				200
			);
		}
	}

	/**
	 * Add a field to a form
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function add_form_field( $request ) {
		$params     = $request->get_params();
		$form_id    = isset( $params['form_id'] ) ? intval( $params['form_id'] ) : 0;
		$field_type = isset( $params['field_type'] ) ? sanitize_text_field( $params['field_type'] ) : '';
		$field_data = isset( $params['field_data'] ) ? $params['field_data'] : array();

		// Validate.
		if ( ! $form_id || ! $field_type ) {
			return new \WP_REST_Response( 
				array( 
					'success' => false,
					'message' => 'Missing required parameters',
				),
				400
			);
		}

		// Check if Forminator API exists.
		if ( ! class_exists( 'Forminator_API' ) ) {
			return new \WP_REST_Response( 
				array( 
					'success' => false,
					'message' => 'Forminator API not found',
				),
				404
			);
		}

		// Sanitize field data.
		$sanitized_field_data = $this->sanitize_field_data( $field_data );

		try {
			// First check if field already exists.
			$fields = \Forminator_API::get_form_fields( $form_id );
			
			if ( is_wp_error( $fields ) ) {
				return new \WP_REST_Response( 
					array( 
						'success' => false,
						'message' => $fields->get_error_message(),
					),
					400
				);
			}
			
			// Check if a field with this type already exists.
			foreach ( $fields as $field ) {
				if ( isset( $field->type ) && $field->type === $field_type ) {
					// Field already exists, update it instead.
					$result = $this->update_field( $form_id, $field->element_id, $sanitized_field_data );
					
					if ( $result ) {
						return new \WP_REST_Response( 
							array( 
								'success' => true,
								'message' => 'Field updated successfully',
								'field'   => $field,
							),
							200
						);
					} else {
						return new \WP_REST_Response( 
							array( 
								'success' => false,
								'message' => 'Failed to update field',
							),
							500
						);
					}
				}
			}
			
			// Field doesn't exist, add it.
			$field_id = \Forminator_API::add_form_field(
				$form_id,
				$field_type,
				$sanitized_field_data
			);
			
			if ( is_wp_error( $field_id ) ) {
				return new \WP_REST_Response( 
					array( 
						'success' => false,
						'message' => $field_id->get_error_message(),
					),
					400
				);
			}
			
			return new \WP_REST_Response( 
				array( 
					'success'  => true,
					'message'  => 'Field added successfully',
					'field_id' => $field_id,
				),
				200
			);
		} catch ( \Exception $e ) {
			return new \WP_REST_Response( 
				array( 
					'success' => false,
					'message' => $e->getMessage(),
				),
				500
			);
		}
	}

	/**
	 * Remove a field from a form
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function remove_form_field( $request ) {
		$params     = $request->get_params();
		$form_id    = isset( $params['form_id'] ) ? intval( $params['form_id'] ) : 0;
		$field_type = isset( $params['field_type'] ) ? sanitize_text_field( $params['field_type'] ) : '';

		// Validate.
		if ( ! $form_id || ! $field_type ) {
			return new \WP_REST_Response( 
				array( 
					'success' => false,
					'message' => 'Missing required parameters',
				),
				400
			);
		}

		// Check if Forminator API exists.
		if ( ! class_exists( 'Forminator_API' ) ) {
			return new \WP_REST_Response( 
				array( 
					'success' => false,
					'message' => 'Forminator API not found',
				),
				404
			);
		}

		try {
			// Get fields to find the one to remove.
			$fields = \Forminator_API::get_form_fields( $form_id );
			
			if ( is_wp_error( $fields ) ) {
				return new \WP_REST_Response( 
					array( 
						'success' => false,
						'message' => $fields->get_error_message(),
					),
					400
				);
			}
			
			$field_to_remove = null;
			
			foreach ( $fields as $field ) {
				if ( isset( $field->slug ) && str_contains( $field->slug, $field_type ) ) {
					$field_to_remove = $field;
					break;
				}
			}
			
			if ( ! $field_to_remove ) {
				return new \WP_REST_Response( 
					array( 
						'success' => false,
						'message' => 'Field not found',
					),
					404
				);
			}
			
			// Now delete the field.
			$result = \Forminator_API::delete_form_field(
				$form_id,
				$field_to_remove->element_id
			);
			
			if ( is_wp_error( $result ) ) {
				return new \WP_REST_Response( 
					array( 
						'success' => false,
						'message' => $result->get_error_message(),
					),
					400
				);
			}
			
			return new \WP_REST_Response( 
				array( 
					'success' => true,
					'message' => 'Field removed successfully',
				),
				200
			);
		} catch ( \Exception $e ) {
			return new \WP_REST_Response( 
				array( 
					'success' => false,
					'message' => $e->getMessage(),
				),
				500
			);
		}
	}

	/**
	 * Update a form field
	 *
	 * @param WP_REST_Request $request The request object.
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_form_field( $request ) {
		$params     = $request->get_params();
		$form_id    = isset( $params['form_id'] ) ? intval( $params['form_id'] ) : 0;
		$field_type = isset( $params['field_type'] ) ? sanitize_text_field( $params['field_type'] ) : '';
		$field_data = isset( $params['field_data'] ) ? $params['field_data'] : array();

		// Validate.
		if ( ! $form_id || ! $field_type ) {
			return new \WP_REST_Response( 
				array( 
					'success' => false,
					'message' => 'Missing required parameters',
				),
				400
			);
		}

		// Check if Forminator API exists.
		if ( ! class_exists( 'Forminator_API' ) ) {
			return new \WP_REST_Response( 
				array( 
					'success' => false,
					'message' => 'Forminator API not found',
				),
				404
			);
		}

		// Sanitize field data.
		$sanitized_field_data = $this->sanitize_field_data( $field_data );

		try {
			// Get fields to find the one to update.
			$fields = \Forminator_API::get_form_fields( $form_id );
			
			if ( is_wp_error( $fields ) ) {
				return new \WP_REST_Response( 
					array( 
						'success' => false,
						'message' => $fields->get_error_message(),
					),
					400
				);
			}
			
			$field_to_update = null;
			
			foreach ( $fields as $field ) {
				if ( isset( $field->slug ) && str_contains( $field->slug, $field_type ) ) {
					$field_to_update = $field;
					break;
				}
			}
			
			if ( ! $field_to_update ) {
				return new \WP_REST_Response( 
					array( 
						'success' => false,
						'message' => 'Field not found',
					),
					404
				);
			}
			
			// Update the field.
			$result = $this->update_field( $form_id, $field_to_update->element_id, $sanitized_field_data );
			
			if ( ! $result ) {
				return new \WP_REST_Response( 
					array( 
						'success' => false,
						'message' => 'Failed to update field',
					),
					400
				);
			}
			
			return new \WP_REST_Response( 
				array( 
					'success' => true,
					'message' => 'Field updated successfully',
				),
				200
			);
		} catch ( \Exception $e ) {
			return new \WP_REST_Response( 
				array( 
					'success' => false,
					'message' => $e->getMessage(),
				),
				500
			);
		}
	}

	/**
	 * Update a form field directly
	 * 
	 * This is a custom implementation because Forminator's API doesn't have a direct update field method
	 *
	 * @param int    $form_id    The form ID.
	 * @param string $field_id   The field ID.
	 * @param array  $field_data The field data.
	 * @return bool
	 */
	private function update_field( $form_id, $field_id, $field_data ) {
		try {
			// Get the form model.
			$model = \Forminator_Form_Model::model()->load( $form_id );
			
			if ( ! $model ) {
				return false;
			}
			
			// Find the field.
			foreach ( $model->fields as $key => $field ) {
				if ( $field['element_id'] === $field_id ) {
					// Update field with new data.
					foreach ( $field_data as $prop => $value ) {
						$model->fields[ $key ][ $prop ] = $value;
					}
					
					// Save the form.
					$model->save();
					return true;
				}
			}
			
			return false;
		} catch ( \Exception $e ) {
			return false;
		}
	}

	/**
	 * Sanitize field data
	 *
	 * @param array $field_data The field data.
	 * @return array
	 */
	private function sanitize_field_data( $field_data ) {
		$sanitized = array();

		if ( isset( $field_data['field_label'] ) ) {
			$sanitized['field_label'] = sanitize_text_field( $field_data['field_label'] );
		}

		if ( isset( $field_data['description'] ) ) {
			$sanitized['description'] = sanitize_textarea_field( $field_data['description'] );
		}

		if ( isset( $field_data['required'] ) ) {
			$sanitized['required'] = (bool) $field_data['required'];
		}

		if ( isset( $field_data['godam_file_selectors'] ) && is_array( $field_data['godam_file_selectors'] ) ) {
			$sanitized['godam_file_selectors'] = array_map( 'sanitize_text_field', $field_data['godam_file_selectors'] );
		}

		if ( isset( $field_data['godam_video_sync'] ) ) {
			$sanitized['godam_video_sync'] = (bool) $field_data['godam_video_sync'];
		}

		return $sanitized;
	}
}
