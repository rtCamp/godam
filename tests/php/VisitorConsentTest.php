<?php
/**
 * GoDAM's front-end analytics can wait for the visitor's consent.
 *
 * Visitor_Consent tells the front end whether to wait for the WP Consent API's
 * "statistics" consent, or not to track at all (the `godam_visitor_tracking_enabled`
 * filter), and lists GoDAM's browser items with the WP Consent API so consent
 * banners can show them. See rtCamp/godam-plugin-wp#47.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Visitor_Consent;

/**
 * Separate processes: whether the WP Consent API's functions exist is decided by
 * defining them, which cannot be undone within one process.
 *
 * @covers \RTGODAM\Inc\Visitor_Consent
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class VisitorConsentTest extends TestCase {

	protected function setUp(): void {
		parent::setUp();

		if ( ! defined( 'RTGODAM_BASE_NAME' ) ) {
			define( 'RTGODAM_BASE_NAME', 'godam/godam.php' );
		}

		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_stub']  = array( 'options' => array() );

		require_once dirname( __DIR__, 2 ) . '/inc/classes/class-visitor-consent.php';
	}

	public function test_tracking_is_on_and_does_not_wait_without_the_consent_api(): void {
		$config = Visitor_Consent::get_script_config();

		$this->assertTrue( $config['trackingEnabled'] );
		$this->assertFalse( $config['consentApi'] );
		$this->assertFalse( $config['requireConsent'] );
		$this->assertArrayNotHasKey( 'category', $config, 'The JS fixes the category to statistics; nothing reads a setting.' );
	}

	public function test_a_site_with_its_own_banner_can_make_godam_wait(): void {
		add_filter(
			'godam_visitor_tracking_requires_consent',
			static function () {
				return true;
			}
		);

		$this->assertTrue( Visitor_Consent::get_script_config()['requireConsent'] );
	}

	public function test_the_filter_turns_visitor_tracking_off(): void {
		add_filter(
			'godam_visitor_tracking_enabled',
			static function () {
				return false;
			}
		);

		$this->assertFalse( Visitor_Consent::get_script_config()['trackingEnabled'] );
	}

	public function test_waits_for_consent_when_the_consent_api_is_active(): void {
		eval( 'function wp_has_consent( $category ) { return false; }' ); // phpcs:ignore Squiz.PHP.Eval.Discouraged -- defines the WP Consent API function for this process only.

		$this->assertTrue( Visitor_Consent::get_script_config()['consentApi'] );
	}

	public function test_declares_support_for_the_consent_api(): void {
		Visitor_Consent::get_instance();

		$this->assertSame(
			array( '__return_true' ),
			$GLOBALS['rtgodam_hooks']['wp_consent_api_registered_godam/godam.php'][10] ?? array()
		);
	}

	public function test_lists_its_browser_items_for_consent_banners(): void {
		$GLOBALS['rtgodam_cookie_info'] = array();
		eval( // phpcs:ignore Squiz.PHP.Eval.Discouraged -- defines the WP Consent API function for this process only.
			'function wp_add_cookie_info( ...$args ) { $GLOBALS["rtgodam_cookie_info"][] = $args; }'
		);

		Visitor_Consent::get_instance()->register_cookie_info();

		$items = array();
		foreach ( $GLOBALS['rtgodam_cookie_info'] as $args ) {
			$this->assertSame( 'GoDAM', $args[1] );
			$this->assertNotSame( '', $args[3], 'Each item says how long it is kept.' );
			$this->assertNotSame( '', $args[4], 'Each item says what it is for.' );
			$items[ $args[0] ] = array( $args[2], $args[8] );
		}

		// Name => [ category, where the browser keeps it ].
		$this->assertSame(
			array(
				'__anon_id'                   => array( 'statistics', 'LOCALSTORAGE' ),
				'godamVideoSeen:*'            => array( 'statistics', 'LOCALSTORAGE' ),
				'godamLayerInteractions'      => array( 'statistics', 'SESSIONSTORAGE' ),
				'godam-ff-recorder-data'      => array( 'functional', 'LOCALSTORAGE' ),
				'godam-nf-recorder-data'      => array( 'functional', 'LOCALSTORAGE' ),
				'godam-evf-recorder-data'     => array( 'functional', 'LOCALSTORAGE' ),
				'uppyState:*'                 => array( 'functional', 'LOCALSTORAGE' ),
				'godam_llms_video_progress_*' => array( 'functional', 'LOCALSTORAGE' ),
				'godam-map-session-*'         => array( 'marketing', 'SESSIONSTORAGE' ),
			),
			$items
		);
	}

	public function test_lists_nothing_without_the_consent_api(): void {
		Visitor_Consent::get_instance()->register_cookie_info();

		$this->assertFalse( function_exists( 'wp_add_cookie_info' ) );
	}

	public function test_the_track_visitors_setting_turns_visitor_tracking_off(): void {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-settings'] = array( 'general' => array( 'enable_visitor_tracking' => false ) );

		$this->assertFalse( Visitor_Consent::get_script_config()['trackingEnabled'] );
	}

	public function test_tracking_stays_on_when_the_setting_was_never_saved(): void {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-settings'] = array( 'general' => array( 'enable_gtm_tracking' => true ) );

		$this->assertTrue( Visitor_Consent::get_script_config()['trackingEnabled'], 'Sites updating from 2.8.0 have no saved value and keep tracking.' );
	}

	public function test_the_filter_overrides_the_setting(): void {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-settings'] = array( 'general' => array( 'enable_visitor_tracking' => false ) );
		add_filter(
			'godam_visitor_tracking_enabled',
			static function ( $enabled ) {
				return ! $enabled;
			}
		);

		$this->assertTrue( Visitor_Consent::get_script_config()['trackingEnabled'], 'The filter receives the setting as its default and wins.' );
	}

	public function test_suggests_no_privacy_policy_text_without_the_wordpress_function(): void {
		if ( function_exists( 'wp_add_privacy_policy_content' ) ) {
			$this->markTestSkipped( 'wp_add_privacy_policy_content() is defined in this process.' );
		}

		Visitor_Consent::get_instance()->add_privacy_policy_content();

		$this->assertFalse( function_exists( 'wp_add_privacy_policy_content' ) );
	}

	/**
	 * Runs in its own process: the stub it defines would otherwise stay defined for
	 * every later test and hide the function_exists() guard.
	 *
	 * @runInSeparateProcess
	 * @preserveGlobalState disabled
	 */
	public function test_suggests_privacy_policy_text(): void {
		$GLOBALS['rtgodam_privacy'] = array();
		eval( // phpcs:ignore Squiz.PHP.Eval.Discouraged -- defines the WP function for this process only.
			'function wp_add_privacy_policy_content( $name, $content ) { $GLOBALS["rtgodam_privacy"][] = array( $name, $content ); }'
		);

		Visitor_Consent::get_instance()->add_privacy_policy_content();

		$this->assertCount( 1, $GLOBALS['rtgodam_privacy'] );
		list( $name, $content ) = $GLOBALS['rtgodam_privacy'][0];
		$this->assertSame( 'GoDAM', $name );
		$this->assertStringContainsString( 'analytics.godam.io', $content );
		$this->assertStringContainsString( 'UTM', $content );
		foreach ( array( '__anon_id', 'godamVideoSeen:*', 'godamLayerInteractions' ) as $item ) {
			$this->assertStringContainsString( $item, $content, 'The text names every analytics item GoDAM stores in the browser.' );
		}
		// The text says these items wait for statistics consent, so it leaves the functional ones out.
		$this->assertStringNotContainsString( 'recorder-data', $content );
		$this->assertStringNotContainsString( 'godam_llms_video_progress_', $content );
		$this->assertStringNotContainsString( '<li><code>godam-map-session-', $content );

		// The Marketo/HubSpot flow is disclosed in its own paragraph, with its item.
		$this->assertStringContainsString( 'Marketo or HubSpot', $content );
		$this->assertStringContainsString( 'godam-map-session-&lt;video&gt;', $content );
		$this->assertStringContainsString( 'consent to marketing', $content );
	}

	public function test_hooks_the_privacy_policy_text_on_admin_init(): void {
		$instance = Visitor_Consent::get_instance();

		$this->assertContains(
			array( $instance, 'add_privacy_policy_content' ),
			$GLOBALS['rtgodam_hooks']['admin_init'][10] ?? array()
		);
	}
}
