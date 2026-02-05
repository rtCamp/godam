<?php
/**
 * Register REST API endpoints for Video Sync.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use WP_REST_Server;
use WP_REST_Request;

/**
 * Class Video_Sync
 */
class Video_Sync extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'video-sync';

	/**
	 * Get REST routes.
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/check-videos',
				'args'      => array(
					array(
						'methods'             => WP_REST_Server::CREATABLE,
						'callback'            => array( $this, 'check_videos' ),
						'permission_callback' => '__return_true',
						'args'                => array(
							'api_key' => array(
								'required' => true,
								'type'     => 'string',
							),
						),
					),
				),
			),
		);
	}

	/**
	 * Check videos and return (video_id, job_id) tuples.
	 *
	 * @param WP_REST_Request $request Request object.
	 *
	 * @return \WP_REST_Response|\WP_Error Response object.
	 */
	public function check_videos( $request ) {
		// 1. Verify Referrer
		$referer = $request->get_header( 'referer' );
		$parsed  = wp_parse_url( $referer );

		if ( ! isset( $parsed['host'] ) || 'app.godam.io' !== $parsed['host'] ) {
			return new \WP_Error( 'forbidden', __( 'Invalid access', 'godam' ), array( 'status' => 403 ) );
		}

		// 2. Verify API Key
		$incoming_api_key = $request->get_param( 'api_key' );
		$stored_api_key   = get_option( 'rtgodam-api-key', '' );

		if ( empty( $stored_api_key ) || $incoming_api_key !== $stored_api_key ) {
			return new \WP_Error( 'forbidden', __( 'Invalid API Key', 'godam' ), array( 'status' => 403 ) );
		}

		// 3. Get all videos with job_id
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$results = $wpdb->get_results(
			"
			SELECT post_id, meta_value 
			FROM {$wpdb->postmeta} 
			WHERE meta_key = 'rtgodam_transcoding_job_id'
			AND meta_value != ''
			"
		);

		$tuples = array();
		foreach ( $results as $row ) {
			$tuples[] = array(
				'video_id' => (int) $row->post_id,
				'job_id'   => $row->meta_value,
			);
		}

		// 4. Return data
		return rest_ensure_response(
			array(
				'version' => RTGODAM_VERSION,
				'videos'  => $tuples,
			)
		);
	}
}
