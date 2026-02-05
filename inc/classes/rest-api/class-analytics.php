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
							'description'       => __( 'The Video ID for fetching analytics data.', 'godam' ),
							'validate_callback' => function ( $param ) {
								return is_numeric( $param ) && intval( $param ) > 0;
							},
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
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/history',
				'args'      => array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_analytics_history' ),
					'permission_callback' => '__return_true',
					'args'                => array(
						'days'     => array(
							'required'          => false,
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
							'required'          => false,
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
					'status'    => 'error',
					'message'   => __( 'Unable to reach analytics server.', 'godam' ),
					'errorType' => 'microservice_error',
				),
				200
			);
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		$http_code = wp_remote_retrieve_response_code( $response );
		$detail    = $data['detail'] ?? __( 'Unexpected error from analytics server.', 'godam' );

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

		// Return analytics data if available.
		if ( isset( $data['processed_analytics'] ) ) {
			$post_views   = $data['processed_analytics']['post_views'] ?? array();
			$post_ids     = array_keys( $post_views );
			$post_details = array();

			if ( ! empty( $post_ids ) ) {
				$posts = get_posts(
					array(
						'post__in'         => $post_ids,
						'post_type'        => 'any',
						'posts_per_page'   => -1,
						'orderby'          => 'post__in',
						'suppress_filters' => false, // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.get_posts_get_posts
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
		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_option( 'rtgodam-api-key', '' );

		if ( empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => __( 'Invalid or unverified API key.', 'godam' ),
				),
				200
			);
		}

		$microservice_url = RTGODAM_ANALYTICS_BASE . '/processed-analytics/history/';
		$params           = array(
			'video_id'      => $video_id,
			'site_url'      => $site_url,
			'account_token' => $account_token,
			'api_key'       => $api_key,
		);

		// Only add days parameter if it's provided.
		if ( ! empty( $days ) ) {
			$params['days'] = $days;
		}

		$history_url = add_query_arg( $params, $microservice_url );
		$response    = wp_remote_get( $history_url );

		if ( is_wp_error( $response ) ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					/* translators: %s is the error message from the API response. */
					'message' => sprintf( __( 'Error fetching history data: %s', 'godam' ), $response->get_error_message() ),
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
		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_option( 'rtgodam-api-key', '' );

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
					'status'    => 'error',
					'message'   => __( 'Unable to reach analytics server.', 'godam' ),
					'errorType' => 'microservice_error',
				),
				200
			);
		}

		$http_code = wp_remote_retrieve_response_code( $response );
		$body      = json_decode( wp_remote_retrieve_body( $response ), true );
		$detail    = $body['detail'] ?? __( 'Unexpected error from analytics server.', 'godam' );

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
		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_option( 'rtgodam-api-key', '' );

		if ( empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => __( 'Invalid or unverified API key.', 'godam' ),
				),
				200
			);
		}

		$params = array(
			'site_url'      => $site_url,
			'account_token' => $account_token,
			'api_key'       => $api_key,
		);

		// Only add days parameter if it's provided.
		if ( ! empty( $days ) ) {
			$params['days'] = $days;
		}

		$endpoint = add_query_arg(
			$params,
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
		$account_token = get_option( 'rtgodam-account-token', 'unverified' );
		$api_key       = get_option( 'rtgodam-api-key', '' );

		if ( empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => __( 'Invalid or unverified API key.', 'godam' ),
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
				$attachment    = get_post( $attachment_id );
				
				if ( $attachment && 'attachment' === $attachment->post_type ) {
					// Check if this is virtual media (from GoDAM Tab).
					$godam_original_id = get_post_meta( $attachment_id, '_godam_original_id', true );
					$is_virtual_media  = ! empty( $godam_original_id );
					
					// Get file size - different approach for virtual vs local media.
					if ( $is_virtual_media ) {
						// For virtual media, get size from metadata.
						$metadata  = get_post_meta( $attachment_id, '_wp_attachment_metadata', true );
						$file_size = isset( $metadata['filesize'] ) ? (int) $metadata['filesize'] : 0;
					} else {
						// For local media, get actual file size.
						$file_path = get_attached_file( $attachment_id );
						
						$file_size = ( $file_path && file_exists( $file_path ) ) ? filesize( $file_path ) : 0;
						
					}
					
					$video['video_size']    = round( $file_size / ( 1024 * 1024 ), 2 );
					$video['title']         = get_the_title( $attachment_id );
					$video['exists']        = true;
					$video['is_virtual']    = $is_virtual_media;
					$custom_thumbnail       = get_post_meta( $attachment_id, 'rtgodam_media_video_thumbnail', true );
					$default_thumb          = wp_get_attachment_image_url( $attachment_id, 'medium' );
					$video['thumbnail_url'] = $custom_thumbnail ?: $default_thumb ?: null;
				} else {
					// Media doesn't exist.
					$video['title']         = sprintf( 'ID: %d (Deleted Media)', $video['video_id'] );
					$video['video_size']    = 0;
					$video['thumbnail_url'] = null;
					$video['exists']        = false;
					$video['is_virtual']    = false;
				}
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
