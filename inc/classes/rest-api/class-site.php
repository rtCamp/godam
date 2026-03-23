<?php
/**
 * Register REST API endpoints for Site.
 *
 * Get site data.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use WP_REST_Server;
use WP_REST_Response;

/**
 * Class Site
 */
class Site extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'site';

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/site-data',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_site_data' ),
						'permission_callback' => function () {
							return current_user_can( 'edit_posts' );
						},
					),
				),
			),
		);
	}

	/**
	 * Get remote data of the site.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 *
	 * @return WP_REST_Response
	 */
	public function get_site_data( $request ) {

		$account_credentials = $this->access_credentials_check();

		if ( $account_credentials instanceof WP_REST_Response ) {
			return $account_credentials;
		}

		$query_params = wp_parse_args(
			array(
				'api_key'  => $account_credentials['api_key'],
				'site_url' => site_url(),
			),
			$account_credentials,
		);

		$cache_key = 'rtgodam-siteinfo-' . md5( $query_params['site_url'] );
		$site_data = rtgodam_cache_get( $cache_key );

		if ( ! $site_data ) {

			$site_endpoint      = RTGODAM_API_BASE . '/api/method/godam_core.api.site.get_site_folder';
			$site_url           = add_query_arg( $query_params, $site_endpoint );
			$site_data_response = wp_remote_get( $site_url );
			$site_data_response = $this->process_response( $site_data_response );

			if ( $site_data_response instanceof WP_REST_Response ) {
				return $site_data_response;
			}

			if ( ! empty( $site_data_response['message']['folder_id'] ) ) {
				// Cache the response data for future requests.
				rtgodam_cache_set( $cache_key, $site_data_response, 86400 );
				$site_data = $site_data_response;
			}
		}

		return new WP_REST_Response(
			array(
				'status' => 'success',
				'data'   => $site_data,
			),
			200
		);
	}

	/**
	 * Handle microservice responses and convert them into a standard format.
	 *
	 * @param array|\WP_HTTP_Response $response Microservice response.
	 *
	 * @return WP_REST_Response|array Response in standard format or decoded data array.
	 */
	public function process_response( $response ) {

		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => __( 'Unable to reach server.', 'godam' ),
					'errorType' => 'microservice_error',
				),
				500
			);
		}

		$body      = wp_remote_retrieve_body( $response );
		$data      = json_decode( $body, true );
		$http_code = wp_remote_retrieve_response_code( $response );
		$detail    = $data['detail'] ?? __( 'Unexpected error from server.', 'godam' );

		if ( 404 === $http_code || 400 === $http_code ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => $detail,
					'errorType' => 'invalid_key',
				),
				$http_code
			);
		}

		if ( $http_code >= 500 ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => $detail,
					'errorType' => 'microservice_error',
				),
				$http_code
			);
		}

		return $data;
	}

	/**
	 * Checks if access credentials (API key and account token) are valid.
	 *
	 * @return WP_REST_Response|array Returns an error response if credentials are invalid,
	 *                                otherwise an array with account token and API key.
	 */
	public function access_credentials_check() {

		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_option( 'rtgodam-api-key', '' );

		// Check if API key is missing.
		if ( empty( $api_key ) || empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => __( 'Missing API key.', 'godam' ),
					'errorType' => 'missing_key',
				),
				404
			);
		}

		return array(
			'account_token' => $account_token,
			'api_key'       => $api_key,
		);
	}
}
