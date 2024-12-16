<?php
/**
 * Register REST API endpoints for any Assets file endpoints.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\REST_API;

/**
 * Class LocationAPI
 */
class GF extends Base {

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/gforms',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_gforms' ),
						'permission_callback' => array( $this, 'get_gforms_permissions_check' ),
						'args'                => $this->get_collection_params(),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/gforms/(?P<id>\d+)',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_gform' ),
						'permission_callback' => array( $this, 'get_gforms_permissions_check' ),
						'args'                => $this->get_collection_params(),
					),
				),
			),
		);
	}


	/**
	 * Get all Gravity Forms.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_gforms( $request ) {
		// Check if Gravity Forms plugin is active.
		if ( ! class_exists( 'GFAPI' ) ) {
			return new \WP_Error( 'gravity_forms_not_active', 'Gravity Forms plugin is not active.', array( 'status' => 404 ) );
		}

		// Get all forms.
		$gforms = \GFAPI::get_forms();

		// Get the output fields.
		$fields = $request->get_param( 'fields' );

		// Filter fields.
		if ( ! empty( $fields ) ) {
			$fields = explode( ',', $fields );
			$gforms = array_map(
				function( $gform ) use ( $fields ) {
					return array_intersect_key( $gform, array_flip( $fields ) );
				},
				$gforms 
			);
		}

		return rest_ensure_response( $gforms );
	}

	/**
	 * Get a single Gravity Form.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_gform( $request ) {
		// Check if Gravity Forms plugin is active.
		if ( ! class_exists( 'GFAPI' ) ) {
			return new \WP_Error( 'gravity_forms_not_active', 'Gravity Forms plugin is not active.', array( 'status' => 404 ) );
		}

		$form_id = $request->get_param( 'id' );
		$form_id = absint( $form_id );

		if ( empty( $form_id ) ) {
			return new \WP_Error( 'invalid_form_id', 'Invalid form ID.', array( 'status' => 404 ) );
		}

		$gform = do_shortcode( "[gravityform id='{$form_id}' title='false' description='false' ajax='true']" );

		return rest_ensure_response( $gform );
	}



	/**
	 * Get item permissions check.
	 *
	 * Because we are routing to other endpoints,
	 * we don't need to check permissions.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return bool
	 */
	public function get_gforms_permissions_check( $request ) {
		return true;
	}
}
