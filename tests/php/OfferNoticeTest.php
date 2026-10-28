<?php
/**
 * The Halloween 2026 offer notice: who sees it, until when, and which message.
 *
 * Joel's rules from the 2.5.2 release thread: a WP-admin notice, only for free
 * and trial sites (never paid), gone after the offer ends (November 9), and a
 * message picked by the integrations the site uses.
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
			'user_data'      => array( 'valid_api_key' => false ),
		);

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

		$GLOBALS['rtgodam_stub']['options'][ Offer_Notice::DISMISS_OPTION ] = 1793170000;
		$this->assertFalse( Offer_Notice::should_show( $this->moment( '2026-10-29 10:00:00' ), $this->user_data() ) );
	}

	public function test_lifterlms_wins_over_every_other_integration() {
		$GLOBALS['rtgodam_stub']['active_plugins'] = array( 'gravityforms/gravityforms.php', 'js_composer/js_composer.php', 'lifterlms/lifterlms.php' );

		$integrations = Offer_Notice::get_active_integrations();
		$message      = Offer_Notice::get_message( $integrations );

		$this->assertSame( 'lifterlms', $message['key'] );
		$this->assertStringContainsString( 'LifterLMS course videos', $message['message'] );
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
		$this->assertStringContainsString( 'WPForms and Fluent Forms forms', $with['message'] );
		$this->assertStringContainsString( 'recorder field', $with['message'] );

		$GLOBALS['rtgodam_stub']['active_plugins'] = array( 'contact-form-7/wp-contact-form-7.php' );
		$without                                   = Offer_Notice::get_message( Offer_Notice::get_active_integrations() );
		$this->assertStringContainsString( 'Contact Form 7 forms', $without['message'] );
		$this->assertStringNotContainsString( 'recorder', $without['message'] );
	}

	public function test_no_supported_plugin_gets_the_general_line() {
		$message = Offer_Notice::get_message( Offer_Notice::get_active_integrations() );

		$this->assertSame( 'general', $message['key'] );
		$this->assertStringContainsString( 'Video hosting, transcoding and analytics', $message['message'] );
	}
}
