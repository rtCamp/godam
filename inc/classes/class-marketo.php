<?php
/**
 * Marketo integration.
 *
 * Adds a Marketo integration to GoDAM so that Marketo forms can be rendered
 * inside video layers. V1 collects the instance credentials (Pod ID, Munchkin
 * ID and an optional reCAPTCHA key) on the Settings → Integrations → Marketo
 * tab; the per-layer Marketo Form ID is entered in the video editor.
 *
 * Unlike the other form integrations, Marketo is a third-party SaaS with no
 * WordPress plugin and no shortcode: the form is embedded on the frontend via
 * Marketo's forms2 library (see Marketo_Form_Assets).
 *
 * @since 2.5.0
 * @package GoDAM
 */

namespace RTGODAM\Inc;

use RTGODAM\Inc\Traits\Singleton;

defined( 'ABSPATH' ) || exit;

/**
 * Class Marketo
 *
 * @since 2.5.0
 */
class Marketo {

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
	 * Where disconnecting Marketo and the "Track video views" switch are done:
	 * actions the plugin cannot perform, so the tab links out to Central for them.
	 *
	 * @var string
	 */
	const CENTRAL_SETTINGS_PATH = '/web/settings?setTab=ThirdPartyApps';

	/**
	 * Default Marketo integration settings.
	 *
	 * @return array
	 */
	public static function get_default_settings() {
		return array(
			'enable'       => true,
			'podId'        => '',
			'munchkinId'   => '',
			'recaptchaKey' => '',
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
	 * category entirely through filters, so Marketo plugs its fields in here.
	 *
	 * @return void
	 */
	public function setup_hooks() {
		add_filter( 'godam_default_integration_settings', array( $this, 'add_default_integration_settings' ) );
		add_filter( 'godam_sanitize_integration_settings', array( $this, 'sanitize_integration_settings' ), 10, 3 );
	}

	/**
	 * Merge Marketo defaults into the integrations settings defaults.
	 *
	 * @param array $integrations Existing integration defaults (from other integrations).
	 * @return array
	 */
	public function add_default_integration_settings( $integrations ) {
		if ( ! is_array( $integrations ) ) {
			$integrations = array();
		}

		$integrations['marketo'] = self::get_default_settings();

		return $integrations;
	}

	/**
	 * Sanitize and whitelist the Marketo integration settings on save.
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

		$incoming = isset( $settings['integrations']['marketo'] ) && is_array( $settings['integrations']['marketo'] )
			? $settings['integrations']['marketo']
			: array();

		$defaults = isset( $default_settings['integrations']['marketo'] ) && is_array( $default_settings['integrations']['marketo'] )
			? $default_settings['integrations']['marketo']
			: self::get_default_settings();

		$integrations['marketo'] = array(
			'enable'       => rest_sanitize_boolean( $incoming['enable'] ?? $defaults['enable'] ),
			'podId'        => sanitize_text_field( $incoming['podId'] ?? $defaults['podId'] ),
			'munchkinId'   => sanitize_text_field( $incoming['munchkinId'] ?? $defaults['munchkinId'] ),
			'recaptchaKey' => sanitize_text_field( $incoming['recaptchaKey'] ?? $defaults['recaptchaKey'] ),
		);

		return $integrations;
	}

	/**
	 * Get the saved Marketo settings, merged over defaults.
	 *
	 * @return array {
	 *     @type bool   $enable       Whether the integration is enabled.
	 *     @type string $podId        Marketo Pod / instance ID.
	 *     @type string $munchkinId   Marketo Munchkin (account) ID.
	 *     @type string $recaptchaKey Optional reCAPTCHA site key.
	 * }
	 */
	public static function get_settings() {
		$all = get_option( self::SETTINGS_OPTION, array() );

		$marketo = isset( $all['integrations']['marketo'] ) && is_array( $all['integrations']['marketo'] )
			? $all['integrations']['marketo']
			: array();

		return wp_parse_args( $marketo, self::get_default_settings() );
	}

	/**
	 * The Marketo account details GoDAM Central holds for this organization.
	 *
	 * GoDAM Central is the source of truth for the Marketo connection. Its
	 * account details (Munchkin ID, forms host, reCAPTCHA key) ride along in the
	 * `map` block of the cached `verify_api_key` response, so this reads the
	 * stored option directly and never triggers a remote call — safe on every
	 * frontend page load.
	 *
	 * @return array {
	 *     Empty when Marketo is not connected on Central (or no `map` block yet).
	 *
	 *     @type string      $state              `not_connected`, `connected` or `needs_attention`.
	 *     @type string|null $munchkin_id        Munchkin Account ID.
	 *     @type string|null $forms_host         Forms host, e.g. `app-sj04.marketo.com`.
	 *     @type string|null $recaptcha_site_key reCAPTCHA site key.
	 * }
	 */
	public static function get_central_config() {
		$stored = get_option( 'rtgodam_user_data', array() );

		$map = isset( $stored['user_data']['map'] ) && is_array( $stored['user_data']['map'] )
			? $stored['user_data']['map']
			: array();

		$marketo = isset( $map['marketo'] ) && is_array( $map['marketo'] )
			? $map['marketo']
			: array();

		return $marketo;
	}

	/**
	 * Whether Marketo is connected on GoDAM Central.
	 *
	 * @return bool
	 */
	public static function is_central_connected() {
		$central = self::get_central_config();

		return ! empty( $central['munchkin_id'] );
	}

	/**
	 * The Munchkin ID from the GoDAM Central connection.
	 *
	 * GoDAM Central is the single source of truth: this is empty unless Marketo is
	 * connected there. Nothing stored locally can make a form render.
	 *
	 * @return string
	 */
	public static function get_munchkin_id() {
		$central = self::get_central_config();

		return ! empty( $central['munchkin_id'] ) ? (string) $central['munchkin_id'] : '';
	}

	/**
	 * The reCAPTCHA site key from the GoDAM Central connection.
	 *
	 * @return string
	 */
	public static function get_recaptcha_key() {
		$central = self::get_central_config();

		return ! empty( $central['recaptcha_site_key'] ) ? (string) $central['recaptcha_site_key'] : '';
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
	 * Normalize a pasted Marketo host down to a bare host name.
	 *
	 * Accepts a value with or without a scheme, leading slashes or a path, and
	 * appends `.mktoweb.com` to a bare identifier (no dot).
	 *
	 * @param string $value Raw host / pod identifier.
	 * @return string Host like `app-sj04.marketo.com`, or '' when empty.
	 */
	private static function normalize_host( $value ) {
		$value = trim( (string) $value );

		if ( '' === $value ) {
			return '';
		}

		// Strip any scheme, leading slashes and path so only the host remains.
		$value = preg_replace( '#^[a-z][a-z0-9+.-]*:#i', '', $value );
		$value = ltrim( $value, '/' );
		$value = explode( '/', $value )[0];
		$value = trim( $value );

		if ( '' === $value ) {
			return '';
		}

		if ( false === strpos( $value, '.' ) ) {
			$value .= '.mktoweb.com';
		}

		return $value;
	}

	/**
	 * Build the protocol-relative Marketo instance host used by forms2.
	 *
	 * Derived only from the GoDAM Central connection: its forms host, or the
	 * `<munchkin>.mktoweb.com` fallback from its Munchkin ID. Empty when Marketo
	 * is not connected on Central.
	 *
	 * @return string Host like `//app-sj04.marketo.com`, or '' when not connected.
	 */
	public static function get_instance_host() {
		$central = self::get_central_config();

		if ( ! empty( $central['forms_host'] ) ) {
			return '//' . self::normalize_host( $central['forms_host'] );
		}

		if ( ! empty( $central['munchkin_id'] ) ) {
			return '//' . strtolower( (string) $central['munchkin_id'] ) . '.mktoweb.com';
		}

		return '';
	}

	/**
	 * Whether a Marketo form can render: the integration is enabled on this site
	 * and Marketo is connected on GoDAM Central.
	 *
	 * @return bool
	 */
	public static function is_configured() {
		$settings = self::get_settings();

		return ! empty( $settings['enable'] )
			&& self::is_central_connected()
			&& '' !== self::get_instance_host();
	}
}
