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
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/dashboard-metrics',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_dashboard_metrics' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'site_url' => array(
							'required'          => true,
							'type'              => 'string',
							'sanitize_callback' => 'esc_url_raw',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/dashboard-history',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_dashboard_history' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'days'     => array(
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
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/top-videos',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_top_videos' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'page'     => array(
							'required'          => false,
							'type'              => 'integer',
							'default'           => 1,
							'sanitize_callback' => 'absint',
						),
						'limit'    => array(
							'required'          => false,
							'type'              => 'integer',
							'default'           => 10,
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

		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_option( 'rtgodam-api-key', '' );

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
					'account_token'         => '',
					'all_time_heatmap'      => wp_json_encode( array() ),
					'date'                  => gmdate( 'Y-m-d' ),
					'heatmap'               => wp_json_encode( array() ),
					'page_load'             => 0,
					'play_time'             => 0.0,
					'plays'                 => 0,
					'site_url'              => '',
					'video_id'              => 0,
					'video_length'          => 0.0,
					'country_views'         => array(),
					'post_views'            => array(),
					'views_change'          => 0.0,
					'watch_time_change'     => 0.0,
					'play_rate_change'      => 0.0,
					'avg_engagement_change' => 0.0,
					'post_details'          => array(),
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

	/**
	 * Fetch dashboard metrics from the external API securely.
	 *
	 * @param WP_REST_Request $request REST API request.
	 * @return WP_REST_Response
	 */
	public function fetch_dashboard_metrics( WP_REST_Request $request ) {
		$site_url      = $request->get_param( 'site_url' );
		$account_token = get_site_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_site_option( 'rtgodam-api-key', '' );

		if ( empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_REST_Response(
				array(
					'status'    => 'error',
					'message'   => 'Invalid or unverified API key.',
					'errorType' => 'invalid_key',
				),
				200
			);
		}

		$endpoint = add_query_arg(
			array(
				'site_url'      => $site_url,
				'account_token' => $account_token,
				'api_key'       => $api_key,
			),
			RTGODAM_ANALYTICS_BASE . '/dashboard/metrics/fetch/'
		);

		$empty_metrics = array(
			'plays'                 => 0,
			'play_time'             => 0.0,
			'page_load'             => 0,
			'avg_engagement'        => 0.0,
			'country_views'         => array(),
			'views_change'          => 0.0,
			'watch_time_change'     => 0.0,
			'play_rate_change'      => 0.0,
			'avg_engagement_change' => 0.0,
		);

		$response = wp_remote_get( $endpoint );
		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'            => 'error',
					'message'           => $response->get_error_message(),
					'dashboard_metrics' => $empty_metrics,
				),
				500
			);
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		return new WP_REST_Response(
			array(
				'status'            => 'success',
				'dashboard_metrics' => $body['dashboard_metrics'] ?? $empty_metrics,
			),
			200
		);
	}

	/**
	 * Fetch dashboard metrics history from the external API securely.
	 *
	 * @param WP_REST_Request $request REST API request.
	 * @return WP_REST_Response
	 */
	public function fetch_dashboard_history( WP_REST_Request $request ) {
		$days          = $request->get_param( 'days' );
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

		$endpoint = add_query_arg(
			array(
				'days'          => $days,
				'site_url'      => $site_url,
				'account_token' => $account_token,
				'api_key'       => $api_key,
			),
			RTGODAM_ANALYTICS_BASE . '/dashboard/metrics/history/'
		);

		$response = wp_remote_get( $endpoint );
		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => $response->get_error_message(),
				),
				500
			);
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		return new WP_REST_Response(
			array(
				'status'                    => 'success',
				'dashboard_metrics_history' => $body['dashboard_metrics_history'] ?? array(),
			),
			200
		);
	}

	/**
	 * Fetch top videos from the external API securely.
	 *
	 * @param WP_REST_Request $request REST API request.
	 * @return WP_REST_Response
	 */
	public function fetch_top_videos( WP_REST_Request $request ) {
		$page          = $request->get_param( 'page' ) ?? 1;
		$limit         = $request->get_param( 'limit' ) ?? 10;
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

		$endpoint = add_query_arg(
			array(
				'page'          => $page,
				'limit'         => $limit,
				'site_url'      => $site_url,
				'account_token' => $account_token,
				'api_key'       => $api_key,
			),
			RTGODAM_ANALYTICS_BASE . '/dashboard/top-videos/'
		);

		$response = wp_remote_get( $endpoint );
		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => $response->get_error_message(),
				),
				500
			);
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );

		$top_videos = $body['top_videos'] ?? array();

		foreach ( $top_videos as &$video ) {
			if ( ! empty( $video['video_id'] ) ) {
				$attachment_id = intval( $video['video_id'] );
				$file_path     = get_attached_file( $attachment_id );
		
				if ( file_exists( $file_path ) ) {
					$file_size = filesize( $file_path );
					$video['video_size'] = round( $file_size / ( 1024 * 1024 ), 2 );
				} else {
					$video['video_size'] = 0;
				}
				$video['title']         = get_the_title( $attachment_id );
				$video['thumbnail_url'] = wp_get_attachment_image_url( $attachment_id, 'medium' );
			}
		}

		return new WP_REST_Response(
			array(
				'status'      => 'success',
				'top_videos'  => $top_videos,
				'total_pages' => $body['total_pages'] ?? 1,
			),
			200
		);
	}
}
