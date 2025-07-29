<?php
/**
 * Register REST API endpoints for HubSpot Forms.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class HubSpot_Forms
 */
class HubSpot_Forms extends Base {

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/hubspot-form',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_hubspot_form' ),
						'permission_callback' => '__return_true',
						'args'                => array(
							'id' => array(
								'description'       => __( 'The ID of the HubSpot Form.', 'godam' ),
								'type'              => 'string',
								'required'          => true,
								'sanitize_callback' => 'sanitize_text_field',
							),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/hubspot-forms',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_hubspot_forms' ),
						'permission_callback' => '__return_true',
						'args'                => array(
							'id' => array(
								'description'       => __( 'The job ID of the Video.', 'godam' ),
								'type'              => 'string',
								'required'          => true,
								'sanitize_callback' => 'sanitize_text_field',
							),
						),
					),
				),
			),
		);
	}

	/**
	 * Get a single HubSpot Form by ID.
	 *
	 * @param \WP_REST_Request $request Request object.
	 * @return \WP_REST_Response|\WP_Error Response object on success, or WP_Error on failure.
	 */
	public function get_hubspot_form( $request ) {
		$id = $request->get_param( 'id' );

		if ( empty( $id ) ) {
			return new \WP_Error(
				400,
				__( 'Form ID cannot be empty.', 'godam' ),
			);
		}

		$api_url = RTGODAM_API_BASE . '/api/method/godam_core.api.hubspot.get_form';

		$api_key = get_option( 'rtgodam-api-key', '' );

		$request_args = array(
			'api_key' => $api_key,
			'id'      => $id,
		);

		$api_url = add_query_arg(
			$request_args,
			$api_url
		);

		$response = wp_remote_get(
			$api_url,
			array(
				'headers' => array(
					'Content-Type' => 'application/json',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return new \WP_Error(
				400,
				__( 'There was a problem calling the API.', 'godam' ),
			);
		}

		$body = json_decode( wp_remote_retrieve_body( $response ) );
		if ( ! is_object( $body ) || ! isset( $body->message ) || ! isset( $body->message->files ) ) {
			return new \WP_Error(
				400,
				__( 'Received invalid response.', 'godam' ),
			);
		}

		return new \WP_REST_Response(
		);
	}

	/**
	 * Get all HubSpot Forms.
	 *
	 * @param \WP_REST_Request $request Full data about the request.
	 * @return \WP_REST_Response|\WP_Error Response object on success, or \WP_Error object on failure.
	 */
	public function get_hubspot_forms( \WP_REST_Request $request ) {
		$id = $request->get_param( 'id' );

		if ( empty( $id ) ) {
			return new \WP_Error(
				400,
				__( 'Form ID cannot be empty.', 'godam' ),
			);
		}

		$api_url = RTGODAM_API_BASE . '/api/method/godam_core.api.file.get_file';

		$api_key = get_option( 'rtgodam-api-key', '' );

		$request_args = array(
			'api_key' => $api_key,
			'file_id' => $id,
		);

		$api_url = add_query_arg(
			$request_args,
			$api_url
		);

		$response = wp_remote_get(
			$api_url,
			array(
				'headers' => array(
					'Content-Type' => 'application/json',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			return new \WP_Error(
				400,
				__( 'There was a problem calling the API.', 'godam' ),
			);
		}

		$body = json_decode( wp_remote_retrieve_body( $response ) );
		if ( ! is_object( $body ) || ! isset( $body->message ) || ! isset( $body->message->layer_data ) ) {
			return new \WP_Error(
				400,
				__( 'Received invalid response.', 'godam' ),
			);
		}

		return new \WP_REST_Response(
			$body->message->layer_data
		);
	}
}
