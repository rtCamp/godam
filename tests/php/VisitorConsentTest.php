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

		require_once dirname( __DIR__, 2 ) . '/inc/classes/class-visitor-consent.php';
	}

	public function test_tracking_is_on_and_does_not_wait_without_the_consent_api(): void {
		$config = Visitor_Consent::get_script_config();

		$this->assertTrue( $config['trackingEnabled'] );
		$this->assertFalse( $config['consentApi'] );
		$this->assertSame( 'statistics', $config['category'] );
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

		$names = array_column( $GLOBALS['rtgodam_cookie_info'], 0 );
		$this->assertSame( array( '__anon_id', 'godamVideoSeen:*', 'godamLayerInteractions' ), $names );

		foreach ( $GLOBALS['rtgodam_cookie_info'] as $args ) {
			$this->assertSame( 'GoDAM', $args[1] );
			$this->assertSame( 'statistics', $args[2] );
			$this->assertNotSame( '', $args[3], 'Each item says how long it is kept.' );
			$this->assertNotSame( '', $args[4], 'Each item says what it is for.' );
			$this->assertSame( 'LOCALSTORAGE', $args[8] );
		}
	}

	public function test_lists_nothing_without_the_consent_api(): void {
		Visitor_Consent::get_instance()->register_cookie_info();

		$this->assertFalse( function_exists( 'wp_add_cookie_info' ) );
	}
}
