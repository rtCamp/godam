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
				'route'     => "/{$this->rest_base}/hubspot-forms",
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_hubspot_forms' ),
						'permission_callback' => '__return_true',
						'args'                => array(
							'id' => array(
								'description'       => __( 'The job ID of the Video.', 'godam' ),
								'type'              => 'integer',
								'required'          => true,
								'sanitize_callback' => 'absint',
							),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/hubspot-portal-id',
				'args'      => array(
					array(
						'methods'             => \WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_hubspot_portal_id' ),
						'permission_callback' => '__return_true',
						'args'                => array(),
					),
				),
			),
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

		$file_id = get_post_meta( $id, 'rtgodam_transcoding_job_id', true );
		if ( empty( $file_id ) ) {
			return new \WP_Error(
				404,
				__( 'Media not found', 'godam' ),
			);
		}

		$api_url = RTGODAM_API_BASE . '/api/method/godam_core.api.file.get_file';

		$api_key = get_option( 'rtgodam-api-key', '' );

		$request_args = array(
			'api_key' => $api_key,
			'file_id' => $file_id,
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
			return new \WP_REST_Response(
				array( 'layers' => array() )
			);
		}

		$layers = json_decode( $body->message->layer_data );
		if ( ! isset( $layers->layers ) ) {
			return new \WP_Error(
				400,
				__( 'Received invalid response.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		return new \WP_REST_Response(
			$layers
		);
	}

	/**
	 * Get HubSpot portal ID.
	 *
	 * @return \WP_REST_Response|\WP_Error Response object on success, or WP_Error on failure.
	 */
	public function get_hubspot_portal_id() {
		$api_url = RTGODAM_API_BASE . '/api/method/godam_core.api.hubspot.get_portal_id_with_api_key';

		$api_key = get_option( 'rtgodam-api-key', '' );

		$request_args = array(
			'api_key' => $api_key,
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
				array( 'status' => 400 )
			);
		}

		$body = json_decode( wp_remote_retrieve_body( $response ) );
		if ( ! is_object( $body ) || ! isset( $body->message ) || ! isset( $body->message->hub_id ) ) {
			return new \WP_Error(
				400,
				__( 'Received invalid response.', 'godam' ),
				array( 'status' => 400 )
			);
		}

		return new \WP_REST_Response(
			array( 'hubspotPortalId' => $body->message->hub_id )
		);
	}
}
