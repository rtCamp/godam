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
					'enabled'             => false,
					'cta_type'            => 'text',
					'placement'           => 'end',
					// Text CTA setting.
					'text'                => '',
					// Image CTA setting.
					'image'               => 0,
					'imageText'           => '',
					'imageDescription'    => '',
					'imageLink'           => '',
					'imageCtaButtonText'  => '',
					'imageCtaButtonColor' => '#eeab95',
					'imageCtaOrientation' => 'landscape',
					'imageOpacity'        => 1,
					// HTML CTA setting.
					'html'                => '',
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
				),
				'cta'       => array(
					'enabled'             => rest_sanitize_boolean( $settings['global_layers']['cta']['enabled'] ?? $default['global_layers']['cta']['enabled'] ),
					'cta_type'            => sanitize_text_field( $settings['global_layers']['cta']['cta_type'] ?? $default['global_layers']['cta']['cta_type'] ),
					'placement'           => sanitize_text_field( $settings['global_layers']['cta']['placement'] ?? $default['global_layers']['cta']['placement'] ),
					// Text CTA setting.
					'text'                => wp_kses_post( $settings['global_layers']['cta']['text'] ?? $default['global_layers']['cta']['text'] ),
					// Image CTA setting.
					'image'               => absint( $settings['global_layers']['cta']['image'] ?? $default['global_layers']['cta']['image'] ),
					'imageText'           => sanitize_text_field( $settings['global_layers']['cta']['imageText'] ?? $default['global_layers']['cta']['imageText'] ),
					'imageDescription'    => sanitize_textarea_field( $settings['global_layers']['cta']['imageDescription'] ?? $default['global_layers']['cta']['imageDescription'] ),
					'imageLink'           => esc_url_raw( $settings['global_layers']['cta']['imageLink'] ?? $default['global_layers']['cta']['imageLink'] ),
					'imageCtaButtonText'  => sanitize_text_field( $settings['global_layers']['cta']['imageCtaButtonText'] ?? $default['global_layers']['cta']['imageCtaButtonText'] ),
					'imageCtaButtonColor' => $this->sanitize_color_value( $settings['global_layers']['cta']['imageCtaButtonColor'] ?? $default['global_layers']['cta']['imageCtaButtonColor'] ),
					'imageCtaOrientation' => sanitize_text_field( $settings['global_layers']['cta']['imageCtaOrientation'] ?? $default['global_layers']['cta']['imageCtaOrientation'] ),
					'imageOpacity'        => floatval( $settings['global_layers']['cta']['imageOpacity'] ?? $default['global_layers']['cta']['imageOpacity'] ),
					// HTML CTA setting.
					'html'                => wp_kses_post( $settings['global_layers']['cta']['html'] ?? $default['global_layers']['cta']['html'] ),
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

		// TODO: these are all duplicate methods, but the implementation is not consistent, so figure out how to unify them.
		$gravity_forms = $this->get_gravity_forms_data();
		if ( $gravity_forms ) {
			$available_plugins['gravity_forms'] = $gravity_forms;
		}

		$wpforms = $this->get_wpforms_data();
		if ( $wpforms ) {
			$available_plugins['wpforms'] = $wpforms;
		}

		$contact_form_7 = $this->get_contact_form_7_data();
		if ( $contact_form_7 ) {
			$available_plugins['contact_form_7'] = $contact_form_7;
		}

		$sure_forms = $this->get_sureforms_data();
		if ( $sure_forms ) {
			$available_plugins['sure_forms'] = $sure_forms;
		}

		$forminator = $this->get_forminator_data();
		if ( $forminator ) {
			$available_plugins['forminator'] = $forminator;
		}

		$everest_forms = $this->get_everest_forms_data();
		if ( $everest_forms ) {
			$available_plugins['everest_forms'] = $everest_forms;
		}

		$fluent_forms = $this->get_fluent_forms_data();
		if ( $fluent_forms ) {
			$available_plugins['fluent_forms'] = $fluent_forms;
		}

		$ninja_forms = $this->get_ninja_forms_data();
		if ( $ninja_forms ) {
			$available_plugins['ninja_forms'] = $ninja_forms;
		}

		$met_forms = $this->get_metforms_data();
		if ( $met_forms ) {
			$available_plugins['metform'] = $met_forms;
		}

		return rest_ensure_response(
			array(
				'success' => true,
				'data'    => $available_plugins,
			)
		);
	}

	/**
	 * Get WPForms data if available.
	 *
	 * @return array|null
	 */
	private function get_wpforms_data() {
		if ( ! class_exists( 'WPForms' ) ) {
			return null;
		}

		$paged    = 1;
		$per_page = 50;
		$forms    = array();

		do {
			$query = new \WP_Query(
				array(
					'post_type'      => 'wpforms',
					'posts_per_page' => $per_page,
					'paged'          => $paged,
					'post_status'    => 'publish',
				)
			);

			if ( ! empty( $query->posts ) ) {
				$forms = array_merge( $forms, $query->posts );
				++$paged;
			} else {
				break;
			}
		} while ( true );

		$wpforms_list = array();
		foreach ( $forms as $form ) {
			$wpforms_list[] = array(
				'id'    => $form->ID,
				'title' => $form->post_title,
			);
		}

		return array(
			'name'  => 'WPForms',
			'forms' => $wpforms_list,
		);
	}

	/**
	 * Get Gravity Forms data if available.
	 *
	 * @return array|null
	 */
	private function get_gravity_forms_data() {
		if ( ! class_exists( 'GFForms' ) ) {
			return null;
		}

		$forms   = \GFAPI::get_forms();
		$gf_list = array();
		foreach ( $forms as $form ) {
			$gf_list[] = array(
				'id'    => $form['id'],
				'title' => $form['title'],
			);
		}

		return array(
			'name'  => 'Gravity Forms',
			'forms' => $gf_list,
		);
	}

	/**
	 * Get Contact Form 7 data if available.
	 *
	 * @return array|null
	 */
	private function get_contact_form_7_data() {
		if ( ! class_exists( 'WPCF7' ) ) {
			return null;
		}

		$paged    = 1;
		$per_page = 50;
		$forms    = array();

		do {
			$query = new \WP_Query(
				array(
					'post_type'      => 'wpcf7_contact_form',
					'posts_per_page' => $per_page,
					'paged'          => $paged,
					'post_status'    => 'publish',
				)
			);

			if ( ! empty( $query->posts ) ) {
				$forms = array_merge( $forms, $query->posts );
				++$paged;
			} else {
				break;
			}
		} while ( true );

		$cf7_list = array();
		foreach ( $forms as $form ) {
			$cf7_list[] = array(
				'id'    => $form->ID,
				'title' => $form->post_title,
			);
		}

		return array(
			'name'  => 'Contact Form 7',
			'forms' => $cf7_list,
		);
	}

	/**
	 * Get Forminator data if available.
	 *
	 * @return array|null
	 */
	private function get_forminator_data() {
		if ( ! class_exists( 'Forminator' ) ) {
			return null;
		}

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

		return array(
			'name'  => 'Forminator',
			'forms' => $forminator_list,
		);
	}

	/**
	 * Get Fluent Forms data if available.
	 *
	 * @return array|null
	 */
	private function get_fluent_forms_data() {
		if ( ! function_exists( 'wpFluentForm' ) ) {
			return null;
		}

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

		return array(
			'name'  => 'Fluent Forms',
			'forms' => $ff_list,
		);
	}

	/**
	 * Get Ninja Forms data if available.
	 *
	 * @return array|null
	 */
	private function get_ninja_forms_data() {
		if ( ! class_exists( 'Ninja_Forms' ) ) {
			return null;
		}

		$forms   = \Ninja_Forms()->form()->get_forms();
		$nf_list = array();
		foreach ( $forms as $form ) {
			$nf_list[] = array(
				'id'    => $form->get_id(),
				'title' => $form->get_setting( 'title' ),
			);
		}

		return array(
			'name'  => 'Ninja Forms',
			'forms' => $nf_list,
		);
	}

	/**
	 * Get all Sure Forms.
	 *
	 * @return array|null
	 */
	private function get_sureforms_data() {

		$paged    = 1;
		$per_page = 50;
		$forms    = array();

		do {
			$query = new \WP_Query(
				array(
					'post_type'      => 'sureforms_form',
					'posts_per_page' => $per_page,
					'paged'          => $paged,
					'post_status'    => 'publish',
				)
			);

			if ( ! empty( $query->posts ) ) {
				$forms = array_merge( $forms, $query->posts );
				++$paged;
			} else {
				break;
			}
		} while ( true );

		$sure_forms = array();

		foreach ( $forms as $form ) {
			$sure_forms[] = array(
				'id'    => $form->ID,
				'title' => $form->post_title,
			);
		}

		return array(
			'name'  => 'Sure Forms',
			'forms' => $sure_forms,
		);
	}

	/**
	 * Get all Everest Forms.
	 *
	 * @return array|null
	 */
	private function get_everest_forms_data() {

		$paged    = 1;
		$per_page = 50;
		$forms    = array();

		while ( true ) {
			$query = new \WP_Query(
				array(
					'post_type'      => 'everest_form',
					'posts_per_page' => $per_page,
					'paged'          => $paged,
					'post_status'    => 'publish',
				)
			);

			if ( ! empty( $query->posts ) ) {
				$forms = array_merge( $forms, $query->posts );
				++$paged;
			} else {
				break;
			}
		}

		$formatted_forms = array();

		if ( ! empty( $forms ) && ! is_wp_error( $forms ) ) {
			$formatted_forms = array_map(
				function ( $form ) {
					return array(
						'id'    => $form->ID,
						'title' => $form->post_title,
					);
				},
				$forms
			);
		}

		return array(
			'name'  => 'Everest Forms',
			'forms' => $formatted_forms,
		);
	}

	/**
	 * Get all Metforms.
	 *
	 * @return array|null
	 */
	private function get_metforms_data() {

		$paged    = 1;
		$per_page = 50;
		$forms    = array();

		do {
			$query = new \WP_Query(
				array(
					'post_type'      => 'metform-form',
					'posts_per_page' => $per_page,
					'paged'          => $paged,
					'post_status'    => 'publish',
				)
			);

			if ( ! empty( $query->posts ) ) {
				$forms = array_merge( $forms, $query->posts );
				++$paged;
			} else {
				break;
			}
		} while ( true );

		$met_forms = array();

		foreach ( $forms as $form ) {
			$met_forms[] = array(
				'id'    => $form->ID,
				'title' => $form->post_title,
			);
		}

		return array(
			'name'  => 'Metforms',
			'forms' => $met_forms,
		);
	}
}
