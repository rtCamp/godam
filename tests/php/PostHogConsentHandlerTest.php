<?php
/**
 * The notice's Allow and No thanks links.
 *
 * Only an admin's click sets the PostHog choice from the notice.
 *
 * @see https://github.com/rtCamp/godam-core/issues/1068
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * Runs in separate processes, like the other tests that stub WordPress functions.
 *
 * @covers RTGODAM_Transcoder_Admin::handle_posthog_tracking_action
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class PostHogConsentHandlerTest extends TestCase {

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
			'caps'        => array( 'manage_options' ),
			'nonce_valid' => true,
		);
		$_GET                    = array();

		require_once dirname( __DIR__, 2 ) . '/admin/class-rtgodam-transcoder-admin.php';

		// The handler ends with a redirect and exit(); the stub throws so the test can carry on.
		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		eval( 'function update_option( $key, $value ) { $GLOBALS["rtgodam_stub"]["options"][ $key ] = $value; return true; }' );
		eval( 'function wp_verify_nonce( $nonce, $action = -1 ) { return ! empty( $GLOBALS["rtgodam_stub"]["nonce_valid"] ); }' );
		eval( 'function wp_unslash( $value ) { return $value; }' );
		eval( 'function esc_url_raw( $url ) { return (string) $url; }' );
		eval( 'function remove_query_arg( $keys, $url = "" ) { return "redirected"; }' );
		eval( 'function wp_safe_redirect( $url ) { throw new \RuntimeException( "redirected" ); }' );
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		$this->admin = ( new \ReflectionClass( \RTGODAM_Transcoder_Admin::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * Allow switches tracking on and records the choice.
	 */
	public function test_allow_records_an_opt_in() {
		$_GET = array(
			'godam_tracker_optin' => 'true',
			'_wpnonce'            => 'valid',
		);

		$this->run_handler();

		$this->assertSame(
			array(
				'enable_posthog_tracking' => true,
				'posthog_initialized'     => true,
			),
			get_option( 'rtgodam-settings' )['general']
		);
	}

	/**
	 * No thanks keeps tracking off and records the choice.
	 */
	public function test_no_thanks_records_an_opt_out() {
		$_GET = array(
			'godam_tracker_optout' => 'true',
			'_wpnonce'             => 'valid',
		);

		$this->run_handler();

		$this->assertSame(
			array(
				'enable_posthog_tracking' => false,
				'posthog_initialized'     => true,
			),
			get_option( 'rtgodam-settings' )['general']
		);
	}

	/**
	 * Allow leaves the other general settings as they were.
	 */
	public function test_allow_keeps_the_other_general_settings() {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-settings'] = array( 'general' => array( 'enable_folder_organization' => true ) );
		$_GET = array(
			'godam_tracker_optin' => 'true',
			'_wpnonce'            => 'valid',
		);

		$this->run_handler();

		$this->assertTrue( get_option( 'rtgodam-settings' )['general']['enable_folder_organization'] );
	}

	/**
	 * A link with a bad nonce, or from a user who cannot manage options, changes nothing.
	 *
	 * @dataProvider refused_requests
	 *
	 * @param bool $nonce_valid Whether the nonce checks out.
	 * @param array $caps       The capabilities the user has.
	 */
	public function test_a_request_that_is_not_an_admins_click_changes_nothing( $nonce_valid, $caps ) {
		$GLOBALS['rtgodam_stub']['nonce_valid'] = $nonce_valid;
		$GLOBALS['rtgodam_stub']['caps']        = $caps;
		$_GET                                   = array(
			'godam_tracker_optin' => 'true',
			'_wpnonce'            => 'whatever',
		);

		$this->run_handler();

		$this->assertFalse( get_option( 'rtgodam-settings' ) );
	}

	/**
	 * The refused requests.
	 *
	 * @return array<string, array>
	 */
	public function refused_requests() {
		return array(
			'a bad nonce'               => array( false, array( 'manage_options' ) ),
			'a user without the rights' => array( true, array( 'edit_posts' ) ),
		);
	}

	/**
	 * Run the handler, treating the redirect it ends with as the normal ending.
	 */
	private function run_handler() {
		try {
			$this->admin->handle_posthog_tracking_action();
		} catch ( \RuntimeException $e ) {
			$this->assertSame( 'redirected', $e->getMessage() );
		}
	}
}
