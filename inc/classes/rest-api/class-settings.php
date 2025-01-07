<?php
/**
 * REST API class for Settings Pages.
 *
 * @package transcoder
 */

namespace Transcoder\Inc\REST_API;

use Transcoder\Inc\EasyDAM_Constants;
use Transcoder\Inc\Providers\Handlers\Storage_Handler;
use Transcoder\Inc\Providers\Exceptions\EasyDamException;
use Transcoder\Inc\Providers\Handlers\Error_Handler;

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
							'description'       => 'The license key to verify.',
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
				'route'     => '/' . $this->rest_base . '/aws',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_aws_settings' ),
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
					},
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/aws',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'update_aws_settings' ),
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
					},
					'args'                => array(
						'bucketPath'   => array(
							'type'              => 'string',
							'description'       => 'The bucket path to save.',
							'sanitize_callback' => 'sanitize_text_field',
						),
						'offLoadMedia' => array(
							'type'              => 'boolean',
							'description'       => 'The offload media to save.',
							'sanitize_callback' => 'rest_sanitize_boolean',
						),
						'aws'          => array(
							'type'        => 'object',
							'description' => 'AWS credentials and settings.',
							'properties'  => array(
								'accessKey' => array(
									'type'              => 'string',
									'description'       => 'The AWS access key.',
									'sanitize_callback' => 'sanitize_text_field',
								),
								'bucket'    => array(
									'type'              => 'string',
									'description'       => 'The AWS bucket name.',
									'sanitize_callback' => 'sanitize_text_field',
								),
								'secretKey' => array(
									'type'              => 'string',
									'description'       => 'The AWS secret key.',
									'sanitize_callback' => 'sanitize_text_field',
								),
							),
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/get-buckets',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_buckets' ),
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
					},
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/validate-credentials',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'test_credentials' ),
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
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

		$blacklist   = rtt_get_blacklist_ip_addresses();
		$remote_addr = rtt_get_remote_ip_address();

		if ( in_array( wp_unslash( $remote_addr ), $blacklist, true ) ) {
			return new \WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => 'Localhost not allowed.',
				),
				400
			);
		}

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

		// Use vip_safe_wp_remote_get as the primary method and wp_safe_remote_get as fallback.
		if ( function_exists( 'vip_safe_wp_remote_get' ) ) {
			$response = vip_safe_wp_remote_get( $api_url, 3, 3 ); // Timeout of 3 seconds, retries 3 times.
		} else {
			$response = wp_safe_remote_get( $api_url ); // phpcs:ignore WordPressVIPMinimum.Functions.RestrictedFunctions.wp_remote_get_wp_remote_get
		}

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
			update_site_option( 'rt-transcoding-api-key', $license_key );
			update_site_option( 'rt-transcoding-api-key-stored', $license_key );

			$handler = new \RT_Transcoder_Handler( false );
			$handler->update_usage( $license_key );

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
	 * Deactivate the license key.
	 *
	 * @return \WP_REST_Response
	 */
	public function deactivate_license() {
		// Delete the license key from the database.
		$deleted = delete_site_option( 'rt-transcoding-api-key' );

		if ( $deleted ) {
			return new \WP_REST_Response(
				array(
					'status'  => 'success',
					'message' => 'License key deactivated successfully.',
				),
				200
			);
		}

		return new \WP_REST_Response(
			array(
				'status'  => 'error',
				'message' => 'Failed to deactivate the license key. It might not exist.',
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
		$license_key = get_site_option( 'rt-transcoding-api-key', '' );

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
				'video_quality'        => '20',
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
				'track_status' => false,
				'is_verified'  => false,
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
			'video'   => array(
				'sync_from_easydam'    => rest_sanitize_boolean( $settings['video']['sync_from_easydam'] ),
				'adaptive_bitrate'     => rest_sanitize_boolean( $settings['video']['adaptive_bitrate'] ),
				'optimize_videos'      => rest_sanitize_boolean( $settings['video']['optimize_videos'] ),
				'video_format'         => sanitize_text_field( $settings['video']['video_format'] ),
				'video_quality'        => sanitize_text_field( $settings['video']['video_quality'] ),
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
				'track_status' => rest_sanitize_boolean( $settings['general']['track_status'] ),
				'is_verified'  => rest_sanitize_boolean( $settings['general']['is_verified'] ),
			),
		);

		return $sanitized_settings;
	}

	/**
	 * Update the AWS settings.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response
	 */
	public function get_aws_settings( $request ) {
		$settings = get_option( 'easydam_storage_aws' );
	
		// If settings are not found, return a default empty array.
		if ( false === $settings ) {
			$settings = array();
		}
	
		return new \WP_REST_Response( $settings, 200 );
	}

	/**
	 * Update AWS settings.
	 *
	 * @param array $data AWS settings to update.
	 *
	 * @return \WP_REST_Response
	 */
	public function update_aws_settings( $data ) {
		// Fetch existing settings from the database.
		$existing_settings = get_option(
			EasyDAM_Constants::S3_STORAGE_OPTIONS,
			array(
				'bucketPath'   => '',
				'offLoadMedia' => false,
				'aws'          => array(
					'accessKey' => '',
					'secretKey' => '',
					'bucket'    => '',
				),
			) 
		);

		// Merge existing settings with new data, ensuring only updated values are replaced.
		$updated_settings = array_merge(
			$existing_settings,
			array_filter(
				array(
					'bucketPath'   => $data['bucketPath'] ?? null,
					'offLoadMedia' => $data['offLoadMedia'] ?? null,
					'aws'          => isset( $data['aws'] ) && is_array( $data['aws'] )
						? array_merge( $existing_settings['aws'], $data['aws'] )
						: null,
				),
				function ( $value ) {
					return null !== $value;
				}
			)
		);

		// Update the option in the database.
		update_option( EasyDAM_Constants::S3_STORAGE_OPTIONS, $updated_settings );

		return new \WP_REST_Response(
			array(
				'status'  => 'success',
				'message' => 'AWS settings updated successfully!',
			),
			200
		);
	}

	/**
	 * Get the list of buckets.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_buckets() {

		try {
			$buckets = Storage_Handler::get_buckets();
			return new \WP_REST_Response( $buckets, 200 );

		} catch ( EasyDamException $e ) {
			return Error_Handler::handle_exception( $e, true );
		}
	}

	/**
	 * Test the credentials.
	 * 
	 * Test the credentials for the storage provider.
	 *
	 * @return \WP_REST_Response
	 */
	public function test_credentials() {

		try {
			Storage_Handler::check_credentials();
			
			$response = array(
				'status'  => 'success',
				'message' => 'Credentials are valid and can write storage.',
			);

			return new \WP_REST_Response( $response, 200 );

		} catch ( EasyDamException $e ) {
			return Error_Handler::handle_exception( $e, true );
		}
	}
}
