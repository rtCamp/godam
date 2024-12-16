<?php
/**
 * REST API class.
 *
 * @package transcoder
 */

namespace Transcoder\Inc;

use Transcoder\Inc\Traits\Singleton;

/**
 * Class Rest_API
 */
class Rest_API {

	use Singleton;

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Setup action/filter hooks.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
	}

	/**
	 * Register custom REST API routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		register_rest_route(
			'transcoder/v1',
			'/verify-license',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'verify_license' ),
				'permission_callback' => function() {
					return current_user_can( 'manage_options' );
				},
				'args'                => array(
					'license_key' => array(
						'required'          => true,
						'type'              => 'string',
						'description'       => 'The license key to verify.',
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);

		register_rest_route(
			'transcoder/v1',
			'/get-license-key',
			array(
				'methods'             => 'GET',
				'callback'            => array( $this, 'get_license_key' ),
				'permission_callback' => function() {
					return current_user_can( 'manage_options' );
				},
			)
		);

		register_rest_route(
			'transcoder/v1',
			'/easydam-settings',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( $this, 'get_easydam_settings' ),
					'permission_callback' => function() {
						return current_user_can( 'manage_options' );
					},
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( $this, 'update_easydam_settings' ),
					'permission_callback' => function() {
						return current_user_can( 'manage_options' );
					},
					'args'                => array(
						'settings' => array(
							'required'          => true,
							'type'              => 'object',
							'description'       => 'The easydam settings to save.',
							'sanitize_callback' => array( $this, 'sanitize_settings' ),
						),
					),
				),
			)
		);
	}

	/**
	 * Verify the license key using external API.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response
	 */
	public function verify_license( $request ) {
		$license_key = $request->get_param( 'license_key' );

		if ( empty( $license_key ) ) {
			return new \WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => 'License key is required.',
				),
				400
			);
		}

		// API endpoint to verify the license.
		$api_url = sprintf( 'http://frappe-transcoder-api.rt.gw/api/resource/Transcoder License/%s', $license_key );

		// Make the GET request to the API.
		$response = wp_remote_get(
			$api_url
		);

		error_log( 'API full response: ' . print_r( $response, true ) );

		if ( is_wp_error( $response ) ) {
			return new \WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => 'An error occurred while verifying the license. Please try again.',
				),
				500
			);
		}

		$status_code = wp_remote_retrieve_response_code( $response );
		$body        = json_decode( wp_remote_retrieve_body( $response ), true );

		// Handle success response.
		if ( 200 === $status_code && isset( $body['data'] ) ) {
			// Save the license key in the site options only if it is verified.
			update_site_option( 'rt-easydam-api-key', $license_key );

			return new \WP_REST_Response(
				array(
					'status'  => 'success',
					'message' => 'License key verified and stored successfully!',
					'data'    => $body['data'],
				),
				200
			);
		}

		// Handle failure response.
		if ( 404 === $status_code ) {
			return new \WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => 'Invalid license key. Please try again.',
				),
				404
			);
		}

		// Handle unexpected responses.
		return new \WP_REST_Response(
			array(
				'status'  => 'error',
				'message' => 'An unexpected error occurred. Please try again later.',
			),
			500
		);
	}

	/**
	 * Fetch the saved license key.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_license_key() {
		$license_key = get_site_option( 'rt-easydam-api-key', '' );

		return new \WP_REST_Response(
			array(
				'license_key' => $license_key,
			),
			200
		);
	}

	/**
	 * Fetch the EasyDAM settings.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_easydam_settings() {
		$default_settings = array(
			'video' => array(
				'sync_from_easydam'  => false,
				'adaptive_bitrate'   => false,
				'optimize_videos'    => false,
				'video_format'       => 'auto',
				'video_quality'      => '20',
				'video_thumbnails'   => 5,
				'overwrite_thumbnails' => false,
			),
			'image' => array(
				'sync_from_easydam'  => false,
				'optimize_images'    => false,
				'image_format'       => 'auto',
				'image_quality'      => '20',
			),
			'general' => array(
				'track_status' => false,
			),
		);

		// Retrieve settings from the database.
		$easydam_settings = get_option( 'rt-easydam-settings', $default_settings );

		return new \WP_REST_Response( $easydam_settings, 200 );
	}

	/**
	 * Update the easydam settings.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response
	 */
	public function update_easydam_settings( $request ) {
		$settings = $request->get_param( 'settings' );

		// Save settings to the database.
		update_option( 'rt-easydam-settings', $settings );

		return new \WP_REST_Response(
			array(
				'status'  => 'success',
				'message' => 'EasyDAM settings updated successfully!',
			),
			200
		);
	}

	/**
	 * Sanitize easydam settings.
	 *
	 * @param array $settings EasyDAM settings to sanitize.
	 * @return array
	 */
	public function sanitize_settings( $settings ) {
		$sanitized_settings = array(
			'video' => array(
				'sync_from_easydam'    => filter_var( $settings['video']['sync_from_easydam'], FILTER_VALIDATE_BOOLEAN ),
				'adaptive_bitrate'     => filter_var( $settings['video']['adaptive_bitrate'], FILTER_VALIDATE_BOOLEAN ),
				'optimize_videos'      => filter_var( $settings['video']['optimize_videos'], FILTER_VALIDATE_BOOLEAN ),
				'video_format'         => sanitize_text_field( $settings['video']['video_format'] ),
				'video_quality'        => sanitize_text_field( $settings['video']['video_quality'] ),
				'video_thumbnails'     => filter_var( $settings['video']['video_thumbnails'], 
					FILTER_VALIDATE_INT, array( "options" => array( "default" => 5, "min_range" => 1, "max_range" => 10 ) ) ),
				'overwrite_thumbnails' => filter_var( $settings['video']['overwrite_thumbnails'], FILTER_VALIDATE_BOOLEAN)
			),
			'image' => array(
				'sync_from_easydam'  => filter_var( $settings['image']['sync_from_easydam'], FILTER_VALIDATE_BOOLEAN ),
				'optimize_images'    => filter_var( $settings['image']['optimize_images'], FILTER_VALIDATE_BOOLEAN ),
				'image_format'       => sanitize_text_field( $settings['image']['image_format'] ),
				'image_quality'      => sanitize_text_field( $settings['image']['image_quality'] ),
			),
			'general' => array(
				'track_status' => filter_var( $settings['general']['track_status'], FILTER_VALIDATE_BOOLEAN ),
			),
		);

		return $sanitized_settings;
	}
}
