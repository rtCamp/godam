<?php
/**
 * REST API class for Analytics.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use WP_REST_Server;
use WP_REST_Request;
use WP_REST_Response;

/**
 * Class Analytics.
 */
class Analytics extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'analytics';

	/**
	 * Register custom REST API routes for Analytics.
	 *
	 * @return array Array of registered REST API routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/fetch',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_analytics_data' ),
					'permission_callback' => '__return_true', // Publicly accessible.
					'args'                => array(
						'video_id' => array(
							'required'          => true,
							'type'              => 'integer',
							'description'       => 'The Video ID for fetching analytics data.',
							'validate_callback' => function ( $param ) {
								return is_numeric( $param ) && intval( $param ) > 0;
							},
							'sanitize_callback' => 'absint',
						),
						'site_url' => array(
							'required'          => true,
							'type'              => 'string',
							'description'       => 'The Site URL associated with the video.',
							'sanitize_callback' => 'esc_url_raw',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/history',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_analytics_history' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'days'     => array(
							'required'          => true,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
						),
						'video_id' => array(
							'required'          => true,
							'type'              => 'integer',
							'sanitize_callback' => 'absint',
						),
						'site_url' => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'esc_url_raw',
						),
					),
				),
			),
		);
	}

	/**
	 * Fetch analytics data from the external API securely.
	 *
	 * @param WP_REST_Request $request REST API request.
	 * @return WP_REST_Response
	 */
	public function fetch_analytics_data( WP_REST_Request $request ) {
		$video_id = $request->get_param( 'video_id' );
		$site_url = $request->get_param( 'site_url' );

		// Define API URL for fetching analytics.
		$analytics_endpoint = RTGODAM_ANALYTICS_BASE . '/processed-analytics/fetch/';

		$account_token = get_site_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_site_option( 'rtgodam-api-key', '' );

		// Check if API key is valid.
		if ( empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => 'Invalid or unverified API key.',
				),
				200
			);
		}

		// Build query parameters safely.
		$query_params = array(
			'video_id'      => $video_id,
			'site_url'      => $site_url,
			'account_token' => $account_token,
			'api_key'       => $api_key,
		);

		$analytics_url = add_query_arg( $query_params, $analytics_endpoint );

		// Send request to analytics microservice.
		$response = wp_remote_get( $analytics_url );

		// Handle response errors.
		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => 'Error fetching analytics data: ' . $response->get_error_message(),
				),
				500
			);
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		// Return analytics data if available.
		if ( isset( $data['processed_analytics'] ) ) {
			$post_views   = $data['processed_analytics']['post_views'] ?? array();
			$post_ids     = array_keys( $post_views );
			$post_details = array();

			if ( ! empty( $post_ids ) ) {
				$posts = get_posts(
					array(
						'post__in'         => $post_ids,
						'post_type'        => 'post',
						'posts_per_page'   => -1,
						'orderby'          => 'post__in',
						'suppress_filters' => false,
					)
				);

				foreach ( $posts as $post ) {
					if ( isset( $post_views[ $post->ID ] ) ) {
						$post_details[] = array(
							'id'    => $post->ID,
							'title' => get_the_title( $post ),
							'url'   => get_permalink( $post ),
							'views' => $post_views[ $post->ID ],
						);
					}
				}
			}

			return new WP_REST_Response(
				array(
					'status' => 'success',
					'data'   => array_merge(
						$data['processed_analytics'],
						array( 'post_details' => $post_details )
					),
				),
				200
			);
		}

		// If no data found, return empty response.
		return new WP_REST_Response(
			array(
				'status' => 'success',
				'data'   => array(
					'account_token'    => '',
					'all_time_heatmap' => wp_json_encode( array() ),
					'date'             => gmdate( 'Y-m-d' ),
					'heatmap'          => wp_json_encode( array() ),
					'page_load'        => 0,
					'play_time'        => 0.0,
					'plays'            => 0,
					'site_url'         => '',
					'video_id'         => 0,
					'video_length'     => 0.0,
				),
			),
			200
		);
	}

	/**
	 * Fetch analytics history from the external API securely.
	 *
	 * @param WP_REST_Request $request REST API request.
	 * @return WP_REST_Response
	 */
	public function fetch_analytics_history( WP_REST_Request $request ) {
		$days          = $request->get_param( 'days' );
		$video_id      = $request->get_param( 'video_id' );
		$site_url      = $request->get_param( 'site_url' );
		$account_token = get_site_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_site_option( 'rtgodam-api-key', '' );

		if ( empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => 'Invalid or unverified API key.',
				),
				200
			);
		}

		$microservice_url = RTGODAM_ANALYTICS_BASE . '/processed-analytics/history/';
		$params           = array(
			'days'          => $days,
			'video_id'      => $video_id,
			'site_url'      => $site_url,
			'account_token' => $account_token,
			'api_key'       => $api_key,
		);

		$history_url = add_query_arg( $params, $microservice_url );
		$response    = wp_remote_get( $history_url );

		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => 'Error fetching history data: ' . $response->get_error_message(),
				),
				500
			);
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		return new WP_REST_Response(
			array(
				'status'              => 'success',
				'processed_analytics' => $data['processed_analytics'] ?? array(),
			),
			200
		);
	}
}
