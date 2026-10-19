<?php
/**
 * The one-time upgrade step that asks sites with PostHog tracking on to choose again.
 *
 * Before GoDAM 2.4.0 a verified API key switched tracking on without asking, so a site where
 * tracking is on may never have agreed to it.
 *
 * @see https://github.com/rtCamp/godam-core/issues/1068
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Migrations\Posthog_Consent_Reset;

/**
 * Runs in separate processes, like the other tests that stub WordPress functions.
 *
 * @covers \RTGODAM\Inc\Migrations\Posthog_Consent_Reset::maybe_run
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class PostHogConsentResetTest extends TestCase {

	/**
	 * Load the class under test and stub the slice of WordPress it touches.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array();

		require_once dirname( __DIR__, 2 ) . '/inc/classes/migrations/class-posthog-consent-reset.php';

		// phpcs:ignore Squiz.PHP.Eval.Discouraged -- test-only stub, isolated process.
		eval( 'function update_option( $key, $value ) { $GLOBALS["rtgodam_stub"]["options"][ $key ] = $value; return true; }' );
	}

	/**
	 * Every site where tracking is on is asked again: tracking goes off and the choice is cleared.
	 *
	 * That covers a site the old code switched on and a site where an admin clicked Allow, which
	 * the stored settings cannot tell apart.
	 *
	 * @dataProvider tracking_on
	 *
	 * @param array $general The stored `general` settings.
	 */
	public function test_a_site_with_tracking_on_is_asked_again( $general ) {
		$this->set_settings( array( 'general' => array_merge( array( 'enable_folder_organization' => true ), $general ) ) );

		$this->assertTrue( Posthog_Consent_Reset::maybe_run() );

		$saved = get_option( 'rtgodam-settings' )['general'];
		$this->assertFalse( $saved['enable_posthog_tracking'], 'Tracking is still on.' );
		$this->assertFalse( $saved['posthog_initialized'], 'The choice was not cleared, so the notice would stay hidden.' );
		$this->assertTrue( $saved['enable_folder_organization'], 'Another general setting was lost.' );
	}

	/**
	 * Sites where tracking is on.
	 *
	 * @return array<string, array>
	 */
	public function tracking_on() {
		return array(
			'switched on by the old key logic, or by Allow' => array(
				array(
					'enable_posthog_tracking' => true,
					'posthog_initialized'     => true,
				),
			),
			'on with no choice recorded' => array( array( 'enable_posthog_tracking' => true ) ),
		);
	}

	/**
	 * A site that opted out, or never chose, is left exactly as it is.
	 *
	 * @dataProvider tracking_off
	 *
	 * @param mixed $settings What `rtgodam-settings` holds, or null for no option at all.
	 */
	public function test_a_site_with_tracking_off_is_left_alone( $settings ) {
		if ( null !== $settings ) {
			$this->set_settings( $settings );
		}

		$this->assertTrue( Posthog_Consent_Reset::maybe_run() );

		$this->assertSame( null === $settings ? false : $settings, get_option( 'rtgodam-settings' ) );
		$this->assertSame( 'done', get_option( Posthog_Consent_Reset::OPTION_KEY ), 'The run was not recorded, so a later Allow could be reset.' );
	}

	/**
	 * Sites where tracking is off.
	 *
	 * @return array<string, array>
	 */
	public function tracking_off() {
		return array(
			'nothing saved yet'       => array( null ),
			'never chose'             => array(
				array(
					'general' => array(
						'enable_posthog_tracking' => false,
						'posthog_initialized'     => false,
					),
				),
			),
			'opted out'               => array(
				array(
					'general' => array(
						'enable_posthog_tracking' => false,
						'posthog_initialized'     => true,
					),
				),
			),
			'the text "false" stored as the switch, which the pages read as off' => array(
				array(
					'general' => array(
						'enable_posthog_tracking' => 'false',
						'posthog_initialized'     => true,
					),
				),
			),
			'general is not an array' => array( array( 'general' => 'on' ) ),
		);
	}

	/**
	 * The migration runner knows about it, under a version the update reaches, and calls the method this class defines.
	 *
	 * Every other test here calls maybe_run() directly, so without this a wrong map entry would leave them all green
	 * while the reset never ran.
	 */
	public function test_the_migration_runner_runs_it() {
		require_once dirname( __DIR__, 2 ) . '/inc/classes/migrations/class-runner.php';

		$map = ( new \ReflectionClass( \RTGODAM\Inc\Migrations\Runner::class ) )->getProperty( 'migrations' );
		$map->setAccessible( true );
		$migrations = $map->getValue();

		$this->assertArrayHasKey( '2.4.0', $migrations, 'No migration batch for the release this ships in.' );
		$this->assertContains( Posthog_Consent_Reset::class, $migrations['2.4.0'] );
		$this->assertTrue( ( new \ReflectionMethod( Posthog_Consent_Reset::class, 'maybe_run' ) )->isStatic(), 'The runner calls $class::maybe_run().' );
	}

	/**
	 * It runs once. A choice an admin makes afterwards is never reset by a second run.
	 */
	public function test_it_runs_only_once() {
		$this->set_settings(
			array(
				'general' => array(
					'enable_posthog_tracking' => true,
					'posthog_initialized'     => true,
				),
			)
		);
		Posthog_Consent_Reset::maybe_run();

		// The admin clicks Allow in the notice.
		$allowed = array(
			'general' => array(
				'enable_posthog_tracking' => true,
				'posthog_initialized'     => true,
			),
		);
		$this->set_settings( $allowed );

		$this->assertTrue( Posthog_Consent_Reset::maybe_run() );

		$this->assertSame( $allowed, get_option( 'rtgodam-settings' ), 'The second run undid the admin\'s choice.' );
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
