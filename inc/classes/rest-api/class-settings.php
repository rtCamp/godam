<?php
/**
 * REST API class for Settings Pages.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\REST_API;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Post_Types\GoDAM_Video;
use RTGODAM\Inc\Enums\Api_Key_Status;
use RTGODAM\Inc\Enums\HTTP_Status_Code;
use RTGODAM\Inc\Helpers\Api_Key;

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
				'sync_from_godam'                => false,
				'adaptive_bitrate'               => false,
				'optimize_videos'                => false,
				'video_format'                   => 'auto',
				'video_compress_quality'         => 100,
				'video_thumbnails'               => 5,
				'watermark'                      => false,
				'watermark_text'                 => '',
				'watermark_url'                  => '',
				'watermark_image_id'             => null,
				'use_watermark_image'            => false,
				'enable_global_video_engagement' => true,
				'enable_global_video_share'      => true,
			),
			'general'      => array(
				'enable_folder_organization' => true,
				'enable_gtm_tracking'        => false,
				'enable_posthog_tracking'    => false,
				'posthog_initialized'        => false,
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
			'integrations' => array(
				'woocommerce' => array(
					'videoCloseBg'               => 'rgba(28, 28, 28, 0.4)',
					'videoCloseIcon'             => 'rgba(255, 255, 255, 1)',
					'videoCloseBorder'           => array(
						'width' => '0.59px',
						'style' => 'solid',
						'color' => 'rgba(224, 224, 224, 1)',
					),
					'videoCloseRadius'           => 45.13,

					'miniCartBg'                 => 'rgba(255, 255, 255, 1)',
					'miniCartIcon'               => 'rgba(28, 28, 28, 1)',
					'miniCartBorder'             => array(
						'width' => '1.38px',
						'style' => 'solid',
						'color' => 'rgba(224, 224, 224, 1)',
					),
					'miniCartRadius'             => 11,

					'addToCartFontSize'          => 14,
					'addToCartBgColor'           => 'rgba(28, 28, 28, 1)',
					'addToCartFontColor'         => 'rgba(255, 255, 255, 1)',
					'addToCartBorder'            => array(
						'width' => '1px',
						'style' => 'solid',
						'color' => 'rgba(28, 28, 28, 1)',
					),
					'addToCartRadius'            => 40,

					'toggleFontSize'             => 16,
					'toggleBgColor'              => 'rgba(0, 0, 0, 0.7)',
					'toggleFontColor'            => 'rgba(255, 255, 255, 1)',
					'toggleBorder'               => array(
						'width' => '0.59px',
						'style' => 'solid',
						'color' => 'rgba(224, 224, 224, 1)',
					),
					'toggleRadius'               => 8,

					'desktopModalBgColor'        => 'rgba(255, 255, 255, 1)',
					'desktopModalTextColor'      => 'rgba(28, 28, 28, 1)',
					'mobileModalBgColor'         => 'rgba(0, 0, 0, 0.7)',
					'mobileModalTextColor'       => 'rgba(255, 255, 255, 1)',

					'desktopPricePrimaryColor'   => 'rgba(28, 28, 28, 1)',
					'desktopPriceSecondaryColor' => 'rgba(230, 134, 0, 1)',
					'desktopPriceTertiaryColor'  => 'rgba(143, 143, 143, 1)',

					'mobilePricePrimaryColor'    => 'rgba(255, 255, 255, 1)',
					'mobilePriceSecondaryColor'  => 'rgba(230, 134, 0, 1)',
					'mobilePriceTertiaryColor'   => 'rgba(143, 143, 143, 1)',

					'galleryVideoPlayBtnWidth'   => '2.375rem',
					'carouselVideoPlayBtnWidth'  => '3.375rem',
					'playButtonBackgroundColor'  => '#000000C2',
					'playButtonColor'            => '#ffffff',
					'playButtonBorderRadius'     => '50%',

					'additionalComponentsColor'  => 'rgba(95, 95, 95, 1)',
				),
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
				'route'     => '/' . $this->rest_base . '/refresh-api-key-status',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'refresh_api_key_status' ),
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
					'callback'            => array( $this, 'get_easydam_settings' ),
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
					'callback'            => array( $this, 'update_easydam_settings' ),
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
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/get-godam-settings', // Route to share the WordPress site GoDAM settings with external service (Here GoDAM Central).
				'args'      => array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_easydam_settings' ),
					'permission_callback' => array( $this, 'verify_api_key_permission' ),
				),
			),
			array(
				'namespace' => $this->namespace,
				'route'     => '/' . $this->rest_base . '/welcome-complete',
				'args'      => array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'mark_welcome_complete' ),
					'permission_callback' => function () {
						return current_user_can( 'manage_options' );
					},
				),
			),
		);
	}

	/**
	 * Verify GoDAM Central permission using stored API key.
	 *
	 * @since 1.6.0
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return true|\WP_Error
	 */
	public function verify_api_key_permission( $request ) {
		$authorization_header = $request->get_header( 'authorization' );

		if ( null === $authorization_header ) {
			return new \WP_Error( 'api_key_required', __( 'GoDAM API key is required.', 'godam' ), array( 'status' => 403 ) );
		}

		$provided_api_key = trim( str_replace( 'Bearer ', '', $authorization_header ) );
		$stored_api_key   = get_option( 'rtgodam-api-key' );

		if ( empty( $provided_api_key ) ) {
			return new \WP_Error( 'api_key_required', __( 'GoDAM API key is required.', 'godam' ), array( 'status' => 403 ) );
		}

		if ( empty( $stored_api_key ) ) {
			return new \WP_Error( 'api_key_not_set', __( 'GoDAM API key is not set on this site.', 'godam' ), array( 'status' => 403 ) );
		}

		if ( ! hash_equals( $stored_api_key, $provided_api_key ) ) {
			return new \WP_Error( 'forbidden', __( 'Invalid API key.', 'godam' ), array( 'status' => 403 ) );
		}

		return true;
	}

	/**
	 * Mark the welcome walkthrough as completed.
	 *
	 * Persists the rtgodam_welcome_completed option for record-keeping and
	 * deletes the rtgodam_show_welcome option so the redirect no longer fires.
	 *
	 * @return \WP_REST_Response
	 */
	public function mark_welcome_complete() {
		update_option( 'rtgodam_welcome_completed', true );
		delete_option( 'rtgodam_show_welcome' );

		return new \WP_REST_Response(
			array( 'success' => true ),
			200
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
			$status_code = is_array( $error_data ) && isset( $error_data['status'] ) ? $error_data['status'] : HTTP_Status_Code::INTERNAL_SERVER_ERROR;

			// For 500 errors, return as warning instead of error to indicate temporary issue.
			$response_status = ( HTTP_Status_Code::INTERNAL_SERVER_ERROR === $status_code ) ? 'warning' : 'error';

			return new \WP_REST_Response(
				array(
					'status'  => $response_status,
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

		// Clear API key status and grace period timestamp.
		delete_option( 'rtgodam-api-key-status' );
		delete_option( 'rtgodam-api-key-error-since' );

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
	 * Refresh API key status by forcing verification.
	 *
	 * @return \WP_REST_Response
	 */
	public function refresh_api_key_status() {
		// Force refresh user data which will verify the API key.
		$user_data = rtgodam_get_user_data( false, HOUR_IN_SECONDS, true );

		if ( empty( $user_data ) ) {
			return new \WP_REST_Response(
				array(
					'status'  => 'error',
					'message' => __( 'Failed to refresh API key status.', 'godam' ),
				),
				500
			);
		}

		// Use the status from user_data which might include transient verification_failed.
		$api_key_status = isset( $user_data['api_key_status'] ) ? $user_data['api_key_status'] : rtgodam_get_api_key_status();
		$is_valid       = Api_Key_Status::VALID === $api_key_status;

		$status_messages = Api_Key_Status::get_all_messages();

		return new \WP_REST_Response(
			array(
				'status'         => $is_valid ? 'success' : 'error',
				'message'        => $status_messages[ $api_key_status ] ?? __( 'API key status refreshed.', 'godam' ),
				'api_key_status' => $api_key_status,
				'valid_api_key'  => $is_valid,
			),
			200
		);
	}

	/**
	 * Fetch the saved API key.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_api_key() {
		$api_key = Api_Key::get_key();

		return new \WP_REST_Response(
			array(
				'api_key' => $api_key,
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
		// Retrieve settings from the database.
		$easydam_settings = get_option( 'rtgodam-settings', array() );
		$default_settings = $this->get_default_settings();

		// Merge defaults with saved settings.
		$merged_settings = array_replace_recursive( $default_settings, $easydam_settings );

		return new \WP_REST_Response( $merged_settings, 200 );
	}

	/**
	 * Update the easydam settings.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response
	 */
	public function update_easydam_settings( $request ) {
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
				'message' => __( 'EasyDAM settings updated successfully!', 'godam' ),
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
		$default = $this->get_default_settings();

		return array(
			'video'        => array(
				'sync_from_godam'                => rest_sanitize_boolean( $settings['video']['sync_from_godam'] ?? $default['video']['sync_from_godam'] ),
				'adaptive_bitrate'               => rest_sanitize_boolean( $settings['video']['adaptive_bitrate'] ?? $default['video']['adaptive_bitrate'] ),
				'optimize_videos'                => rest_sanitize_boolean( $settings['video']['optimize_videos'] ?? $default['video']['optimize_videos'] ),
				'video_format'                   => sanitize_text_field( $settings['video']['video_format'] ?? $default['video']['video_format'] ),
				'video_compress_quality'         => intval( $settings['video']['video_compress_quality'] ?? $default['video']['video_compress_quality'] ),
				'video_thumbnails'               => intval( $settings['video']['video_thumbnails'] ?? $default['video']['video_thumbnails'] ),
				'watermark'                      => rest_sanitize_boolean( $settings['video']['watermark'] ?? $default['video']['watermark'] ),
				'watermark_text'                 => sanitize_text_field( $settings['video']['watermark_text'] ?? $default['video']['watermark_text'] ),
				'watermark_url'                  => esc_url_raw( $settings['video']['watermark_url'] ?? $default['video']['watermark_url'] ),
				'watermark_image_id'             => absint( $settings['video']['watermark_image_id'] ?? $default['video']['watermark_image_id'] ),
				'use_watermark_image'            => rest_sanitize_boolean( $settings['video']['use_watermark_image'] ?? $default['video']['use_watermark_image'] ),
				'enable_global_video_engagement' => rest_sanitize_boolean( $settings['video']['enable_global_video_engagement'] ?? $default['video']['enable_global_video_engagement'] ),
				'enable_global_video_share'      => rest_sanitize_boolean( $settings['video']['enable_global_video_share'] ?? $default['video']['enable_global_video_share'] ),
				'video_slug'                     => sanitize_title( $settings['video']['video_slug'] ?? $default['video']['video_slug'] ),
			),
			'general'      => array(
				'enable_folder_organization' => rest_sanitize_boolean( $settings['general']['enable_folder_organization'] ?? $default['general']['enable_folder_organization'] ),
				'enable_gtm_tracking'        => rest_sanitize_boolean( $settings['general']['enable_gtm_tracking'] ?? $default['general']['enable_gtm_tracking'] ),
				'enable_posthog_tracking'    => rest_sanitize_boolean( $settings['general']['enable_posthog_tracking'] ?? $default['general']['enable_posthog_tracking'] ),
				'posthog_initialized'        => rest_sanitize_boolean( $settings['general']['posthog_initialized'] ?? $default['general']['posthog_initialized'] ),
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
			'integrations' => array(
				'woocommerce' => array(
					'videoCloseBg'               => $this->sanitize_color_value( $settings['integrations']['woocommerce']['videoCloseBg'] ?? $default['integrations']['woocommerce']['videoCloseBg'] ),
					'videoCloseIcon'             => $this->sanitize_color_value( $settings['integrations']['woocommerce']['videoCloseIcon'] ?? $default['integrations']['woocommerce']['videoCloseIcon'] ),
					'videoCloseBorder'           => $this->sanitize_border( $settings['integrations']['woocommerce']['videoCloseBorder'] ?? $default['integrations']['woocommerce']['videoCloseBorder'], $default['integrations']['woocommerce']['videoCloseBorder'] ),
					'videoCloseRadius'           => floatval( $settings['integrations']['woocommerce']['videoCloseRadius'] ?? $default['integrations']['woocommerce']['videoCloseRadius'] ),

					'miniCartBg'                 => $this->sanitize_color_value( $settings['integrations']['woocommerce']['miniCartBg'] ?? $default['integrations']['woocommerce']['miniCartBg'] ),
					'miniCartIcon'               => $this->sanitize_color_value( $settings['integrations']['woocommerce']['miniCartIcon'] ?? $default['integrations']['woocommerce']['miniCartIcon'] ),
					'miniCartBorder'             => $this->sanitize_border( $settings['integrations']['woocommerce']['miniCartBorder'] ?? $default['integrations']['woocommerce']['miniCartBorder'], $default['integrations']['woocommerce']['miniCartBorder'] ),
					'miniCartRadius'             => floatval( $settings['integrations']['woocommerce']['miniCartRadius'] ?? $default['integrations']['woocommerce']['miniCartRadius'] ),

					'addToCartFontSize'          => absint( $settings['integrations']['woocommerce']['addToCartFontSize'] ?? $default['integrations']['woocommerce']['addToCartFontSize'] ),
					'addToCartBgColor'           => $this->sanitize_color_value( $settings['integrations']['woocommerce']['addToCartBgColor'] ?? $default['integrations']['woocommerce']['addToCartBgColor'] ),
					'addToCartFontColor'         => $this->sanitize_color_value( $settings['integrations']['woocommerce']['addToCartFontColor'] ?? $default['integrations']['woocommerce']['addToCartFontColor'] ),
					'addToCartBorder'            => $this->sanitize_border( $settings['integrations']['woocommerce']['addToCartBorder'] ?? $default['integrations']['woocommerce']['addToCartBorder'], $default['integrations']['woocommerce']['addToCartBorder'] ),
					'addToCartRadius'            => floatval( $settings['integrations']['woocommerce']['addToCartRadius'] ?? $default['integrations']['woocommerce']['addToCartRadius'] ),

					'toggleFontSize'             => absint( $settings['integrations']['woocommerce']['toggleFontSize'] ?? $default['integrations']['woocommerce']['toggleFontSize'] ),
					'toggleBgColor'              => $this->sanitize_color_value( $settings['integrations']['woocommerce']['toggleBgColor'] ?? $default['integrations']['woocommerce']['toggleBgColor'] ),
					'toggleFontColor'            => $this->sanitize_color_value( $settings['integrations']['woocommerce']['toggleFontColor'] ?? $default['integrations']['woocommerce']['toggleFontColor'] ),
					'toggleBorder'               => $this->sanitize_border( $settings['integrations']['woocommerce']['toggleBorder'] ?? $default['integrations']['woocommerce']['toggleBorder'], $default['integrations']['woocommerce']['toggleBorder'] ),
					'toggleRadius'               => floatval( $settings['integrations']['woocommerce']['toggleRadius'] ?? $default['integrations']['woocommerce']['toggleRadius'] ),

					'desktopModalBgColor'        => $this->sanitize_color_value( $settings['integrations']['woocommerce']['desktopModalBgColor'] ?? $default['integrations']['woocommerce']['desktopModalBgColor'] ),
					'desktopModalTextColor'      => $this->sanitize_color_value( $settings['integrations']['woocommerce']['desktopModalTextColor'] ?? $default['integrations']['woocommerce']['desktopModalTextColor'] ),
					'mobileModalBgColor'         => $this->sanitize_color_value( $settings['integrations']['woocommerce']['mobileModalBgColor'] ?? $default['integrations']['woocommerce']['mobileModalBgColor'] ),
					'mobileModalTextColor'       => $this->sanitize_color_value( $settings['integrations']['woocommerce']['mobileModalTextColor'] ?? $default['integrations']['woocommerce']['mobileModalTextColor'] ),

					'desktopPricePrimaryColor'   => $this->sanitize_color_value( $settings['integrations']['woocommerce']['desktopPricePrimaryColor'] ?? $default['integrations']['woocommerce']['desktopPricePrimaryColor'] ),
					'desktopPriceSecondaryColor' => $this->sanitize_color_value( $settings['integrations']['woocommerce']['desktopPriceSecondaryColor'] ?? $default['integrations']['woocommerce']['desktopPriceSecondaryColor'] ),
					'desktopPriceTertiaryColor'  => $this->sanitize_color_value( $settings['integrations']['woocommerce']['desktopPriceTertiaryColor'] ?? $default['integrations']['woocommerce']['desktopPriceTertiaryColor'] ),

					'mobilePricePrimaryColor'    => $this->sanitize_color_value( $settings['integrations']['woocommerce']['mobilePricePrimaryColor'] ?? $default['integrations']['woocommerce']['mobilePricePrimaryColor'] ),
					'mobilePriceSecondaryColor'  => $this->sanitize_color_value( $settings['integrations']['woocommerce']['mobilePriceSecondaryColor'] ?? $default['integrations']['woocommerce']['mobilePriceSecondaryColor'] ),
					'mobilePriceTertiaryColor'   => $this->sanitize_color_value( $settings['integrations']['woocommerce']['mobilePriceTertiaryColor'] ?? $default['integrations']['woocommerce']['mobilePriceTertiaryColor'] ),

					'galleryVideoPlayBtnWidth'   => $this->sanitize_css_size_value( $settings['integrations']['woocommerce']['galleryVideoPlayBtnWidth'] ?? $default['integrations']['woocommerce']['galleryVideoPlayBtnWidth'] ),
					'carouselVideoPlayBtnWidth'  => $this->sanitize_css_size_value( $settings['integrations']['woocommerce']['carouselVideoPlayBtnWidth'] ?? $default['integrations']['woocommerce']['carouselVideoPlayBtnWidth'] ),
					'playButtonBackgroundColor'  => $this->sanitize_color_value( $settings['integrations']['woocommerce']['playButtonBackgroundColor'] ?? $default['integrations']['woocommerce']['playButtonBackgroundColor'] ),
					'playButtonColor'            => $this->sanitize_color_value( $settings['integrations']['woocommerce']['playButtonColor'] ?? $default['integrations']['woocommerce']['playButtonColor'] ),
					'playButtonBorderRadius'     => $this->sanitize_percent_value( $settings['integrations']['woocommerce']['playButtonBorderRadius'] ?? $default['integrations']['woocommerce']['playButtonBorderRadius'] ),

					'additionalComponentsColor'  => $this->sanitize_color_value( $settings['integrations']['woocommerce']['additionalComponentsColor'] ?? $default['integrations']['woocommerce']['additionalComponentsColor'] ),
				),
			),
		);
	}

	/**
	 * Sanitize CSS size values for width-like settings.
	 *
	 * @param string $value CSS value.
	 * @return string
	 */
	private function sanitize_css_size_value( $value ) {
		$value = trim( (string) $value );

		if ( preg_match( '/^-?(?:\\d+|\\d*\\.\\d+)(px|rem|em|vw|vh|vmin|vmax|%)$/i', $value ) ) {
			return $value;
		}

		return '2.375rem';
	}

	/**
	 * Sanitize percentage value.
	 *
	 * @param string $value Percentage value.
	 * @return string
	 */
	private function sanitize_percent_value( $value ) {
		$value = trim( (string) $value );

		if ( preg_match( '/^(100|[1-9]?\\d)%$/', $value ) ) {
			return $value;
		}

		return '50%';
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

	/**
	 * Sanitizes a border configuration array.
	 *
	 * Ensures that the provided border values (color, style, width) are safe
	 * and properly formatted before being used or stored. If any value is
	 * missing, the corresponding default value is applied.
	 *
	 * @param array $border  Border settings array. Expected keys:
	 *                       - 'color' (string) Border color value.
	 *                       - 'style' (string) Border style (e.g., solid, dashed).
	 *                       - 'width' (string) Border width (e.g., 1px, 0.1rem).
	 * @param array $default_data Default border settings array used as fallback
	 *                            when a value is not provided.
	 *
	 * @return array Sanitized border array containing:
	 *               - 'color' (string) Sanitized color value.
	 *               - 'style' (string) Sanitized border style key.
	 *               - 'width' (string) Sanitized border width value.
	 */
	private function sanitize_border( $border, $default_data ) {
		return array(
			'color' => $this->sanitize_color_value( $border['color'] ?? $default_data['color'] ),
			'style' => sanitize_key( $border['style'] ?? $default_data['style'] ),
			'width' => sanitize_text_field( $border['width'] ?? $default_data['width'] ),
		);
	}
}
