<?php
/**
 * An admin's PostHog choice has to survive an API key save.
 *
 * `rtgodam_verify_api_key()` used to switch tracking back on every time a key
 * was saved, even for an admin who had turned it off. It now only auto-enables
 * tracking when the admin has never made a choice (`posthog_initialized` is empty).
 *
 * @see https://github.com/rtCamp/godam-core/issues/936
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * Runs in separate processes: admin/godam-transcoder-functions.php declares
 * functions at file scope, and EarlyTranslationHooksTest needs to be the first to load it.
 *
 * @covers ::rtgodam_verify_api_key
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class PostHogOptOutTest extends TestCase {

	private const API_KEY = 'test-api-key';

	/**
	 * Load the code under test and stub the slice of WordPress it touches.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub']     = array();
		$GLOBALS['rtgodam_usage']    = array();
		$GLOBALS['rtgodam_requests'] = array();

		$root = dirname( __DIR__, 2 );
		require_once $root . '/inc/classes/enums/class-api-key-status.php';
		require_once $root . '/inc/helpers/class-api-key.php';
		require_once $root . '/admin/godam-transcoder-functions.php';

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		eval( 'function update_option( $key, $value ) { $GLOBALS["rtgodam_stub"]["options"][ $key ] = $value; return true; }' );
		eval( 'function delete_option( $key ) { unset( $GLOBALS["rtgodam_stub"]["options"][ $key ] ); return true; }' );
		eval( 'function get_site_url() { return "https://example.test"; }' );
		eval( 'function get_bloginfo( $show = "" ) { return "Example site"; }' );

		// Stands in for GoDAM Central: every request is recorded and answered with the canned response.
		eval( 'function wp_safe_remote_post( $url, $args = array() ) { $GLOBALS["rtgodam_requests"][] = $url; return $GLOBALS["rtgodam_stub"]["http"]; }' );

		// The usage refresh after a save talks to Central too; the test only needs to know it ran.
		eval(
			'class RTGODAM_Transcoder_Handler {
				public function __construct( $register_hooks = true ) {}
				public function update_usage( $api_key ) { $GLOBALS["rtgodam_usage"][] = $api_key; }
			}'
		);
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		// Central accepts the key.
		$GLOBALS['rtgodam_stub']['http'] = array(
			'code' => 200,
			'body' => wp_json_encode( array( 'message' => array( 'account_token' => 'test-token' ) ) ),
		);
	}

	/**
	 * Saving an API key again must leave an opt-out alone.
	 *
	 * This is the bug: the save switched `enable_posthog_tracking` back to true.
	 */
	public function test_saving_the_api_key_keeps_an_opt_out() {
		$opted_out = $this->opted_out_settings();
		$this->set_settings( $opted_out );

		$result = rtgodam_verify_api_key( self::API_KEY, true );

		$this->assertSame( 'success', $result['status'] ?? null, 'The save did not go through, so it proves nothing.' );
		$this->assertSame( self::API_KEY, get_option( 'rtgodam-api-key' ), 'The key was not stored.' );
		$this->assertSame( array( self::API_KEY ), $GLOBALS['rtgodam_usage'], 'The usage refresh after a save did not run.' );
		$this->assertSame( $opted_out, get_option( 'rtgodam-settings' ), 'Saving the API key changed the PostHog choice.' );
		$this->assertFalse( get_option( 'rtgodam-settings' )['general']['enable_posthog_tracking'] );
	}

	/**
	 * A plain re-check of a key, with nothing to save, must leave an opt-out alone too.
	 */
	public function test_verifying_the_api_key_keeps_an_opt_out() {
		$opted_out = $this->opted_out_settings();
		$this->set_settings( $opted_out );

		$result = rtgodam_verify_api_key( self::API_KEY );

		$this->assertSame( 'success', $result['status'] ?? null );
		$this->assertSame( $opted_out, get_option( 'rtgodam-settings' ), 'Verifying the API key changed the PostHog choice.' );
		$this->assertFalse( get_option( 'rtgodam-api-key' ), 'A check with nothing to save must not store the key.' );
		$this->assertSame( array(), $GLOBALS['rtgodam_usage'], 'A check with nothing to save must not refresh the usage.' );
	}

	/**
	 * Saving a key keeps an opt-in as it was, and leaves the other settings alone.
	 */
	public function test_saving_the_api_key_keeps_an_opt_in() {
		$opted_in                                       = $this->opted_out_settings();
		$opted_in['general']['enable_posthog_tracking'] = true;
		$this->set_settings( $opted_in );

		$result = rtgodam_verify_api_key( self::API_KEY, true );

		$this->assertSame( 'success', $result['status'] ?? null, 'The save did not go through, so it proves nothing.' );
		$this->assertSame( $opted_in, get_option( 'rtgodam-settings' ) );
	}

	/**
	 * A site that never chose still has tracking switched on by its first verified key.
	 *
	 * That is the existing default, not something this fix changes. It holds for a
	 * plain re-check of the key as well as for a save.
	 *
	 * @dataProvider never_chosen_settings
	 *
	 * @param mixed $settings What `rtgodam-settings` holds before the first verified key, or null for no option at all.
	 * @param bool  $save     Whether the key is saved or only checked.
	 */
	public function test_first_verified_key_enables_tracking_when_no_choice_was_made( $settings, $save ) {
		if ( null !== $settings ) {
			$this->set_settings( $settings );
		}

		$result = rtgodam_verify_api_key( self::API_KEY, $save );

		$this->assertSame( 'success', $result['status'] ?? null );
		$saved = get_option( 'rtgodam-settings' );
		$this->assertTrue( $saved['general']['enable_posthog_tracking'] );
		$this->assertTrue( $saved['general']['posthog_initialized'] );
	}

	/**
	 * The states in which an admin has not yet made a PostHog choice, each for a save and for a plain check.
	 *
	 * @return array<string, array>
	 */
	public function never_chosen_settings() {
		$states = array(
			'no settings saved yet'       => null,
			'settings without a general'  => array(),
			'general without a choice'    => array( 'general' => array( 'enable_posthog_tracking' => false ) ),
			'choice recorded as not made' => array(
				'general' => array(
					'enable_posthog_tracking' => false,
					'posthog_initialized'     => false,
				),
			),
		);

		$cases = array();
		foreach ( $states as $name => $settings ) {
			$cases[ $name . ', key saved' ]   = array( $settings, true );
			$cases[ $name . ', key checked' ] = array( $settings, false );
		}

		return $cases;
	}

	/**
	 * A key Central rejects touches nothing, opt-out included.
	 */
	public function test_a_rejected_key_does_not_change_the_posthog_choice() {
		$opted_out = $this->opted_out_settings();
		$this->set_settings( $opted_out );

		$GLOBALS['rtgodam_stub']['http'] = array(
			'code' => 200,
			'body' => wp_json_encode( array( 'message' => array( 'error' => 'Invalid API key' ) ) ),
		);

		$result = rtgodam_verify_api_key( self::API_KEY, true );

		$this->assertInstanceOf( \WP_Error::class, $result );
		$this->assertSame( $opted_out, get_option( 'rtgodam-settings' ) );
	}

	/**
	 * Settings as they are after an admin clicked "No thanks" or flipped the Help page toggle off.
	 *
	 * @return array
	 */
	private function opted_out_settings() {
		return array(
			'general' => array(
				'enable_posthog_tracking'    => false,
				'posthog_initialized'        => true,
				'enable_folder_organization' => true,
			),
		);
	}

	/**
	 * Store the `rtgodam-settings` option for the test.
	 *
	 * @param array $settings The option value.
	 */
	private function set_settings( $settings ) {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-settings'] = $settings;
	}
}
