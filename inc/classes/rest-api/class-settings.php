<?php
/**
 * REST API class for Settings Pages.
 *
 * @package transcoder
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

/**
 * Class Settings
 */
class Settings extends Base {

	/**
	 * REST route base.
	 *
	 * @var string
	 */
	protected $rest_base = 'settings';

	/**
	 * Register custom REST API routes for Settings Pages.
	 *
	 * @return array Array of registered REST API routes
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/verify-license',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'verify_license' ),
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
					},
					'args'                => array(
						'license_key' => array(
							'required'          => true,
							'type'              => 'string',
							'description'       => 'The API key to verify.',
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/deactivate-license',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'deactivate_license' ),
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
					},
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/get-license-key',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_license_key' ),
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
					},
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/easydam-settings',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_easydam_settings' ),
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
					},
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/easydam-settings',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'update_easydam_settings' ),
					'permission_callback' => function () {
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
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/subscription-plans',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'fetch_subscription_plans' ),
					'permission_callback' => function () {
						return true; // Allow public access.
					},
				),
			),

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

		// Use the helper function to verify the license key.
		$result = rtgodam_verify_api_key( $license_key, true );

		if ( is_wp_error( $result ) ) {

			$error_data  = $result->get_error_data();
			$status_code = is_array( $error_data ) && isset( $error_data['status'] ) ? $error_data['status'] : 500;

			return new \WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => $result->get_error_message(),
					'code'    => $result->get_error_code(),
				),
				$status_code
			);
		}

		if ( ! empty( $result['data']['license_key'] ) ) {
			$result['data']['license_key'] = rtgodam_mask_string( $result['data']['license_key'] );
		}

		return new \WP_REST_Response(
			array(
				'status'  => 'success',
				'message' => $result['message'],
				'data'    => $result['data'],
			),
			200
		);
	}

	/**
	 * Deactivate the license key.
	 *
	 * @return \WP_REST_Response
	 */
	public function deactivate_license() {
		// Delete the license key from the database.
		$deleted_key   = delete_site_option( 'rtgodam-api-key' );
		$deleted_token = delete_site_option( 'rtgodam-account-token' );
		
		// Delete the user data from the site_option.
		delete_site_option( 'rtgodam_user_data' );

		if ( $deleted_key || $deleted_token ) {
			return new \WP_REST_Response(
				array(
					'status'  => 'success',
					'message' => 'API key deactivated successfully.',
				),
				200
			);
		}

		return new \WP_REST_Response(
			array(
				'status'  => 'error',
				'message' => 'Failed to deactivate the API key. It might not exist.',
			),
			400
		);
	}

	/**
	 * Fetch the saved license key.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_license_key() {
		$license_key = get_site_option( 'rtgodam-api-key', '' );

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
			'video'   => array(
				'sync_from_easydam'    => false,
				'adaptive_bitrate'     => false,
				'optimize_videos'      => false,
				'video_format'         => 'auto',
				'video_quality'        => array( 'auto', '240', '360', '480', '720', '1080', '1440', '2160' ),
				'video_thumbnails'     => 5,
				'overwrite_thumbnails' => false,
				'watermark'            => false,
				'watermark_text'       => '',
				'watermark_url'        => '',
				'use_watermark_image'  => false,
			),
			'image'   => array(
				'sync_from_easydam' => false,
				'optimize_images'   => false,
				'image_format'      => 'auto',
				'image_quality'     => '20',
			),
			'general' => array(
				'track_status'                => false,
				'is_verified'                 => false,
				'disable_folder_organization' => false,
				'selected_brand_image'        => '',
				'brand_color'                 => '#000000',
			),
		);

		// Retrieve settings from the database.
		$easydam_settings = get_option( 'rtgodam-settings', $default_settings );

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
		update_option( 'rtgodam-settings', $settings );

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
			'video'   => array(
				'sync_from_easydam'    => rest_sanitize_boolean( $settings['video']['sync_from_easydam'] ),
				'adaptive_bitrate'     => rest_sanitize_boolean( $settings['video']['adaptive_bitrate'] ),
				'optimize_videos'      => rest_sanitize_boolean( $settings['video']['optimize_videos'] ),
				'video_format'         => sanitize_text_field( $settings['video']['video_format'] ),
				'video_quality'        => array_map( 'sanitize_text_field', $settings['video']['video_quality'] ),
				'video_thumbnails'     => filter_var(
					$settings['video']['video_thumbnails'],
					FILTER_VALIDATE_INT,
					array(
						'options' => array(
							'default'   => 5,
							'min_range' => 1,
							'max_range' => 10,
						),
					)
				),
				'overwrite_thumbnails' => rest_sanitize_boolean( $settings['video']['overwrite_thumbnails'] ),
				'watermark'            => rest_sanitize_boolean( $settings['video']['watermark'] ),
				'watermark_text'       => sanitize_text_field( $settings['video']['watermark_text'] ),
				'watermark_url'        => esc_url_raw( $settings['video']['watermark_url'] ),
				'use_watermark_image'  => rest_sanitize_boolean( $settings['video']['use_watermark_image'] ),
			),
			'image'   => array(
				'sync_from_easydam' => rest_sanitize_boolean( $settings['image']['sync_from_easydam'] ),
				'optimize_images'   => rest_sanitize_boolean( $settings['image']['optimize_images'] ),
				'image_format'      => sanitize_text_field( $settings['image']['image_format'] ),
				'image_quality'     => sanitize_text_field( $settings['image']['image_quality'] ),
			),
			'general' => array(
				'track_status'                => rest_sanitize_boolean( $settings['general']['track_status'] ),
				'is_verified'                 => rest_sanitize_boolean( $settings['general']['is_verified'] ),
				'disable_folder_organization' => rest_sanitize_boolean( $settings['general']['disable_folder_organization'] ),
				'selected_brand_image'        => sanitize_text_field( $settings['general']['selected_brand_image'] ),
				'brand_color'                 => sanitize_hex_color( $settings['general']['brand_color'] ),
			),
		);

		return $sanitized_settings;
	}

	/**
	 * Fetch subscription plans from the external API.
	 *
	 * @return \WP_REST_Response
	 */
	public function fetch_subscription_plans() {
		$api_url = RTGODAM_API_BASE . '/api/resource/Subscription Plan?fields=["name", "cost", "bandwidth", "storage", "billing_interval"]';

		// Fetch data from the external API.
		$response = wp_remote_get( $api_url );

		if ( is_wp_error( $response ) ) {
			return new \WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => 'Failed to fetch subscription plans.',
				),
				500
			);
		}

		$body = wp_remote_retrieve_body( $response );
		$data = json_decode( $body, true );

		if ( json_last_error() !== JSON_ERROR_NONE ) {
			return new \WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => 'Invalid JSON response from the external API.',
				),
				500
			);
		}

		// Return the subscription plans.
		return new \WP_REST_Response(
			array(
				'status' => 'success',
				'data'   => $data['data'],
			),
			200
		);
	}
}
