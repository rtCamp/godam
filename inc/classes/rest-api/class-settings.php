<?php
/**
 * REST API class for Settings Pages.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Post_Types\GoDAM_Video;

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
		 * Default settings structure.
		 *
		 * @return array
		 */
	private function get_default_settings() {
		return array(
			'video'        => array(
				'sync_from_godam'        => false,
				'adaptive_bitrate'       => false,
				'optimize_videos'        => false,
				'video_format'           => 'auto',
				'video_compress_quality' => 100,
				'video_thumbnails'       => 5,
				'overwrite_thumbnails'   => false,
				'watermark'              => false,
				'watermark_text'         => '',
				'watermark_url'          => '',
				'watermark_image_id'     => null,
				'use_watermark_image'    => false,
			),
			'general'      => array(
				'enable_folder_organization' => true,
				'enable_gtm_tracking'        => false,
			),
			'video_player' => array(
				'brand_image'    => '',
				'brand_color'    => '#2B333FB3',
				'brand_image_id' => null,
				'custom_css'     => '',
				'player_skin'    => 'Default',
			),
			'ads_settings' => array(
				'enable_global_video_ads' => false,
				'adTagUrl'                => '',
			),
		);
	}

	/**
	 * Register custom REST API routes for Settings Pages.
	 *
	 * @return array Array of registered REST API routes
	 */
	public function get_rest_routes() {
		return array(
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/verify-api-key',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'verify_api_key' ),
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
					},
					'args'                => array(
						'api_key' => array(
							'required'          => true,
							'type'              => 'string',
							'description'       => __( 'The API key to verify.', 'godam' ),
							'sanitize_callback' => 'sanitize_text_field',
						),
					),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/deactivate-api-key',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'deactivate_api_key' ),
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
					},
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/get-api-key',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_api_key' ),
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
					},
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/godam-settings',
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_godam_settings' ),
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
					},
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/godam-settings',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'update_godam_settings' ),
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
					},
					'args'                => array(
						'settings' => array(
							'required'          => true,
							'type'              => 'object',
							'description'       => __( 'The godam settings to save.', 'godam' ),
							'sanitize_callback' => array( $this, 'sanitize_settings' ),
						),
					),
				),
			),
		);
	}

	/**
	 * Verify the API key using external API.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response
	 */
	public function verify_api_key( $request ) {
		$api_key = $request->get_param( 'api_key' );

		// Use the helper function to verify the API key.
		$result = rtgodam_verify_api_key( $api_key, true );

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

		if ( ! empty( $result['data']['api_key'] ) ) {
			$result['data']['api_key'] = rtgodam_mask_string( $result['data']['api_key'] );
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
	 * Deactivate the API key.
	 *
	 * @return \WP_REST_Response
	 */
	public function deactivate_api_key() {
		// Delete the API key from the database.
		$deleted_key   = delete_option( 'rtgodam-api-key' );
		$deleted_token = delete_option( 'rtgodam-account-token' );

		// Delete the user data from the site_option.
		delete_option( 'rtgodam_user_data' );

		if ( $deleted_key || $deleted_token ) {
			return new \WP_REST_Response(
				array(
					'status'  => 'success',
					'message' => __( 'API key deactivated successfully.', 'godam' ),
				),
				200
			);
		}

		return new \WP_REST_Response(
			array(
				'status'  => 'error',
				'message' => __( 'Failed to deactivate the API key. It might not exist.', 'godam' ),
			),
			400
		);
	}

	/**
	 * Fetch the saved API key.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_api_key() {
		$api_key = get_option( 'rtgodam-api-key', '' );

		return new \WP_REST_Response(
			array(
				'api_key' => $api_key,
			),
			200
		);
	}

	/**
	 * Fetch the godam settings.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_godam_settings() {
		// Retrieve settings from the database.
		godam_settings = get_option( 'rtgodam-settings', $this->get_default_settings() );
		
		return new \WP_REST_Response( godam_settings, 200 );
	}

	/**
	 * Update the godam settings.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response
	 */
	public function update_godam_settings( $request ) {
		$new_settings = $request->get_param( 'settings' );

		// Retrieve existing settings.
		$existing_settings = get_option( 'rtgodam-settings', array() );

		// Ensure it's an array (in case get_option returns false).
		if ( ! is_array( $existing_settings ) ) {
			$existing_settings = array();
		}

		// Merge the new settings with the existing ones.
		$updated_settings = array_replace_recursive( $existing_settings, $new_settings );

		// Save updated settings to the database.
		update_option( 'rtgodam-settings', $updated_settings );

		return new \WP_REST_Response(
			array(
				'status'  => 'success',
				'message' => __( 'godam settings updated successfully!', 'godam' ),
			),
			200
		);
	}

	/**
	 * Sanitize godam settings.
	 *
	 * @param array $settings godam settings to sanitize.
	 * @return array
	 */
	public function sanitize_settings( $settings ) {
		$default = $this->get_default_settings();

		return array(
			'video'        => array(
				'sync_from_godam'        => rest_sanitize_boolean( $settings['video']['sync_from_godam'] ?? $default['video']['sync_from_godam'] ),
				'adaptive_bitrate'       => rest_sanitize_boolean( $settings['video']['adaptive_bitrate'] ?? $default['video']['adaptive_bitrate'] ),
				'optimize_videos'        => rest_sanitize_boolean( $settings['video']['optimize_videos'] ?? $default['video']['optimize_videos'] ),
				'video_format'           => sanitize_text_field( $settings['video']['video_format'] ?? $default['video']['video_format'] ),
				'video_compress_quality' => intval( $settings['video']['video_compress_quality'] ?? $default['video']['video_compress_quality'] ),
				'video_thumbnails'       => intval( $settings['video']['video_thumbnails'] ?? $default['video']['video_thumbnails'] ),
				'overwrite_thumbnails'   => rest_sanitize_boolean( $settings['video']['overwrite_thumbnails'] ?? $default['video']['overwrite_thumbnails'] ),
				'watermark'              => rest_sanitize_boolean( $settings['video']['watermark'] ?? $default['video']['watermark'] ),
				'watermark_text'         => sanitize_text_field( $settings['video']['watermark_text'] ?? $default['video']['watermark_text'] ),
				'watermark_url'          => esc_url_raw( $settings['video']['watermark_url'] ?? $default['video']['watermark_url'] ),
				'watermark_image_id'     => absint( $settings['video']['watermark_image_id'] ?? $default['video']['watermark_image_id'] ),
				'use_watermark_image'    => rest_sanitize_boolean( $settings['video']['use_watermark_image'] ?? $default['video']['use_watermark_image'] ),
				'video_slug'             => sanitize_title( $settings['video']['video_slug'] ?? $default['video']['video_slug'] ),
			),
			'general'      => array(
				'enable_folder_organization' => rest_sanitize_boolean( $settings['general']['enable_folder_organization'] ?? $default['general']['enable_folder_organization'] ),
				'enable_gtm_tracking'        => rest_sanitize_boolean( $settings['general']['enable_gtm_tracking'] ?? $default['general']['enable_gtm_tracking'] ),
			),
			'video_player' => array(
				'brand_image'    => sanitize_text_field( $settings['video_player']['brand_image'] ?? $default['video_player']['brand_image'] ),
				'brand_color'    => $this->sanitize_color_value( $settings['video_player']['brand_color'] ?? $default['video_player']['brand_color'] ),
				'brand_image_id' => absint( $settings['video_player']['brand_image_id'] ?? $default['video_player']['brand_image_id'] ),
				'custom_css'     => sanitize_textarea_field( $settings['video_player']['custom_css'] ?? $default['video_player']['custom_css'] ),
				'player_skin'    => sanitize_text_field( $settings['video_player']['player_skin'] ?? $default['video_player']['player_skin'] ),
			),
			'ads_settings' => array(
				'enable_global_video_ads' => rest_sanitize_boolean( $settings['ads_settings']['enable_global_video_ads'] ?? $default['ads_settings']['enable_global_video_ads'] ),
				'adTagUrl'                => esc_url_raw( $settings['ads_settings']['adTagUrl'] ?? $default['ads_settings']['adTagUrl'] ),
			),
		);
	}

	/**
	 * Sanitize color value to handle both hex and rgba colors.
	 *
	 * @param string $color The color value to sanitize.
	 * @return string
	 */
	private function sanitize_color_value( $color ) {
		if ( empty( $color ) ) {
			return '';
		}
		
		// Handle hex colors (3, 6, or 8 characters with alpha).
		if ( preg_match( '/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/', $color ) ) {
			return $color;
		}

		// Handle rgba colors.
		if ( preg_match( '/^rgba?\([^)]+\)$/', $color ) ) {
			return $color;
		}

		// Handle named colors or other formats.
		if ( preg_match( '/^[a-zA-Z]+$/', $color ) ) {
			return $color;
		}

		// If none of the above, return empty string.
		return '';
	}
}
