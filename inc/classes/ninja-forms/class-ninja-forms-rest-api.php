<?php
/**
 * Register REST API endpoints for Ninja Forms.
 *
 * Get a single Ninja Form.
 *
 * @since 1.4.0
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Ninja_Forms;

use RTGODAM\Inc\Traits\Singleton;
use RTGODAM\Inc\REST_API\Base;


defined( 'ABSPATH' ) || exit;

/**
 * Class Ninja_Forms_Rest_Api
 *
 * @since 1.4.0
 */
class Ninja_Forms_Rest_Api extends Base {

	/**
	 * Get REST routes.
	 *
	 * @since 1.4.0
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
						'permission_callback' => '__return_true',
						'args'                => $this->get_collection_params(),
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
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							array(
								'id' => array(
									'description'       => __( 'The ID of the Ninja Form.', 'godam' ),
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
	 * Get all Ninja Forms.
	 *
	 * @since 1.4.0
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_ninja_forms( $request ) {
		// Check if Ninja Forms plugin is active.
		if ( ! is_plugin_active( 'ninja-forms/ninja-forms.php' ) ) {
			return new \WP_Error( 'ninja_forms_not_active', __( 'Ninja Forms plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		$forms = \Ninja_Forms()->form()->get_forms();

		$new_forms = array_map(
			function ( $form ) {
				return array(
					'id'    => $form->get_id(),
					'title' => $form->get_setting( 'title' ),
				);
			},
			$forms
		);

		return rest_ensure_response( $new_forms );
	}

	/**
	 * Get a single Ninja Form.
	 *
	 * @since 1.4.0
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_ninja_form( $request ) {
		// Check if Ninja Forms plugin is active.
		if ( ! is_plugin_active( 'ninja-forms/ninja-forms.php' ) ) {
			return new \WP_Error(
				'ninja_forms_not_active',
				__( 'Ninja Forms plugin is not active.', 'godam' ),
				array( 'status' => 404 )
			);
		}

		$form_id = absint( $request->get_param( 'id' ) );

		if ( empty( $form_id ) ) {
			return new \WP_Error( 'invalid_form_id', __( 'Invalid form ID.', 'godam' ), array( 'status' => 404 ) );
		}

		$form = Ninja_Forms()->form( $form_id );

		if ( $form ) {
			$ninja_form = do_shortcode( "[ninja_form id={$form_id}]" );
		} else {
			/* translators: %d is the Ninja Form ID */
			$ninja_form = sprintf( __( 'Unable to find the Ninja Form with ID:%d', 'godam' ), $form_id );
		}

		return rest_ensure_response( $ninja_form );
	}
}
