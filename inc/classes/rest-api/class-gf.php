<?php

declare(strict_types = 1);

/**
 * Register REST API endpoints for Gravity Forms.
 *
 * Get all Gravity Forms and a single Gravity Form.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class LocationAPI
 */
class GF extends Base {
	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return [
			[
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/gforms',
				'args'      => [
					[
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => [ $this, 'get_gforms' ],
						'permission_callback' => '__return_true',
						'args'                => $this->get_collection_params(),
					],
				],
			],
			[
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/gform',
				'args'      => [
					[
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => [ $this, 'get_gform' ],
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							[
								'id'    => [
									'description'       => __( 'The ID of the Gravity Form.', 'godam' ),
									'type'              => 'integer',
									'required'          => true,
									'sanitize_callback' => 'absint',
								],
								'theme' => [
									'description'       => __( 'The theme to be applied to the Gravity Form.', 'godam' ),
									'type'              => 'string',
									'required'          => false,
									'sanitize_callback' => 'sanitize_text_field',
								],
							]
						),
					],
				],
			],
		];
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
			return new \WP_Error( 'gravity_forms_not_active', __( 'Gravity Forms plugin is not active.', 'godam' ), [ 'status' => 404 ] );
		}

		// Get all forms.
		$gforms = \GFAPI::get_forms();

		// Get the output fields.
		$fields = $request->get_param( 'fields' );

		// Filter fields.
		if ( ! empty( $fields ) ) {
			$fields = explode( ',', $fields );
			$gforms = array_map(
				static function ( $gform ) use ( $fields ) {
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
			return new \WP_Error( 'gravity_forms_not_active', __( 'Gravity Forms plugin is not active.', 'godam' ), [ 'status' => 404 ] );
		}

		$form_id = $request->get_param( 'id' );
		$theme   = $request->get_param( 'theme' );
		$form_id = absint( $form_id );

		if ( empty( $form_id ) ) {
			return new \WP_Error( 'invalid_form_id', __( 'Invalid form ID.', 'godam' ), [ 'status' => 404 ] );
		}

		$gform = do_shortcode( "[gravityform id='{$form_id}' title='false' description='false' ajax='true' theme='{$theme}']" );

		return rest_ensure_response( $gform );
	}
}
