<?php
/**
 * Abilities for site-wide GoDAM settings.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc\Abilities;

defined( 'ABSPATH' ) || exit;

/**
 * Class Site_Settings_Abilities
 *
 * A curated set of the settings on GoDAM's Settings page: global video ads
 * and what players do when they leave the visitor's view. Both go through the
 * same settings route the Settings page saves with.
 *
 * That route rebuilds the whole settings object from what it is sent and
 * fills anything missing with its default, so an update reads the current
 * settings, changes only the curated keys and sends everything back. Every
 * other setting stays as it was.
 *
 * @since n.e.x.t
 */
class Site_Settings_Abilities extends Ability_Group {

	/**
	 * The settings route.
	 *
	 * @since n.e.x.t
	 *
	 * @var string
	 */
	const ROUTE = '/godam/v1/settings/godam-settings';

	/**
	 * What a player does when it leaves the visitor's view, as the Settings
	 * page offers it.
	 *
	 * @since n.e.x.t
	 *
	 * @var string[]
	 */
	const OUT_OF_VIEW = array( 'off', 'autoplay', 'pause', 'mute' );

	/**
	 * Registers this group's abilities.
	 *
	 * @since n.e.x.t
	 *
	 * @return void
	 */
	public function register() {
		$this->add(
			'godam/get-site-settings',
			array(
				'label'               => __( 'Get site settings', 'godam' ),
				'description'         => __( 'Site-wide GoDAM player settings: whether global video ads are on and their ad tag, and what players do by default when they scroll out of view.', 'godam' ),
				'category'            => 'godam-settings',
				'output_schema'       => $this->settings_schema(),
				'execute_callback'    => array( $this, 'get_site_settings' ),
				'permission_callback' => array( $this, 'can_manage_settings' ),
			)
		);

		$this->add(
			'godam/update-site-settings',
			array(
				'label'               => __( 'Update site settings', 'godam' ),
				'description'         => __( 'Change site-wide GoDAM player settings. global_ads_enabled with ad_tag_url shows a VAST ad on every GoDAM video; global ads need an ad tag to play. out_of_view_behavior is the default for players: off (do nothing), autoplay (pause autoplaying videos only), pause (pause all videos) or mute (keep playing, muted); a video block can override it. Only the settings given are changed.', 'godam' ),
				'category'            => 'godam-settings',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'global_ads_enabled'   => array( 'type' => 'boolean' ),
						'ad_tag_url'           => array(
							'type'        => 'string',
							'description' => __( 'VAST ad tag URL for global ads. An empty string clears it.', 'godam' ),
						),
						'out_of_view_behavior' => array(
							'type' => 'string',
							'enum' => self::OUT_OF_VIEW,
						),
					),
				),
				'output_schema'       => $this->settings_schema(),
				'execute_callback'    => array( $this, 'update_site_settings' ),
				'permission_callback' => array( $this, 'can_manage_settings' ),
				'meta'                => array(
					'annotations' => array( 'idempotent' => true ),
				),
			),
			true
		);
	}

	/**
	 * JSON Schema for the settings both abilities return.
	 *
	 * @since n.e.x.t
	 *
	 * @return array
	 */
	private function settings_schema() {
		return array(
			'type'       => 'object',
			'properties' => array(
				'global_ads_enabled'   => array( 'type' => 'boolean' ),
				'ad_tag_url'           => array( 'type' => 'string' ),
				'global_ads_active'    => array(
					'type'        => 'boolean',
					'description' => 'Whether players actually request global ads: enabled and an ad tag is set.',
				),
				'out_of_view_behavior' => array(
					'type' => 'string',
					'enum' => self::OUT_OF_VIEW,
				),
			),
		);
	}

	/**
	 * Permission: matches the settings route, which only administrators use.
	 *
	 * @since n.e.x.t
	 *
	 * @return bool
	 */
	public function can_manage_settings() {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Executes godam/get-site-settings.
	 *
	 * @since n.e.x.t
	 *
	 * @return array|\WP_Error
	 */
	public function get_site_settings() {
		$settings = $this->rest( 'GET', self::ROUTE );

		return is_wp_error( $settings ) ? $settings : $this->describe( $settings );
	}

	/**
	 * Executes godam/update-site-settings.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $input Ability input.
	 *
	 * @return array|\WP_Error
	 */
	public function update_site_settings( $input = array() ) {
		$input = (array) $input;

		if ( ! array_intersect_key( $input, array_flip( array( 'global_ads_enabled', 'ad_tag_url', 'out_of_view_behavior' ) ) ) ) {
			return new \WP_Error( 'rtgodam_nothing_to_update', __( 'Give at least one of global_ads_enabled, ad_tag_url or out_of_view_behavior.', 'godam' ), array( 'status' => 400 ) );
		}

		$settings = $this->rest( 'GET', self::ROUTE );

		if ( is_wp_error( $settings ) ) {
			return $settings;
		}

		if ( isset( $input['ad_tag_url'] ) ) {
			$url = trim( (string) $input['ad_tag_url'] );

			if ( '' !== $url && '' === esc_url_raw( $url, array( 'http', 'https' ) ) ) {
				return new \WP_Error( 'rtgodam_invalid_ad_tag_url', __( 'ad_tag_url must be an http or https URL, or an empty string.', 'godam' ), array( 'status' => 400 ) );
			}

			$settings['ads_settings']['adTagUrl'] = $url;
		}

		if ( isset( $input['global_ads_enabled'] ) ) {
			$settings['ads_settings']['enable_global_video_ads'] = (bool) $input['global_ads_enabled'];
		}

		if ( isset( $input['out_of_view_behavior'] ) ) {
			$settings['video_player']['out_of_view_behavior'] = $input['out_of_view_behavior'];
		}

		$saved = $this->rest( 'POST', self::ROUTE, array( 'settings' => $settings ) );

		if ( is_wp_error( $saved ) ) {
			return $saved;
		}

		$result = $this->get_site_settings();

		if ( ! is_wp_error( $result ) && $result['global_ads_enabled'] && ! $result['global_ads_active'] ) {
			$result['note'] = __( 'Global ads are on but have no ad tag, so no ads will play until ad_tag_url is set.', 'godam' );
		}

		return $result;
	}

	/**
	 * The curated settings from the route's full settings object.
	 *
	 * @since n.e.x.t
	 *
	 * @param array $settings Settings as the route returns them.
	 *
	 * @return array
	 */
	private function describe( array $settings ) {
		$enabled = ! empty( $settings['ads_settings']['enable_global_video_ads'] );
		$tag     = (string) ( $settings['ads_settings']['adTagUrl'] ?? '' );

		return array(
			'global_ads_enabled'   => $enabled,
			'ad_tag_url'           => $tag,
			// The player's own test for showing global ads.
			'global_ads_active'    => $enabled && '' !== $tag,
			'out_of_view_behavior' => rtgodam_sanitize_out_of_view_behavior( $settings['video_player']['out_of_view_behavior'] ?? 'off' ),
		);
	}
}
