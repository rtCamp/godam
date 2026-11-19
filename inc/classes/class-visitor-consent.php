<?php
/**
 * Visitor consent for GoDAM's front-end analytics.
 *
 * @package GoDAM
 */

namespace RTGODAM\Inc;

defined( 'ABSPATH' ) || exit;

use RTGODAM\Inc\Traits\Singleton;

/**
 * Class Visitor_Consent
 *
 * GoDAM counts video views and image-hotspot clicks with three items in the
 * visitor's browser and sends events (with an anonymous visitor id, the visitor's
 * IP and browser details) to analytics.godam.io. This class lets a site make that
 * wait for the visitor's "statistics" consent:
 *
 * - With the WP Consent API plugin active, GoDAM declares support for it and lists
 *   its browser items for consent banners (register_cookie_info()). The front end
 *   (`assets/src/js/godam-player/utils/consent.js`) then stores nothing and sends
 *   nothing until `wp_has_consent( 'statistics' )` is true, starts if the visitor
 *   agrees mid-page, and deletes the items if they withdraw.
 * - Without it, behaviour is unchanged, as with WooCommerce's order attribution.
 * - The "Track visitors" setting (GoDAM > Settings > General) and the
 *   `godam_visitor_tracking_enabled` filter turn visitor tracking off entirely.
 * - For a banner that does not support the WP Consent API, the
 *   `godam_visitor_tracking_requires_consent` filter makes GoDAM wait until the
 *   banner calls `window.GoDAM.setAnalyticsConsent( true )`.
 * - Events from before the visitor's choice wait in memory: sent if they accept on
 *   that page, discarded if they refuse.
 *
 * The front end reads the settings from `videoAnalyticsParams.consent`
 * (get_script_config()). It also suggests text for the site's privacy policy
 * (add_privacy_policy_content()). See rtCamp/godam-plugin-wp#55.
 *
 * @since 2.8.0
 */
class Visitor_Consent {

	use Singleton;

	/**
	 * WP Consent API category GoDAM's analytics waits for.
	 *
	 * @var string
	 */
	const CONSENT_CATEGORY = 'statistics';

	/**
	 * Construct method.
	 */
	protected function __construct() {
		$this->setup_hooks();
	}

	/**
	 * Register hooks.
	 *
	 * @return void
	 */
	protected function setup_hooks() {
		// The WP Consent API asks each plugin to declare that it follows the API;
		// banners and the Site Health check read this.
		add_filter( 'wp_consent_api_registered_' . RTGODAM_BASE_NAME, '__return_true' );
		add_action( 'init', array( $this, 'register_cookie_info' ) );
		add_action( 'admin_init', array( $this, 'add_privacy_policy_content' ) );
	}

	/**
	 * Whether the "Track visitors" setting is on.
	 *
	 * Stored as `rtgodam-settings` > general > `enable_visitor_tracking`; on unless
	 * an administrator turned it off.
	 *
	 * @since 2.11.0
	 *
	 * @return bool
	 */
	public static function is_tracking_setting_enabled() {
		$settings = get_option( 'rtgodam-settings', array() );

		if ( ! is_array( $settings ) || ! isset( $settings['general'] ) || ! is_array( $settings['general'] ) ) {
			return true;
		}

		if ( ! array_key_exists( 'enable_visitor_tracking', $settings['general'] ) ) {
			return true;
		}

		return rest_sanitize_boolean( $settings['general']['enable_visitor_tracking'] );
	}

	/**
	 * Whether GoDAM may track visitors at all on this site.
	 *
	 * @since 2.8.0
	 *
	 * @return bool
	 */
	public static function is_tracking_enabled() {
		/**
		 * Filters whether GoDAM tracks visitors on the front end.
		 *
		 * Return false to stop GoDAM storing its visitor id and video items in the
		 * browser and sending view and click events to GoDAM analytics, for every
		 * visitor. Sites with a consent banner that supports the WP Consent API do
		 * not need this: GoDAM waits for "statistics" consent on its own.
		 *
		 * @since 2.8.0
		 * @since 2.11.0 The default follows the "Track visitors" setting.
		 *
		 * @param bool $enabled Whether visitor tracking is on. Default: the "Track
		 *                      visitors" setting in GoDAM > Settings > General (on).
		 */
		return (bool) apply_filters( 'godam_visitor_tracking_enabled', self::is_tracking_setting_enabled() );
	}

	/**
	 * Whether GoDAM waits for the site's own banner to call
	 * `window.GoDAM.setAnalyticsConsent()` before it tracks a visitor.
	 *
	 * @since 2.8.0
	 *
	 * @return bool
	 */
	public static function requires_consent() {
		/**
		 * Filters whether GoDAM waits for the visitor's consent from the site's own
		 * consent banner.
		 *
		 * Return true when the site's banner does not support the WP Consent API.
		 * GoDAM then stores nothing and sends nothing until the banner calls
		 * `window.GoDAM.setAnalyticsConsent( true )` (false when the visitor refuses),
		 * or sets `window.godamAnalyticsConsent = true` before GoDAM's scripts run.
		 * Not needed with the WP Consent API: GoDAM waits for "statistics" on its own.
		 *
		 * @since 2.8.0
		 *
		 * @param bool $requires_consent Whether to wait for the banner. Default false.
		 */
		return (bool) apply_filters( 'godam_visitor_tracking_requires_consent', false );
	}

	/**
	 * Whether the WP Consent API plugin is active.
	 *
	 * @since 2.8.0
	 *
	 * @return bool
	 */
	public static function is_consent_api_active() {
		return function_exists( 'wp_has_consent' );
	}

	/**
	 * Settings the front-end analytics reads, as `videoAnalyticsParams.consent`.
	 *
	 * @since 2.8.0
	 *
	 * The category is always "statistics" (CONSENT_CATEGORY), so it is not sent.
	 *
	 * @return array{trackingEnabled: bool, consentApi: bool, requireConsent: bool}
	 */
	public static function get_script_config() {
		return array(
			'trackingEnabled' => self::is_tracking_enabled(),
			'consentApi'      => self::is_consent_api_active(),
			'requireConsent'  => self::requires_consent(),
		);
	}

	/**
	 * Items GoDAM keeps in the visitor's browser, for consent banners.
	 *
	 * Each item names its WP Consent API category and where the browser keeps it
	 * (`LOCALSTORAGE`, `SESSIONSTORAGE` or `HTTP` for a cookie), as GoDAM for Woo does.
	 *
	 * @since 2.8.0
	 * @since 2.11.0 Each item has a `category` and a `type`.
	 *
	 * @return array<int, array{name: string, category: string, type: string, expires: string, purpose: string, personal_data: string}>
	 */
	public static function get_storage_items() {
		return array(
			array(
				'name'          => '__anon_id',
				'category'      => self::CONSENT_CATEGORY,
				'type'          => 'LOCALSTORAGE',
				'expires'       => __( 'Until deleted', 'godam' ),
				'purpose'       => __( 'Ties one visitor\'s video views and clicks together without naming them.', 'godam' ),
				'personal_data' => __( 'Anonymous visitor ID', 'godam' ),
			),
			array(
				'name'          => 'godamVideoSeen:*',
				'category'      => self::CONSENT_CATEGORY,
				'type'          => 'LOCALSTORAGE',
				'expires'       => __( 'Until deleted', 'godam' ),
				'purpose'       => __( 'Counts a viewer once per video.', 'godam' ),
				'personal_data' => '',
			),
			array(
				'name'          => 'godamLayerInteractions',
				'category'      => self::CONSENT_CATEGORY,
				'type'          => 'SESSIONSTORAGE',
				'expires'       => __( 'Until the browser tab closes', 'godam' ),
				'purpose'       => __( 'Holds clicks on video and image layers until they are sent to GoDAM analytics.', 'godam' ),
				'personal_data' => '',
			),
			// Functional: needed for a feature the visitor is using, not for analytics.
			array(
				'name'          => 'godam-ff-recorder-data',
				'category'      => 'functional',
				'type'          => 'LOCALSTORAGE',
				'expires'       => __( '10 minutes', 'godam' ),
				'purpose'       => __( 'Keeps the link to a recording made in a Fluent Forms form, so it is not lost if the page reloads before the form is sent.', 'godam' ),
				'personal_data' => __( 'Link to your unsent recording', 'godam' ),
			),
			array(
				'name'          => 'godam-nf-recorder-data',
				'category'      => 'functional',
				'type'          => 'LOCALSTORAGE',
				'expires'       => __( '10 minutes', 'godam' ),
				'purpose'       => __( 'Keeps the link to a recording made in a Ninja Forms form, so it is not lost if the page reloads before the form is sent.', 'godam' ),
				'personal_data' => __( 'Link to your unsent recording', 'godam' ),
			),
			array(
				'name'          => 'godam-evf-recorder-data',
				'category'      => 'functional',
				'type'          => 'LOCALSTORAGE',
				'expires'       => __( '10 minutes', 'godam' ),
				'purpose'       => __( 'Keeps the link to a recording made in an Everest Forms form, so it is not lost if the page reloads before the form is sent.', 'godam' ),
				'personal_data' => __( 'Link to your unsent recording', 'godam' ),
			),
			array(
				'name'          => 'uppyState:*',
				'category'      => 'functional',
				'type'          => 'LOCALSTORAGE',
				'expires'       => __( '10 minutes', 'godam' ),
				'purpose'       => __( 'Keeps an upload in the GoDAM recorder field, so it can carry on if the page reloads.', 'godam' ),
				'personal_data' => __( 'Details of your unsent recording', 'godam' ),
			),
			// Uppy's Golden Retriever keeps the recording itself in this IndexedDB database.
			// The WP Consent API documents only HTTP, LOCALSTORAGE and API as types, and
			// stores any other value as given; INDEXEDDB says where it really is.
			array(
				'name'          => 'uppy-blobs',
				'category'      => 'functional',
				'type'          => 'INDEXEDDB',
				'expires'       => __( '10 minutes', 'godam' ),
				'purpose'       => __( 'Holds a recording made in the GoDAM recorder field until it is uploaded, so it is not lost if the page reloads.', 'godam' ),
				'personal_data' => __( 'Your unsent recording', 'godam' ),
			),
			array(
				'name'          => 'godam_llms_video_progress_*',
				'category'      => 'functional',
				'type'          => 'LOCALSTORAGE',
				'expires'       => __( 'Until deleted', 'godam' ),
				'purpose'       => __( 'Remembers how far a learner watched a LifterLMS lesson video, so it can carry on from there.', 'godam' ),
				'personal_data' => '',
			),
			// Marketing: only on sites with a connected Marketo or HubSpot account (see map-tracking.js).
			array(
				'name'          => 'godam-map-session-*',
				'category'      => 'marketing',
				'type'          => 'SESSIONSTORAGE',
				'expires'       => __( 'Until the browser tab closes', 'godam' ),
				'purpose'       => __( 'Groups one view of a video when how far it was watched is sent to the site\'s connected Marketo or HubSpot account.', 'godam' ),
				'personal_data' => '',
			),
		);
	}

	/**
	 * List GoDAM's browser items with the WP Consent API, so banners can show them.
	 *
	 * @since 2.8.0
	 *
	 * @return void
	 */
	public function register_cookie_info() {
		if ( ! function_exists( 'wp_add_cookie_info' ) ) {
			return;
		}

		foreach ( self::get_storage_items() as $item ) {
			wp_add_cookie_info(
				$item['name'],
				'GoDAM',
				$item['category'],
				$item['expires'],
				$item['purpose'],
				$item['personal_data'],
				false,
				false,
				$item['type']
			);
		}
	}

	/**
	 * Suggested text for the site's privacy policy (Settings > Privacy).
	 *
	 * Lists the analytics items, then a paragraph for sites that send video views to
	 * Marketo or HubSpot.
	 *
	 * @since 2.11.0
	 *
	 * @return string HTML.
	 */
	public static function get_privacy_policy_content() {
		$items = '';
		foreach ( self::get_storage_items() as $item ) {
			// This text is about analytics, which waits for statistics consent; the
			// functional items are only listed for consent banners.
			if ( self::CONSENT_CATEGORY !== $item['category'] ) {
				continue;
			}

			$items .= sprintf(
				'<li><code>%1$s</code>: %2$s %3$s</li>',
				esc_html( $item['name'] ),
				esc_html( $item['purpose'] ),
				/* translators: %s: how long the item is kept, e.g. "Until deleted". */
				esc_html( sprintf( __( 'Kept: %s.', 'godam' ), $item['expires'] ) )
			);
		}

		$content  = '<p class="privacy-policy-tutorial">' . esc_html__( 'GoDAM counts views of the videos and images on this site, and clicks on their layers, so the site owner can see how the media performs. Edit this text to match your site. If you turned visitor tracking off in GoDAM > Settings > General, you can leave it out.', 'godam' ) . '</p>';
		$content .= '<strong class="privacy-policy-tutorial">' . esc_html__( 'Suggested text:', 'godam' ) . ' </strong>';
		$content .= '<p>' . esc_html__( 'When you view a video or an interactive image on this site, we use GoDAM to measure how our media is watched. GoDAM sends these details to GoDAM analytics (analytics.godam.io), run by rtCamp: an anonymous visitor ID, the page you are on and the page that referred you, including campaign (UTM) parameters, which video you watched and for how long, clicks on video and image layers, your browser, operating system, screen size and language, and your IP address, which is used to find your country.', 'godam' ) . '</p>';
		$content .= '<p>' . esc_html__( 'GoDAM keeps these items in your browser:', 'godam' ) . '</p>';
		$content .= '<ul>' . $items . '</ul>';
		$content .= '<p>' . esc_html__( 'If this site asks for your consent to statistics, GoDAM stores nothing and sends nothing until you agree, and deletes these items if you withdraw your consent.', 'godam' ) . '</p>';
		$content .= '<p class="privacy-policy-tutorial">' . esc_html__( 'Only if GoDAM is connected to Marketo or HubSpot in GoDAM Central:', 'godam' ) . '</p>';
		$content .= '<p>' . sprintf(
			/* translators: %s: name of the browser item, godam-map-session-<video>. */
			esc_html__( 'How much of a video you watch is also sent to this site\'s Marketo or HubSpot account, matched to that service\'s own cookie in your browser. GoDAM keeps %s in your browser until you close the tab. If this site asks for your consent to marketing, this waits for it.', 'godam' ),
			'<code>godam-map-session-&lt;video&gt;</code>'
		) . '</p>';
		$content .= '<p>' . sprintf(
			/* translators: %s: link to the GoDAM privacy policy. */
			esc_html__( 'GoDAM\'s privacy policy: %s', 'godam' ),
			'<a href="https://godam.io/privacy-policy/">https://godam.io/privacy-policy/</a>'
		) . '</p>';

		return $content;
	}

	/**
	 * Suggest GoDAM's text in the privacy policy guide.
	 *
	 * @since 2.11.0
	 *
	 * @return void
	 */
	public function add_privacy_policy_content() {
		if ( ! function_exists( 'wp_add_privacy_policy_content' ) ) {
			return;
		}

		wp_add_privacy_policy_content( 'GoDAM', wp_kses_post( self::get_privacy_policy_content() ) );
	}
}
