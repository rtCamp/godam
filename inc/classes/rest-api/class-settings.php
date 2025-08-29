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
			'video'         => array(
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
			'general'       => array(
				'enable_folder_organization' => true,
			),
			'video_player'  => array(
				'brand_image'    => '',
				'brand_color'    => '#2B333FB3',
				'brand_image_id' => null,
				'custom_css'     => '',
				'player_skin'    => 'Default',
			),
			'ads_settings'  => array(
				'enable_global_video_ads' => false,
				'adTagUrl'                => '',
			),
			'global_layers' => array(
				'video_ads' => array(
					'enabled'  => false,
					'adTagUrl' => '',
				),
				'forms'     => array(
					'enabled'   => false,
					'plugin'    => '',
					'form_id'   => '',
					'placement' => 'end',
					'position'  => 30,
					'duration'  => 0,
				),
				'cta'       => array(
					'enabled'          => false,
					'text'             => '',
					'url'              => '',
					'new_tab'          => true,
					'placement'        => 'end',
					'position'         => 30,
					'screen_position'  => 'bottom-center',
					'duration'         => 10,
					'background_color' => '#0073aa',
					'text_color'       => '#ffffff',
					'font_size'        => 16,
					'border_radius'    => 4,
					'css_classes'      => '',
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
						// Allow users who can edit posts to view global settings (for video editor).
						return current_user_can( 'edit_posts' ) || current_user_can( 'manage_options' );
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
				'route'     => '/' . $this->rest_base . '/detect-form-plugins',
				'args'      => array(
					'methods'  => \WP_REST_Server::READABLE,
					'callback' => array( $this, 'detect_form_plugins' ),
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
	 * Fetch the EasyDAM settings.
	 *
	 * @return \WP_REST_Response
	 */
	public function get_easydam_settings() {
		// Retrieve settings from the database.
		$easydam_settings = get_option( 'rtgodam-settings', $this->get_default_settings() );

		return new \WP_REST_Response( $easydam_settings, 200 );
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
			'video'         => array(
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
			'general'       => array(
				'enable_folder_organization' => rest_sanitize_boolean( $settings['general']['enable_folder_organization'] ?? $default['general']['enable_folder_organization'] ),
			),
			'video_player'  => array(
				'brand_image'    => sanitize_text_field( $settings['video_player']['brand_image'] ?? $default['video_player']['brand_image'] ),
				'brand_color'    => $this->sanitize_color_value( $settings['video_player']['brand_color'] ?? $default['video_player']['brand_color'] ),
				'brand_image_id' => absint( $settings['video_player']['brand_image_id'] ?? $default['video_player']['brand_image_id'] ),
				'custom_css'     => sanitize_textarea_field( $settings['video_player']['custom_css'] ?? $default['video_player']['custom_css'] ),
				'player_skin'    => sanitize_text_field( $settings['video_player']['player_skin'] ?? $default['video_player']['player_skin'] ),
			),
			'ads_settings'  => array(
				'enable_global_video_ads' => rest_sanitize_boolean( $settings['ads_settings']['enable_global_video_ads'] ?? $default['ads_settings']['enable_global_video_ads'] ),
				'adTagUrl'                => esc_url_raw( $settings['ads_settings']['adTagUrl'] ?? $default['ads_settings']['adTagUrl'] ),
			),
			'global_layers' => array(
				'video_ads' => array(
					'enabled'  => rest_sanitize_boolean( $settings['global_layers']['video_ads']['enabled'] ?? $default['global_layers']['video_ads']['enabled'] ),
					'adTagUrl' => esc_url_raw( $settings['global_layers']['video_ads']['adTagUrl'] ?? $default['global_layers']['video_ads']['adTagUrl'] ),
				),
				'forms'     => array(
					'enabled'   => rest_sanitize_boolean( $settings['global_layers']['forms']['enabled'] ?? $default['global_layers']['forms']['enabled'] ),
					'plugin'    => sanitize_text_field( $settings['global_layers']['forms']['plugin'] ?? $default['global_layers']['forms']['plugin'] ),
					'form_id'   => sanitize_text_field( $settings['global_layers']['forms']['form_id'] ?? $default['global_layers']['forms']['form_id'] ),
					'placement' => sanitize_text_field( $settings['global_layers']['forms']['placement'] ?? $default['global_layers']['forms']['placement'] ),
					'position'  => absint( $settings['global_layers']['forms']['position'] ?? $default['global_layers']['forms']['position'] ),
					'duration'  => absint( $settings['global_layers']['forms']['duration'] ?? $default['global_layers']['forms']['duration'] ),
				),
				'cta'       => array(
					'enabled'          => rest_sanitize_boolean( $settings['global_layers']['cta']['enabled'] ?? $default['global_layers']['cta']['enabled'] ),
					'text'             => sanitize_text_field( $settings['global_layers']['cta']['text'] ?? $default['global_layers']['cta']['text'] ),
					'url'              => esc_url_raw( $settings['global_layers']['cta']['url'] ?? $default['global_layers']['cta']['url'] ),
					'new_tab'          => rest_sanitize_boolean( $settings['global_layers']['cta']['new_tab'] ?? $default['global_layers']['cta']['new_tab'] ),
					'placement'        => sanitize_text_field( $settings['global_layers']['cta']['placement'] ?? $default['global_layers']['cta']['placement'] ),
					'position'         => absint( $settings['global_layers']['cta']['position'] ?? $default['global_layers']['cta']['position'] ),
					'screen_position'  => sanitize_text_field( $settings['global_layers']['cta']['screen_position'] ?? $default['global_layers']['cta']['screen_position'] ),
					'duration'         => absint( $settings['global_layers']['cta']['duration'] ?? $default['global_layers']['cta']['duration'] ),
					'background_color' => $this->sanitize_color_value( $settings['global_layers']['cta']['background_color'] ?? $default['global_layers']['cta']['background_color'] ),
					'text_color'       => $this->sanitize_color_value( $settings['global_layers']['cta']['text_color'] ?? $default['global_layers']['cta']['text_color'] ),
					'font_size'        => absint( $settings['global_layers']['cta']['font_size'] ?? $default['global_layers']['cta']['font_size'] ),
					'border_radius'    => absint( $settings['global_layers']['cta']['border_radius'] ?? $default['global_layers']['cta']['border_radius'] ),
					'css_classes'      => sanitize_text_field( $settings['global_layers']['cta']['css_classes'] ?? $default['global_layers']['cta']['css_classes'] ),
				),
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

	/**
	 * Detect available form plugins and their forms.
	 *
	 * @param \WP_REST_Request $request REST API request.
	 * @return \WP_REST_Response
	 */
	public function detect_form_plugins( $request ) {
		$available_plugins = array();

		// Check for WPForms.
		if ( class_exists( 'WPForms' ) ) {
			$forms = get_posts(
				array(
					'post_type'      => 'wpforms',
					'posts_per_page' => -1,
					'post_status'    => 'publish',
				)
			);

			$wpforms_list = array();
			foreach ( $forms as $form ) {
				$wpforms_list[] = array(
					'id'    => $form->ID,
					'title' => $form->post_title,
				);
			}

			$available_plugins['wpforms'] = array(
				'name'  => 'WPForms',
				'forms' => $wpforms_list,
			);
		}

		// Check for Gravity Forms.
		if ( class_exists( 'GFForms' ) ) {
			$forms   = \GFAPI::get_forms();
			$gf_list = array();
			foreach ( $forms as $form ) {
				$gf_list[] = array(
					'id'    => $form['id'],
					'title' => $form['title'],
				);
			}

			$available_plugins['gravity_forms'] = array(
				'name'  => 'Gravity Forms',
				'forms' => $gf_list,
			);
		}

		// Check for Contact Form 7.
		if ( class_exists( 'WPCF7' ) ) {
			$forms = get_posts(
				array(
					'post_type'      => 'wpcf7_contact_form',
					'posts_per_page' => -1,
					'post_status'    => 'publish',
				)
			);

			$cf7_list = array();
			foreach ( $forms as $form ) {
				$cf7_list[] = array(
					'id'    => $form->ID,
					'title' => $form->post_title,
				);
			}

			$available_plugins['contact_form_7'] = array(
				'name'  => 'Contact Form 7',
				'forms' => $cf7_list,
			);
		}

		// Check for Forminator..
		if ( class_exists( 'Forminator' ) ) {
			$forms           = \Forminator_API::get_forms( null, 1, 999 );
			$forminator_list = array();
			if ( is_array( $forms ) ) {
				foreach ( $forms as $form ) {
					$forminator_list[] = array(
						'id'    => $form->id,
						'title' => $form->name,
					);
				}
			}

			$available_plugins['forminator'] = array(
				'name'  => 'Forminator',
				'forms' => $forminator_list,
			);
		}

		// Check for Fluent Forms.
		if ( function_exists( 'wpFluentForm' ) ) {
			$forms = wpFluent()->table( 'fluentform_forms' )
						->select( array( 'id', 'title' ) )
						->where( 'status', 'published' )
						->get();

			$ff_list = array();
			foreach ( $forms as $form ) {
				$ff_list[] = array(
					'id'    => $form->id,
					'title' => $form->title,
				);
			}

			$available_plugins['fluent_forms'] = array(
				'name'  => 'Fluent Forms',
				'forms' => $ff_list,
			);
		}

		// Check for Ninja Forms.
		if ( class_exists( 'Ninja_Forms' ) ) {
			$forms   = \Ninja_Forms()->form()->get_forms();
			$nf_list = array();
			foreach ( $forms as $form ) {
				$nf_list[] = array(
					'id'    => $form->get_id(),
					'title' => $form->get_setting( 'title' ),
				);
			}

			$available_plugins['ninja_forms'] = array(
				'name'  => 'Ninja Forms',
				'forms' => $nf_list,
			);
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $available_plugins,
			)
		);
	}
}
