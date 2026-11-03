<?php
/**
 * The seasonal offer notice: who sees it, when, and which message.
 *
 * Joel's rules from the 2.5.2 release thread: a WP-admin notice, only for free
 * and trial sites (never paid), gone after each offer ends, and a message
 * picked by the integrations the site uses. Halloween runs through November 9,
 * Black Friday from November 15 to 27 (the BFCM 2026 campaign doc).
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Offer_Notice;

/**
 * @covers \RTGODAM\Inc\Offer_Notice
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class OfferNoticeTest extends TestCase {

	/**
	 * Load the class and stub what it reads.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array(
			'caps'           => array( 'manage_options' ),
			'options'        => array(),
			'active_plugins' => array(),
			'user_data'      => array(
				'valid_api_key'  => false,
				'api_key_status' => 'no_api_key',
			),
		);

		require_once dirname( __DIR__, 2 ) . '/inc/classes/enums/class-api-key-status.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/class-offer-notice.php';
	}

	/**
	 * A fixed moment, in UTC (the stubbed site time zone).
	 *
	 * @param string $time Date and time.
	 *
	 * @return \DateTime
	 */
	private function moment( $time ) {
		return new \DateTime( $time, new \DateTimeZone( 'UTC' ) );
	}

	/**
	 * The account data the test set up.
	 *
	 * @return array
	 */
	private function user_data() {
		return $GLOBALS['rtgodam_stub']['user_data'];
	}

	/**
	 * A connected site's plan data.
	 *
	 * @param string $plan     Active plan name.
	 * @param string $end_date Plan end date.
	 */
	private function connect( $plan, $end_date ) {
		$GLOBALS['rtgodam_stub']['user_data'] = array(
			'valid_api_key' => true,
			'user_data'     => array(
				'active_plan' => $plan,
				'end_date'    => $end_date,
			),
		);
	}

	public function test_a_free_site_admin_sees_it_before_the_offer_ends() {
		$this->assertTrue( Offer_Notice::should_show( $this->moment( '2026-10-29 10:00:00' ), $this->user_data() ) );
	}

	public function test_it_shows_until_the_last_second_of_november_9_and_not_after() {
		$this->assertTrue( Offer_Notice::should_show( $this->moment( '2026-11-09 23:59:59' ), $this->user_data() ) );
		$this->assertFalse( Offer_Notice::should_show( $this->moment( '2026-11-10 00:00:00' ), $this->user_data() ) );
	}

	public function test_the_end_follows_the_site_time_zone_not_utc() {
		// A site in India: midnight on 10 Nov there is 18:30 UTC on 9 Nov.
		$GLOBALS['rtgodam_stub']['timezone'] = new \DateTimeZone( 'Asia/Kolkata' );

		$this->assertTrue( Offer_Notice::should_show( $this->moment( '2026-11-09 18:29:59' ), $this->user_data() ) );
		$this->assertFalse( Offer_Notice::should_show( $this->moment( '2026-11-09 18:30:00' ), $this->user_data() ) );

		// A site in New York: still 9 Nov there when it is already 10 Nov in UTC.
		$GLOBALS['rtgodam_stub']['timezone'] = new \DateTimeZone( 'America/New_York' );

		$this->assertTrue( Offer_Notice::should_show( $this->moment( '2026-11-10 04:59:59' ), $this->user_data() ) );
		$this->assertFalse( Offer_Notice::should_show( $this->moment( '2026-11-10 05:00:00' ), $this->user_data() ) );
	}

	public function test_it_never_shows_on_a_later_year() {
		$this->assertFalse( Offer_Notice::should_show( $this->moment( '2027-10-29 10:00:00' ), $this->user_data() ) );
	}

	public function test_a_trial_site_sees_it() {
		$this->connect( 'Free', gmdate( 'Y-m-d H:i:s', time() + 10 * DAY_IN_SECONDS ) );

		$this->assertTrue( Offer_Notice::is_free_or_trial_site( $this->user_data() ) );
	}

	public function test_a_paid_site_never_sees_it() {
		$this->connect( 'Starter', gmdate( 'Y-m-d H:i:s', time() + 300 * DAY_IN_SECONDS ) );

		$this->assertFalse( Offer_Notice::is_free_or_trial_site( $this->user_data() ) );
		$this->assertFalse( Offer_Notice::should_show( $this->moment( '2026-10-29 10:00:00' ), $this->user_data() ) );
	}

	public function test_a_connected_free_plan_whose_trial_has_ended_does_not_see_it() {
		$this->connect( 'Free', gmdate( 'Y-m-d H:i:s', time() - DAY_IN_SECONDS ) );

		$this->assertFalse( Offer_Notice::is_free_or_trial_site( $this->user_data() ) );
	}

	public function test_only_administrators_see_it() {
		$GLOBALS['rtgodam_stub']['caps'] = array( 'edit_posts' );

		$this->assertFalse( Offer_Notice::should_show( $this->moment( '2026-10-29 10:00:00' ), $this->user_data() ) );
	}

	public function test_a_dismissed_notice_stays_hidden_and_an_old_offer_dismissal_does_not_hide_it() {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-offer-banner'] = 0;
		$this->assertTrue( Offer_Notice::should_show( $this->moment( '2026-10-29 10:00:00' ), $this->user_data() ) );

		$GLOBALS['rtgodam_stub']['options']['rtgodam_offer_halloween_2026_dismissed'] = 1793170000;
		$this->assertFalse( Offer_Notice::should_show( $this->moment( '2026-10-29 10:00:00' ), $this->user_data() ) );
	}

	public function test_lifterlms_wins_over_every_other_integration() {
		$GLOBALS['rtgodam_stub']['active_plugins'] = array( 'gravityforms/gravityforms.php', 'js_composer/js_composer.php', 'lifterlms/lifterlms.php' );

		$integrations = Offer_Notice::get_active_integrations();
		$message      = Offer_Notice::get_message( $integrations );

		$this->assertSame( 'lifterlms', $message['key'] );
		$this->assertStringContainsString( 'LifterLMS course videos', $message['message'] );
		$this->assertStringContainsString( 'from Vimeo for free', $message['message'] );
		$this->assertSame( array( 'LifterLMS', 'WPBakery', 'Gravity Forms' ), array_column( $integrations, 'name' ) );
	}

	public function test_wpbakery_names_itself_when_no_lms_store_or_elementor_is_active() {
		$GLOBALS['rtgodam_stub']['active_plugins'] = array( 'js_composer/js_composer.php', 'wpforms-lite/wpforms.php' );

		$message = Offer_Notice::get_message( Offer_Notice::get_active_integrations() );

		$this->assertSame( 'wpbakery', $message['key'] );
		$this->assertStringContainsString( 'your WPBakery pages', $message['message'] );
	}

	public function test_forms_message_names_up_to_two_plugins_and_offers_the_recorder_only_where_it_exists() {
		$GLOBALS['rtgodam_stub']['active_plugins'] = array( 'wpforms/wpforms.php', 'fluentform/fluentform.php', 'ninja-forms/ninja-forms.php' );
		$with                                      = Offer_Notice::get_message( Offer_Notice::get_active_integrations() );
		$this->assertSame( 'forms', $with['key'] );
		$this->assertStringContainsString( 'forms from WPForms and Fluent Forms inside', $with['message'] );
		$this->assertStringContainsString( 'recorder field', $with['message'] );

		$GLOBALS['rtgodam_stub']['active_plugins'] = array( 'contact-form-7/wp-contact-form-7.php' );
		$without                                   = Offer_Notice::get_message( Offer_Notice::get_active_integrations() );
		$this->assertStringContainsString( 'forms from Contact Form 7 inside', $without['message'] );
		$this->assertStringNotContainsString( 'recorder', $without['message'] );
	}

	public function test_no_supported_plugin_gets_the_general_line() {
		$message = Offer_Notice::get_message( Offer_Notice::get_active_integrations() );

		$this->assertSame( 'general', $message['key'] );
		$this->assertStringContainsString( 'Video hosting, transcoding and analytics', $message['message'] );
	}

	public function test_a_site_with_a_stored_key_that_is_not_valid_never_sees_it() {
		foreach ( array( 'expired', 'verification_failed' ) as $status ) {
			$GLOBALS['rtgodam_stub']['user_data'] = array(
				'valid_api_key'  => false,
				'api_key_status' => $status,
			);

			$this->assertFalse( Offer_Notice::is_free_or_trial_site( $this->user_data() ), $status );
		}
	}

	public function test_dismiss_rejects_a_bad_nonce_and_a_non_administrator_and_saves_for_an_administrator() {
		$this->stub_ajax();

		$GLOBALS['rtgodam_stub']['nonce_ok'] = false;
		$this->assertSame( 'bad nonce', $this->call_dismiss() );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['options'] );

		$GLOBALS['rtgodam_stub']['nonce_ok'] = true;
		$GLOBALS['rtgodam_stub']['caps']     = array( 'edit_posts' );
		$this->assertSame( 'error 403', $this->call_dismiss() );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['options'] );

		$GLOBALS['rtgodam_stub']['caps'] = array( 'manage_options' );
		$this->assertSame( 'success', $this->call_dismiss( $this->moment( '2026-10-29 10:00:00' ) ) );
		$this->assertNotEmpty( $GLOBALS['rtgodam_stub']['options']['rtgodam_offer_halloween_2026_dismissed'] );
	}

	public function test_render_prints_the_claim_link_with_its_tracking_and_nothing_for_a_paid_site() {
		$this->stub_render();
		$GLOBALS['rtgodam_stub']['active_plugins'] = array( 'gravityforms/gravityforms.php' );
		if ( ! class_exists( 'WooCommerce' ) ) {
			// phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
			eval( 'class WooCommerce {}' );
		}

		ob_start();
		Offer_Notice::render( 'dashboard', $this->moment( '2026-10-29 10:00:00' ), $this->user_data() );
		$html = ob_get_clean();

		$this->assertStringContainsString( 'utm_campaign=halloween-2026', $html );
		$this->assertStringContainsString( 'utm_content=dashboard-woocommerce', $html );
		$this->assertStringContainsString( 'Works with WooCommerce', $html );
		$this->assertStringContainsString( 'data-code="SPOOKY50"', $html );
		// Sized in the markup, so a missing or stale admin.css cannot blow the drawings up to full width.
		$this->assertStringContainsString( 'viewBox="0 0 92 104" width="92" height="104"', $html );
		$this->assertStringContainsString( 'viewBox="0 0 24 24" width="18" height="18"', $html );

		$this->connect( 'Starter', gmdate( 'Y-m-d H:i:s', time() + 300 * DAY_IN_SECONDS ) );
		ob_start();
		Offer_Notice::render( 'dashboard', $this->moment( '2026-10-29 10:00:00' ), $this->user_data() );
		$this->assertSame( '', trim( ob_get_clean() ) );
	}

	public function test_black_friday_shows_from_the_first_second_of_november_15_to_the_last_of_november_27() {
		foreach ( array( 'Asia/Kolkata', 'America/New_York' ) as $zone ) {
			$timezone                            = new \DateTimeZone( $zone );
			$GLOBALS['rtgodam_stub']['timezone'] = $timezone;

			$at = static fn( $time ) => new \DateTime( $time, $timezone );

			$this->assertFalse( Offer_Notice::should_show( $at( '2026-11-14 23:59:59' ), $this->user_data() ), $zone );
			$this->assertTrue( Offer_Notice::should_show( $at( '2026-11-15 00:00:00' ), $this->user_data() ), $zone );
			$this->assertTrue( Offer_Notice::should_show( $at( '2026-11-27 23:59:59' ), $this->user_data() ), $zone );
			$this->assertFalse( Offer_Notice::should_show( $at( '2026-11-28 00:00:00' ), $this->user_data() ), $zone );
			$this->assertSame( 'bfcm-2026', Offer_Notice::get_campaign( $at( '2026-11-20 12:00:00' ) ), $zone );
		}
	}

	public function test_nothing_shows_between_halloween_and_black_friday_or_on_a_later_year() {
		foreach ( array( '2026-11-10 00:00:00', '2026-11-12 12:00:00', '2026-11-14 23:59:59', '2027-11-20 12:00:00' ) as $time ) {
			$this->assertNull( Offer_Notice::get_campaign( $this->moment( $time ) ), $time );
			$this->assertFalse( Offer_Notice::should_show( $this->moment( $time ), $this->user_data() ), $time );
		}
	}

	public function test_a_halloween_dismissal_does_not_hide_black_friday_and_its_own_dismissal_does() {
		$GLOBALS['rtgodam_stub']['options']['rtgodam_offer_halloween_2026_dismissed'] = 1793170000;
		$this->assertTrue( Offer_Notice::should_show( $this->moment( '2026-11-20 12:00:00' ), $this->user_data() ) );

		$GLOBALS['rtgodam_stub']['options']['rtgodam_offer_bfcm_2026_dismissed'] = 1793170000;
		$this->assertFalse( Offer_Notice::should_show( $this->moment( '2026-11-20 12:00:00' ), $this->user_data() ) );
	}

	public function test_a_paid_site_never_sees_black_friday() {
		$this->connect( 'Starter', gmdate( 'Y-m-d H:i:s', time() + 300 * DAY_IN_SECONDS ) );

		$this->assertFalse( Offer_Notice::should_show( $this->moment( '2026-11-20 12:00:00' ), $this->user_data() ) );
	}

	public function test_black_friday_render_has_its_code_copy_and_deals_link_and_no_halloween_art() {
		$this->stub_render();
		$GLOBALS['rtgodam_stub']['active_plugins'] = array( 'lifterlms/lifterlms.php' );

		ob_start();
		Offer_Notice::render( 'media-library', $this->moment( '2026-11-20 12:00:00' ), $this->user_data() );
		$html = ob_get_clean();

		$this->assertStringContainsString( 'https://godam.io/deals/?utm_source=godam-plugin&utm_medium=admin-notice&utm_campaign=bfcm2026&utm_content=media-library-lifterlms', $html );
		$this->assertStringContainsString( 'data-code="BFCM2026"', $html );
		$this->assertStringContainsString( 'Black Friday offer', $html );
		$this->assertStringContainsString( 'Black Friday deal: <span>Get 50% off</span> GoDAM', $html );
		$this->assertStringContainsString( 'Ends November 27 at 11:59 p.m. 50% off your first month or year on any plan.', $html );
		$this->assertStringContainsString( 'rtgodam-offer-notice--no-art', $html );
		$this->assertStringNotContainsString( 'rtgodam-offer-notice__art', $html );
		$this->assertStringNotContainsString( 'rtgodam-offer-notice__pumpkin', $html );
		$this->assertStringNotContainsString( 'SPOOKY50', $html );
	}

	public function test_dismissing_during_black_friday_saves_only_its_own_option() {
		$this->stub_ajax();
		$GLOBALS['rtgodam_stub']['nonce_ok'] = true;

		$this->assertSame( 'success', $this->call_dismiss( $this->moment( '2026-11-20 12:00:00' ) ) );
		$this->assertSame( array( 'rtgodam_offer_bfcm_2026_dismissed' ), array_keys( $GLOBALS['rtgodam_stub']['options'] ) );
	}

	public function test_dismissing_between_campaigns_saves_nothing_and_the_ajax_call_without_a_time_still_works() {
		$this->stub_ajax();
		$GLOBALS['rtgodam_stub']['nonce_ok'] = true;

		$this->assertSame( 'success', $this->call_dismiss( $this->moment( '2026-11-12 12:00:00' ) ) );
		$this->assertSame( array(), $GLOBALS['rtgodam_stub']['options'] );

		// WordPress's do_action() passes '' to a one-argument callback: it must read the real clock, not fail.
		$this->assertSame( 'success', $this->call_dismiss( '' ) );
	}

	/**
	 * Stub the AJAX helpers dismiss() calls. Each one that ends a WordPress request throws instead.
	 */
	private function stub_ajax() {
		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		if ( ! function_exists( 'check_ajax_referer' ) ) {
			eval( 'function check_ajax_referer( $action, $arg ) { if ( empty( $GLOBALS["rtgodam_stub"]["nonce_ok"] ) ) { throw new \RuntimeException( "bad nonce" ); } return 1; }' );
		}
		if ( ! function_exists( 'wp_send_json_error' ) ) {
			eval( 'function wp_send_json_error( $data = null, $code = null ) { throw new \RuntimeException( "error " . $code ); }' );
		}
		if ( ! function_exists( 'update_option' ) ) {
			eval( 'function update_option( $option, $value, $autoload = null ) { $GLOBALS["rtgodam_stub"]["options"][ $option ] = $value; return true; }' );
		}
		if ( ! function_exists( 'wp_send_json_success' ) ) {
			eval( 'function wp_send_json_success( $data = null ) { throw new \RuntimeException( "success" ); }' );
		}
		// phpcs:enable Squiz.PHP.Eval.Discouraged
	}

	/**
	 * Run dismiss() and return how it ended.
	 *
	 * @param \DateTime|null $now The moment to dismiss at.
	 *
	 * @return string
	 */
	private function call_dismiss( $now = null ) {
		try {
			Offer_Notice::dismiss( $now );
		} catch ( \RuntimeException $e ) {
			return $e->getMessage();
		}
		return 'returned';
	}

	/**
	 * Stub the output helpers render() calls that the bootstrap does not have.
	 */
	private function stub_render() {
		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		if ( ! function_exists( 'esc_attr_e' ) ) {
			eval( 'function esc_attr_e( $text, $domain = "default" ) { echo htmlspecialchars( $text, ENT_QUOTES ); }' );
		}
		if ( ! function_exists( 'esc_html_e' ) ) {
			eval( 'function esc_html_e( $text, $domain = "default" ) { echo htmlspecialchars( $text, ENT_QUOTES ); }' );
		}
		if ( ! function_exists( 'wp_kses' ) ) {
			eval( 'function wp_kses( $content, $allowed_html ) { return $content; }' );
		}
		if ( ! function_exists( 'wp_create_nonce' ) ) {
			eval( 'function wp_create_nonce( $action = -1 ) { return "nonce"; }' );
		}
		// phpcs:enable Squiz.PHP.Eval.Discouraged
	}
}
