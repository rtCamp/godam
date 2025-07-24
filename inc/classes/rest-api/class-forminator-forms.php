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
 * @since 1.3.0
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
}
