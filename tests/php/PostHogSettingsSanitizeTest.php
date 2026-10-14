<?php
/**
 * The settings save and an admin's PostHog choice.
 *
 * The REST route sanitizes the payload and merges it into the saved settings, so a client
 * that leaves the PostHog fields out must not reset them to the defaults.
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
 * @covers \RTGODAM\Inc\REST_API\Settings::sanitize_settings
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class PostHogSettingsSanitizeTest extends TestCase {

	/**
	 * The settings controller, built without its constructor.
	 *
	 * @var \RTGODAM\Inc\REST_API\Settings
	 */
	private $settings;

	/**
	 * Load the class under test and stub the slice of WordPress it touches.
	 */
	protected function setUp(): void {
		parent::setUp();

		$root = dirname( __DIR__, 2 );
		require_once $root . '/inc/classes/enums/class-api-key-status.php';
		require_once $root . '/inc/classes/enums/class-http-status-code.php';
		require_once $root . '/inc/classes/rest-api/class-settings.php';

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		eval( 'function esc_url_raw( $url ) { return (string) $url; }' );
		eval( 'function sanitize_title( $title ) { return strtolower( (string) $title ); }' );
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		$this->settings = ( new \ReflectionClass( \RTGODAM\Inc\REST_API\Settings::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * What a save does to the three PostHog fields, for each thing a client can send.
	 *
	 * @dataProvider payloads
	 *
	 * @param array $sent     The `general` section the client sent.
	 * @param array $expected The PostHog fields that come out, and only those.
	 */
	public function test_only_the_posthog_fields_the_client_sent_come_out( $sent, $expected ) {
		$result = $this->settings->sanitize_settings( $this->payload( array( 'general' => $sent ) ) );

		$posthog = array_intersect_key(
			$result['general'],
			array_flip( array( 'enable_posthog_tracking', 'posthog_initialized', 'posthog_consent_source' ) )
		);

		$this->assertSame( $expected, $posthog );
	}

	/**
	 * Payloads a client can send.
	 *
	 * @return array<string, array>
	 */
	public function payloads() {
		return array(
			'nothing about PostHog'          => array(
				array( 'enable_folder_organization' => true ),
				array(),
			),
			'the two booleans only'          => array(
				array(
					'enable_posthog_tracking' => false,
					'posthog_initialized'     => true,
				),
				array(
					'enable_posthog_tracking' => false,
					'posthog_initialized'     => true,
				),
			),
			'all three, an explicit opt-out' => array(
				array(
					'enable_posthog_tracking' => false,
					'posthog_initialized'     => true,
					'posthog_consent_source'  => 'explicit',
				),
				array(
					'enable_posthog_tracking' => false,
					'posthog_initialized'     => true,
					'posthog_consent_source'  => 'explicit',
				),
			),
			'a key-made opt-in'              => array(
				array( 'posthog_consent_source' => 'api_key' ),
				array( 'posthog_consent_source' => 'api_key' ),
			),
			'an unknown source'              => array(
				array( 'posthog_consent_source' => 'anything-else' ),
				array( 'posthog_consent_source' => '' ),
			),
			'a source that is not a string'  => array(
				array( 'posthog_consent_source' => array( 'explicit' ) ),
				array( 'posthog_consent_source' => '' ),
			),
			'booleans sent as strings'       => array(
				array(
					'enable_posthog_tracking' => 'false',
					'posthog_initialized'     => '1',
				),
				array(
					'enable_posthog_tracking' => false,
					'posthog_initialized'     => true,
				),
			),
		);
	}

	/**
	 * A payload with no `general` section at all leaves the PostHog fields alone too.
	 */
	public function test_a_payload_without_a_general_section_carries_no_posthog_fields() {
		$result = $this->settings->sanitize_settings( $this->payload() );

		$this->assertArrayNotHasKey( 'enable_posthog_tracking', $result['general'] );
		$this->assertArrayNotHasKey( 'posthog_initialized', $result['general'] );
		$this->assertArrayNotHasKey( 'posthog_consent_source', $result['general'] );
	}

	/**
	 * A payload the sanitizer can read without notices.
	 *
	 * The sanitizer reads `video.video_slug` without a default of its own, so every payload carries one.
	 *
	 * @param array $sections The sections the test cares about.
	 * @return array
	 */
	private function payload( $sections = array() ) {
		return array_merge( array( 'video' => array( 'video_slug' => 'video' ) ), $sections );
	}
}
