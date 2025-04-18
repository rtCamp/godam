<?php
/**
 * Register REST API endpoints for any Assets file endpoints.
 *
 * @package transcoder
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class LocationAPI
 */
class NinjaForm extends Base {

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/ninja-forms',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_ninja_forms' ),
						'permission_callback' => array( $this, 'get_ninja_forms_permissions_check' ),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/ninja-form',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_ninja_form' ),
						'permission_callback' => array( $this, 'get_ninja_forms_permissions_check' ),
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							array(
								'id'    => array(
									'description' => 'The ID of the Contact Form 7 Form.',
									'type'        => 'string',
									'required'    => true,
								),
								'theme' => array(
									'description'       => 'The theme to be applied to the Contact Form 7 Form.',
									'type'              => 'string',
									'required'          => false,
									'sanitize_callback' => 'sanitize_text_field',
								),
							)
						),
					),
				),
			),
		);
	}

	/**
	 * Get all Ninja Forms.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_ninja_forms( $request ) {
		// Check if Ninja Forms plugin is active.
		if ( ! class_exists( 'Ninja_Forms' ) ) {
			return new \WP_Error( 'ninja_forms_not_active', 'Ninja Forms plugin is not active.', array( 'status' => 404 ) );
		}

		$forms = Ninja_Forms()->form()->get_forms();

		// Filter the form id and title to be returned.
		$forms = array_map(
			function ( $form ) {
				return array(
					'id'    => $form->get_id(),
					'title' => $form->get_setting( 'title' ),
				);
			},
			$forms 
		);

		return rest_ensure_response( $forms );
	}

	/**
	 * Get a single Ninja Form.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_ninja_form( $request ) {
		// Check if Ninja Forms plugin is active.
		if ( ! class_exists( 'Ninja_Forms' ) ) {
			return new \WP_Error( 'ninja_forms_not_active', 'Ninja Forms plugin is not active.', array( 'status' => 404 ) );
		}

		$form_id = $request->get_param( 'id' );

		if ( empty( $form_id ) ) {
			return new \WP_Error( 'invalid_form_id', 'Invalid form ID.', array( 'status' => 404 ) );
		}

		$ninja_form = do_shortcode( "[ninja_form id='{$form_id}']" );

		return rest_ensure_response( $ninja_form );
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
	public function get_ninja_forms_permissions_check( $request ) {
		return true;
	}
}
