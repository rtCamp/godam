<?php
/**
 * Register REST API endpoints for Engagement.
 *
 * Get all Engagement data for a video.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use WP_REST_Server;
use WP_REST_Request;
use WP_REST_Response;

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
				'route'     => '/' . $this->rest_base . '/activities',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::READABLE,
						'callback'            => array( $this, 'get_activities' ),
						'permission_callback' => '__return_true',
						'args'                => array_merge(
							$this->get_collection_params(), // Default collection params.
							array(
								'video_id' => array(
									'description'       => __( 'The ID of the video.', 'godam' ),
									'type'              => 'integer',
									'required'          => true,
									'sanitize_callback' => 'absint',
								),
								'site_url' => array(
									'required'          => true,
									'type'              => 'string',
									'description'       => __( 'The Site URL associated with the video.', 'godam' ),
									'sanitize_callback' => 'esc_url_raw',
								),
							)
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/user-hit-like',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'user_hit_like' ),
						'permission_callback' => '__return_true',
						'args'                => array(
							'video_id' => array(
								'description'       => __( 'The ID of the video.', 'godam' ),
								'type'              => 'integer',
								'required'          => true,
								'sanitize_callback' => 'absint',
							),
							'site_url' => array(
								'required'          => true,
								'type'              => 'string',
								'description'       => __( 'The Site URL associated with the video.', 'godam' ),
								'sanitize_callback' => 'esc_url_raw',
							),
						),
					),
				),
			),
		);
	}

	/**
	 * Get all activities for a video.
	 *
	 * @param \WP_REST_Request $request Request Object.
	 * @return \WP_REST_Response
	 */
	public function get_activities( $request ) {

		$response_data = array();
		$video_id      = $request->get_param( 'video_id' );
		$site_url      = $request->get_param( 'site_url' );

		$account_creadentials = $this->access_creadentials_check();

		if ( $account_creadentials instanceof WP_REST_Response ) {
			return $account_creadentials;
		}

		$query_params = wp_parse_args(
			array(
				'video_id' => $video_id,
				'site_url' => $site_url,
			),
			$account_creadentials,
		);

		$analytics_data = $this->get_views( $query_params );

		if ( $analytics_data instanceof WP_REST_Response ) {
			return $analytics_data;
		}

		if ( ! empty( $analytics_data['processed_analytics'] ) ) {
			$response_data['views_count'] = array_sum( $analytics_data['processed_analytics']['post_views'] ?? array() );
		}

		$likes                        = get_post_meta( $video_id, 'likes', true );
		$likes                        = ! empty( $likes ) && is_array( $likes ) ? $likes : array();
		$current_user                 = get_current_user_id();
		$current_user_key             = "liked_by_use_id_{$current_user}";
		$response_data['is_liked']    = isset( $likes[ $current_user_key ] ) ? true : false;
		$response_data['likes_count'] = count( $likes );

		return new WP_REST_Response(
			array(
				'status' => 'success',
				'data'   => $response_data,
			),
			200
		);
	}

	/**
	 * Handle microservice responses and convert them into a standard format.
	 *
	 * @param \WP_Error|\WP_HTTP_Response $response Microservice response.
	 *
	 * @return WP_REST_Response Response in standard format.
	 */
	public function process_response( $response ) {

		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => __( 'Unable to reach server.', 'godam' ),
					'errorType' => 'microservice_error',
				),
				200
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
				200
			);
		}

		if ( $http_code >= 500 ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => $detail,
					'errorType' => 'microservice_error',
				),
				200
			);
		}

		return $data;
	}

	/**
	 * Checks if access credentials (API key and account token) are valid.
	 *
	 * @return WP_REST_Response|array Returns an error response if credentials are invalid,
	 *                              otherwise an array with account token and API key.
	 */
	public function access_creadentials_check() {

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
				200
			);
		}

		return array(
			'account_token' => $account_token,
			'api_key'       => $api_key,
		);
	}

	/**
	 * Get analytics data for given query parameters.
	 *
	 * @param array $query_params Query parameters for analytics microservice.
	 * @return array|WP_REST_Response Analytics data or error response.
	 */
	public function get_views( $query_params ) {
		// Define API URL for fetching analytics.
		$analytics_endpoint = RTGODAM_ANALYTICS_BASE . '/processed-analytics/fetch/';
		$analytics_url      = add_query_arg( $query_params, $analytics_endpoint );

		// Send request to analytics microservice.
		$analytics_response = wp_remote_get( $analytics_url );

		return $this->process_response( $analytics_response );
	}

	public function user_hit_like( $request ) {

		$response_data = array();
		$video_id      = $request->get_param( 'video_id' );
		$site_url      = $request->get_param( 'site_url' );

		$account_creadentials = $this->access_creadentials_check();

		if ( $account_creadentials instanceof WP_REST_Response ) {
			return $account_creadentials;
		}

		$status           = false;
		$current_user     = get_current_user_id();
		$current_user_key = "liked_by_use_id_{$current_user}";

		$like_data = array(
			'video_id' => $video_id,
			'site_url' => $site_url,
			'user_id'  => $current_user,
		);

		$likes = get_post_meta( $video_id, 'likes', true );
		$likes = ! empty( $likes ) && is_array( $likes ) ? $likes : array();

		if ( ! isset( $likes[ $current_user_key ] ) ) {
			$likes[ $current_user_key ] = $like_data;
			$status                     = true;
		} else {
			unset( $likes[ $current_user_key ] );
		}

		$status_updated = update_post_meta( $video_id, 'likes', $likes );
		if ( $status_updated ) {
			return new WP_REST_Response(
				array(
					'status'      => 'success',
					'isUserLiked' => $status,
					'likes_count' => count( $likes ),
				),
				200
			);
		}

		return new WP_REST_Response(
			array(
				'status'    => 'error',
				'message'   => __( 'Failed to update likes.', 'godam' ),
				'errorType' => 'failed_to_update_likes',
			),
			200
		);
	}
}
