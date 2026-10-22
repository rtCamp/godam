<?php
/**
 * HubSpot integration.
 *
 * Adds a HubSpot integration to GoDAM so that HubSpot forms can be rendered
 * inside video layers. HubSpot can be connected two ways, and the admin picks
 * one on the Settings → Integrations → HubSpot tab:
 *
 *  - `central`: GoDAM Central (godam-core). The connection (OAuth) is made on
 *    Central; the plugin reads the account details (portal ID + region) from the
 *    `map` block of the cached `verify_api_key` response, lists forms through
 *    Central, and renders the form with HubSpot's own forms v2 script. This is
 *    the recommended source and the one that later enables video-view tracking.
 *  - `leadin`: the "HubSpot All-In-One Marketing" (leadin) WordPress plugin.
 *    The plugin owns the connection; GoDAM reads its options, lists forms through
 *    its access-token endpoint and renders through its `[hubspot]` shortcode.
 *
 * The per-layer HubSpot Form ID (GUID) is picked (or typed) in the video editor
 * and is the same whichever source is active — only where the account details,
 * form list and rendering come from differs.
 *
 * @since 2.5.0
 * @package GoDAM
 */

namespace RTGODAM\Inc;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Hubspot
 *
 * @since 2.5.0
 */
class Hubspot {

	use Singleton;

	/**
	 * Option key that stores all GoDAM settings.
	 *
	 * @var string
	 */
	const SETTINGS_OPTION = 'rtgodam-settings';

	/**
	 * Path to GoDAM Central's Third Party Apps settings page.
	 *
	 * Where HubSpot is connected, disconnected and the "Track video views" switch
	 * lives — actions the plugin cannot perform, so the tab links out to Central.
	 *
	 * @var string
	 */
	const CENTRAL_SETTINGS_PATH = '/web/settings?setTab=ThirdPartyApps';

	/**
	 * Default HubSpot region (data centre) when none is known.
	 *
	 * @var string
	 */
	const DEFAULT_REGION = 'na1';

	/**
	 * Default HubSpot integration settings.
	 *
	 * No credentials: a Central connection is made on Central (OAuth) and the
	 * leadin plugin owns its own. `source` is the admin's chosen connection
	 * method; `central` (recommended) by default.
	 *
	 * @return array
	 */
	public static function get_default_settings() {
		return array(
			'enable' => true,
			'source' => 'central',
		);
	}

	/**
	 * Constructor.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Register hooks.
	 *
	 * The GoDAM settings REST controller stores and sanitizes the `integrations`
	 * category entirely through filters, so HubSpot plugs its fields in here.
	 *
	 * @return void
	 */
	public function setup_hooks() {
		add_filter( 'godam_default_integration_settings', array( $this, 'add_default_integration_settings' ) );
		add_filter( 'godam_sanitize_integration_settings', array( $this, 'sanitize_integration_settings' ), 10, 3 );
	}

	/**
	 * Merge HubSpot defaults into the integrations settings defaults.
	 *
	 * @param array $integrations Existing integration defaults (from other integrations).
	 * @return array
	 */
	public function add_default_integration_settings( $integrations ) {
		if ( ! is_array( $integrations ) ) {
			$integrations = array();
		}

		$integrations['hubspot'] = self::get_default_settings();

		return $integrations;
	}

	/**
	 * Sanitize and whitelist the HubSpot integration settings on save.
	 *
	 * @param array $integrations     Sanitized integration settings so far (from other integrations).
	 * @param array $settings         Full incoming settings payload.
	 * @param array $default_settings Full default settings.
	 * @return array
	 */
	public function sanitize_integration_settings( $integrations, $settings, $default_settings ) {
		if ( ! is_array( $integrations ) ) {
			$integrations = array();
		}

		$incoming = isset( $settings['integrations']['hubspot'] ) && is_array( $settings['integrations']['hubspot'] )
			? $settings['integrations']['hubspot']
			: array();

		$defaults = isset( $default_settings['integrations']['hubspot'] ) && is_array( $default_settings['integrations']['hubspot'] )
			? $default_settings['integrations']['hubspot']
			: self::get_default_settings();

		$source = sanitize_text_field( $incoming['source'] ?? $defaults['source'] );
		if ( ! in_array( $source, array( 'central', 'leadin' ), true ) ) {
			$source = 'central';
		}

		$integrations['hubspot'] = array(
			'enable' => rest_sanitize_boolean( $incoming['enable'] ?? $defaults['enable'] ),
			'source' => $source,
		);

		return $integrations;
	}

	/**
	 * Get the saved HubSpot settings, merged over defaults.
	 *
	 * @return array {
	 *     @type bool   $enable Whether the integration is enabled.
	 *     @type string $source Chosen connection source: `central` or `leadin`.
	 * }
	 */
	public static function get_settings() {
		$all = get_option( self::SETTINGS_OPTION, array() );

		$hubspot = isset( $all['integrations']['hubspot'] ) && is_array( $all['integrations']['hubspot'] )
			? $all['integrations']['hubspot']
			: array();

		return wp_parse_args( $hubspot, self::get_default_settings() );
	}

	/**
	 * The connection source the admin chose: `central` or `leadin`.
	 *
	 * This is the admin's preference, not proof of a live connection — use
	 * {@see get_active_source()} to know which source is actually usable.
	 *
	 * @return string
	 */
	public static function get_chosen_source() {
		$settings = self::get_settings();

		return ! empty( $settings['source'] ) ? (string) $settings['source'] : 'central';
	}

	// --- GoDAM Central source ---

	/**
	 * The HubSpot account details GoDAM Central holds for this organization.
	 *
	 * GoDAM Central is the source of truth for a Central connection. Its account
	 * details (portal ID, region) ride along in the `map` block of the cached
	 * `verify_api_key` response, so this reads the stored option directly and
	 * never triggers a remote call — safe on every frontend page load.
	 *
	 * @return array {
	 *     Empty when HubSpot is not connected on Central (or no `map` block yet).
	 *
	 *     @type string|null $portal_id HubSpot account (portal) ID.
	 *     @type string|null $region    HubSpot data centre, e.g. `na1`, `eu1`.
	 * }
	 */
	public static function get_central_config() {
		$stored = get_option( 'rtgodam_user_data', array() );

		$map = isset( $stored['user_data']['map'] ) && is_array( $stored['user_data']['map'] )
			? $stored['user_data']['map']
			: array();

		$hubspot = isset( $map['hubspot'] ) && is_array( $map['hubspot'] )
			? $map['hubspot']
			: array();

		return $hubspot;
	}

	/**
	 * Whether HubSpot is connected on GoDAM Central.
	 *
	 * @return bool
	 */
	public static function is_central_connected() {
		$central = self::get_central_config();

		return ! empty( $central['portal_id'] );
	}

	/**
	 * The portal ID from the GoDAM Central connection.
	 *
	 * @return string
	 */
	public static function get_central_portal_id() {
		$central = self::get_central_config();

		return ! empty( $central['portal_id'] ) ? (string) $central['portal_id'] : '';
	}

	/**
	 * The region (data centre) from the GoDAM Central connection.
	 *
	 * @return string
	 */
	public static function get_central_region() {
		$central = self::get_central_config();

		return ! empty( $central['region'] ) ? (string) $central['region'] : self::DEFAULT_REGION;
	}

	// --- HubSpot (leadin) plugin source ---

	/**
	 * Whether the "HubSpot All-In-One Marketing" (leadin) plugin is active.
	 *
	 * The plugin being active is what makes it a connection option at all: when it
	 * is not active, Central is the only method the settings tab offers.
	 *
	 * @return bool
	 */
	public static function is_leadin_active() {
		if ( ! function_exists( 'is_plugin_active' ) ) {
			require_once ABSPATH . 'wp-admin/includes/plugin.php';
		}

		return is_plugin_active( 'leadin/leadin.php' );
	}

	/**
	 * Whether the "HubSpot All-In-One Marketing" (leadin) plugin is active and
	 * connected to an account.
	 *
	 * Mirrors leadin's own Connection::is_connected(): a portal ID and a refresh
	 * token must both be present. Read from options to avoid coupling to leadin's
	 * classes.
	 *
	 * @return bool
	 */
	public static function is_leadin_connected() {
		return self::is_leadin_active()
			&& ! empty( get_option( 'leadin_portalId', '' ) )
			&& ! empty( get_option( 'leadin_refresh_token', '' ) );
	}

	/**
	 * The portal ID from the connected leadin plugin.
	 *
	 * @return string
	 */
	public static function get_leadin_portal_id() {
		return (string) get_option( 'leadin_portalId', '' );
	}

	/**
	 * The region (hublet) from the connected leadin plugin.
	 *
	 * @return string
	 */
	public static function get_leadin_region() {
		$hublet = (string) get_option( 'leadin_hublet', '' );

		return '' !== $hublet ? $hublet : self::DEFAULT_REGION;
	}

	// --- Source resolution ---

	/**
	 * The source actually in effect: the admin's chosen source, but only when it
	 * is genuinely connected. Empty when the chosen source is not connected.
	 *
	 * When the HubSpot (leadin) plugin is not active it is not a connection option
	 * at all, so the choice collapses to Central regardless of what is stored (the
	 * stored choice is kept, so it returns if the plugin is reactivated). When the
	 * plugin is active the choice is respected strictly: Central never silently
	 * falls back to leadin (or the reverse), so the behaviour is predictable and
	 * the settings tab can nudge the admin to connect the source they chose.
	 *
	 * @return string `central`, `leadin`, or '' when the chosen source is not connected.
	 */
	public static function get_active_source() {
		$chosen = self::get_chosen_source();

		// Without the HubSpot plugin active, Central is the only method.
		if ( ! self::is_leadin_active() ) {
			$chosen = 'central';
		}

		if ( 'central' === $chosen && self::is_central_connected() ) {
			return 'central';
		}

		if ( 'leadin' === $chosen && self::is_leadin_connected() ) {
			return 'leadin';
		}

		return '';
	}

	/**
	 * The portal ID of whichever source is active. Empty when none is.
	 *
	 * @return string
	 */
	public static function get_effective_portal_id() {
		switch ( self::get_active_source() ) {
			case 'central':
				return self::get_central_portal_id();
			case 'leadin':
				return self::get_leadin_portal_id();
			default:
				return '';
		}
	}

	/**
	 * The region of whichever source is active. Empty when none is.
	 *
	 * @return string
	 */
	public static function get_effective_region() {
		switch ( self::get_active_source() ) {
			case 'central':
				return self::get_central_region();
			case 'leadin':
				return self::get_leadin_region();
			default:
				return '';
		}
	}

	/**
	 * Absolute URL of GoDAM Central's Third Party Apps settings page.
	 *
	 * @return string
	 */
	public static function central_settings_url() {
		return RTGODAM_API_BASE . self::CENTRAL_SETTINGS_PATH;
	}

	/**
	 * Whether the HubSpot integration is enabled (the site-level on/off switch),
	 * regardless of whether a source is connected.
	 *
	 * @return bool
	 */
	public static function is_enabled() {
		$settings = self::get_settings();

		return ! empty( $settings['enable'] );
	}

	/**
	 * Whether a HubSpot form can render: the integration is enabled on this site
	 * and the admin's chosen source is actually connected.
	 *
	 * @return bool
	 */
	public static function is_configured() {
		return self::is_enabled()
			&& '' !== self::get_active_source();
	}
}
