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
	 * Build the protocol-relative Marketo instance host used by forms2.
	 *
	 * Marketo instances are reached either on their pod domain
	 * (`app-sj04.marketo.com`) or on the newer `*.mktoweb.com` domain
	 * (`123-ABC-456.mktoweb.com`). Accept whichever the user pastes — with or
	 * without a scheme — and only fall back to appending `.mktoweb.com` when a
	 * bare identifier (no dot) is given.
	 *
	 * @return string Host like `//app-sj04.marketo.com`, or '' when unset.
	 */
	public static function get_instance_host() {
		$settings = self::get_settings();
		$pod      = trim( (string) $settings['podId'] );

		if ( '' === $pod ) {
			return '';
		}

		// Strip any scheme, leading slashes and path so only the host remains.
		$pod = preg_replace( '#^[a-z][a-z0-9+.-]*:#i', '', $pod );
		$pod = ltrim( $pod, '/' );
		$pod = explode( '/', $pod )[0];
		$pod = trim( $pod );

		if ( '' === $pod ) {
			return '';
		}

		if ( false === strpos( $pod, '.' ) ) {
			$pod .= '.mktoweb.com';
		}

		return '//' . $pod;
	}

	/**
	 * Whether Marketo is enabled and has the minimum credentials to render a form.
	 *
	 * @return bool
	 */
	public static function is_configured() {
		$settings = self::get_settings();

		return ! empty( $settings['enable'] )
			&& ! empty( self::get_instance_host() )
			&& ! empty( $settings['munchkinId'] );
	}
}
