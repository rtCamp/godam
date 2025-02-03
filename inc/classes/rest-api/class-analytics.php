<?php
/**
 * REST API class for Analytics.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\REST_API;

use WP_REST_Server;
use WP_REST_Request;
use WP_REST_Response;
use Transcoder\Inc\EasyDAM_Constants;

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
		$analytics_endpoint = EasyDAM_Constants::ANALYTICS_ENDPOINT_DEV . 'processed-analytics/fetch/';

		$account_token = get_site_option( 'rt-transcoding-api-key', 'unverified' );

		// Check if license key is valid.
		if ( empty( $account_token ) || 'unverified' === $account_token ) {
			return new WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => 'Invalid or unverified license key.',
				),
				403
			);
		}

		// Build query parameters safely.
		$query_params = array(
			'video_id'      => $video_id,
			'site_url'      => $site_url,
			'account_token' => $account_token,
		);

		$analytics_url = add_query_arg( $query_params, $analytics_endpoint );

		// Send request to analytics microservice.
		$response = wp_remote_get( $analytics_url, array( 'timeout' => 10 ) );

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
			return new WP_REST_Response(
				array(
					'status' => 'success',
					'data'   => $data['processed_analytics'],
				),
				200
			);
		}

		// If no data found, return empty response.
		return new WP_REST_Response(
			array(
				'status'  => 'success',
				'data'   => array(
					'account_token'  => '',
					'all_time_heatmap' => json_encode([]),
					'date' => date('Y-m-d'),
					'heatmap' => json_encode([]),
					'page_load' => 0,
					'play_time' => 0.0,
					'plays' => 0,
					'site_url' => '',
					'video_id' => 0,
					'video_length' => 0.0,
				),
			),
			200
		);
	}
}
