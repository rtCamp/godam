<?php
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
 * Class GF
 */
class Engagement extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'engagement';

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/likes',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_likes' ),
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							array(
								'id' => array(
									'description'       => __( 'The ID of the Gravity Form.', 'godam' ),
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
	 * Get total likes for a video.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_likes( $request ) {
		// Check if Gravity Forms plugin is active.
		if ( ! class_exists( 'GFAPI' ) ) {
			return new \WP_Error( 'gravity_forms_not_active', __( 'Gravity Forms plugin is not active.', 'godam' ), array( 'status' => 404 ) );
		}

		// Get all forms.
		$gforms = \GFAPI::get_forms();

		// Get the output fields.
		$fields = $request->get_param( 'fields' );

		// Filter fields.
		if ( ! empty( $fields ) ) {
			$fields = explode( ',', $fields );
			$gforms = array_map(
				function ( $gform ) use ( $fields ) {
					return array_intersect_key( $gform, array_flip( $fields ) );
				},
				$gforms
			);
		}

		return rest_ensure_response( $gforms );
	}
}
