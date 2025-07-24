<?php
/**
 * Register REST API endpoints for Fluent Forms.
 *
 * Get all Fluent Forms and a single Fluent Form.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class Fluent_Forms
 */
class Fluent_Forms extends Base {

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/fluent-forms',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_fluent_forms' ),
						'permission_callback' => '__return_true',
						'args'                => $this->get_collection_params(),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/fluent-form',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_fluent_form' ),
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							array(
								'id' => array(
									'description'       => __( 'The ID of the Fluent Form.', 'godam' ),
									'type'              => 'integer',
									'required'          => true,
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
	 * Get all Gravity Forms.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_fluent_forms() {
		// Check if Fluent Forms plugin is active.
		if ( ! $this->is_plugin_active() ) {
			return new \WP_Error( 'fluent_forms_not_active', __( 'Fluent Forms plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		// Get all forms.
		$fform_api = new \FluentForm\App\Api\Form();

		$fforms = $fform_api->forms();

		return rest_ensure_response(
			array_map(
				function ( $fform ) {
					return array(
						'id'    => $fform->id,
						'title' => $fform->title,
					);
				},
				$fforms['data']
			)
		);
	}

	/**
	 * Get a single Gravity Form.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_fluent_form( $request ) {
		// Check if Fluent Forms plugin is active.
		if ( ! $this->is_plugin_active() ) {
			return new \WP_Error( 'fluent_forms_not_active', __( 'Fluent Forms plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$form_id = $request->get_param( 'id' );
		$form_id = absint( $form_id );

		if ( empty( $form_id ) ) {
			return new \WP_Error( 'invalid_form_id', __( 'Invalid form ID.', 'godam' ), array( 'status' => 404 ) );
		}

		$fform = do_shortcode(
			sprintf(
				"[fluentform id='%d']",
				$form_id
			)
		);

		return rest_ensure_response( $fform );
	}

	/**
	 * Returns true if Fluent Form plugin is active.
	 * 
	 * @return boolean
	 */
	public function is_plugin_active() {
		return is_plugin_active( 'fluentform/fluentform.php' );
	}
}
