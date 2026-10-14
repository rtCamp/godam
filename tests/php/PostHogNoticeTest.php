<?php
/**
 * The PostHog consent notice on the WordPress Dashboard.
 *
 * Tracking starts only after an admin answers this notice (or sets the toggle on
 * the Help page). It used to be hidden for any site that already had an API key,
 * so those admins were never asked.
 *
 * @see https://github.com/rtCamp/godam-core/issues/1068
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * Runs in separate processes, like the other tests that load the admin classes
 * and need their own function stubs.
 *
 * @covers RTGODAM_Transcoder_Admin::posthog_tracking_notice
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class PostHogNoticeTest extends TestCase {

	/**
	 * The admin class, built without its constructor (which loads the transcoder handler).
	 *
	 * @var \RTGODAM_Transcoder_Admin
	 */
	private $admin;

	/**
	 * Load the class under test and stub the slice of WordPress it touches.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array(
			'caps'   => array( 'manage_options' ),
			'screen' => 'dashboard',
		);

		$root = dirname( __DIR__, 2 );
		require_once $root . '/inc/classes/enums/class-api-key-status.php';
		require_once $root . '/inc/helpers/class-api-key.php';
		require_once $root . '/admin/class-rtgodam-transcoder-admin.php';

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		eval( 'function get_current_screen() { return (object) array( "id" => $GLOBALS["rtgodam_stub"]["screen"] ); }' );
		eval( 'function wp_nonce_url( $url, $action = -1 ) { return $url . "&_wpnonce=test"; }' );
		eval( 'function wp_kses( $content, $allowed_html ) { return $content; }' );
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		$this->admin = ( new \ReflectionClass( \RTGODAM_Transcoder_Admin::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * The fix: an admin who already has an API key is asked.
	 *
	 * Admins who set GoDAM up through onboarding have a key from the start, and the
	 * notice used to skip every one of them.
	 */
	public function test_the_notice_shows_on_the_dashboard_when_a_key_exists_and_no_choice_was_made() {
		$this->set_settings( array() );
		$this->set_api_key( 'test-api-key' );

		$html = $this->render_notice();

		$this->assertStringContainsString( 'Allow', $html, 'The Allow button is missing.' );
		$this->assertStringContainsString( 'No thanks', $html, 'The No thanks button is missing.' );
		$this->assertStringContainsString( 'godam_tracker_optin', $html );
		$this->assertStringContainsString( 'godam_tracker_optout', $html );
	}

	/**
	 * A site with no key yet is still asked, as before.
	 */
	public function test_the_notice_shows_on_the_dashboard_when_there_is_no_key_and_no_choice() {
		$this->set_settings( array() );

		$this->assertStringContainsString( 'No thanks', $this->render_notice() );
	}

	/**
	 * Once an admin has chosen, in either direction, the notice stays away, key or no key.
	 *
	 * @dataProvider recorded_choices
	 *
	 * @param bool $tracking Whether the admin chose to allow tracking.
	 * @param bool $has_key  Whether the site has an API key.
	 */
	public function test_the_notice_is_hidden_once_a_choice_is_recorded( $tracking, $has_key ) {
		$this->set_settings(
			array(
				'general' => array(
					'enable_posthog_tracking' => $tracking,
					'posthog_initialized'     => true,
				),
			)
		);
		if ( $has_key ) {
			$this->set_api_key( 'test-api-key' );
		}

		$this->assertSame( '', $this->render_notice() );
	}

	/**
	 * Allowed or declined, with and without a key.
	 *
	 * @return array<string, array>
	 */
	public function recorded_choices() {
		return array(
			'allowed, with a key'     => array( true, true ),
			'declined, with a key'    => array( false, true ),
			'allowed, without a key'  => array( true, false ),
			'declined, without a key' => array( false, false ),
		);
	}

	/**
	 * It is a Dashboard notice: GoDAM's own screens and every other admin screen stay clear of it.
	 */
	public function test_the_notice_shows_only_on_the_dashboard() {
		$this->set_settings( array() );
		$this->set_api_key( 'test-api-key' );
		$GLOBALS['rtgodam_stub']['screen'] = 'toplevel_page_rtgodam';

		$this->assertSame( '', $this->render_notice() );
	}

	/**
	 * Only an administrator can answer it, so only an administrator sees it.
	 */
	public function test_the_notice_is_hidden_from_users_who_cannot_manage_options() {
		$this->set_settings( array() );
		$this->set_api_key( 'test-api-key' );
		$GLOBALS['rtgodam_stub']['caps'] = array( 'edit_posts' );

		$this->assertSame( '', $this->render_notice() );
	}

	/**
	 * Run the notice and return what it printed.
	 *
	 * @return string
	 */
	private function render_notice() {
		ob_start();
		$this->admin->posthog_tracking_notice();

		return (string) ob_get_clean();
	}

	/**
	 * Store the `rtgodam-settings` option for the test.
	 *
	 * @param array $settings The option value.
	 */
	private function set_settings( $settings ) {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-settings'] = $settings;
	}

	/**
	 * Store an API key for the test.
	 *
	 * @param string $key The key.
	 */
	private function set_api_key( $key ) {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key'] = $key;
	}
}
