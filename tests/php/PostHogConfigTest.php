<?php
/**
 * What the admin screens are told about PostHog.
 *
 * `pages/utils/posthog.js` starts PostHog only when the page's `posthogConfig.enabled`
 * is '1' or 1, so this is the PHP half of that contract: `enabled` must be 0 for
 * every site that has not opted in, and 1 only for one that has.
 *
 * @see https://github.com/rtCamp/godam-core/issues/936
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * Runs in separate processes, like the other tests that stub WordPress functions.
 *
 * @covers \RTGODAM\Inc\Pages::get_posthog_config
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class PostHogConfigTest extends TestCase {

	/**
	 * Load the class under test and stub the slice of WordPress it touches.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array();

		require_once dirname( __DIR__, 2 ) . '/inc/classes/class-pages.php';

		// The site details that go with an opted-in config. Their values do not matter here.
		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		eval( 'function get_plugins() { return array( "a/a.php" => array(), "b/b.php" => array() ); }' );
		eval( 'function get_locale() { return "en_US"; }' );
		eval( 'function count_users() { return array( "total_users" => 3 ); }' );
		eval( 'function wp_unslash( $value ) { return $value; }' );
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		$GLOBALS['wp_version'] = '6.8';
		$GLOBALS['wpdb']       = new class() {

			/** @return string */
			public function db_version() {
				return '8.0.30';
			}
		};
	}

	/**
	 * Every state short of an explicit opt-in tells the page not to start PostHog.
	 *
	 * @dataProvider not_opted_in
	 *
	 * @param mixed $settings What `rtgodam-settings` holds, or null for no option at all.
	 */
	public function test_the_page_is_told_not_to_track_without_an_opt_in( $settings ) {
		if ( null !== $settings ) {
			$GLOBALS['rtgodam_stub']['options']['rtgodam-settings'] = $settings;
		}

		$config = $this->get_config();

		$this->assertSame( 0, $config['enabled'] );
		$this->assertArrayNotHasKey( 'properties', $config, 'Site details were handed to the page without an opt-in.' );
	}

	/**
	 * Sites that have not opted in.
	 *
	 * @return array<string, array>
	 */
	public function not_opted_in() {
		return array(
			'no settings saved yet' => array( null ),
			'no general section'    => array( array() ),
			'never chose'           => array(
				array(
					'general' => array(
						'enable_posthog_tracking' => false,
						'posthog_initialized'     => false,
					),
				),
			),
			'opted out'             => array(
				array(
					'general' => array(
						'enable_posthog_tracking' => false,
						'posthog_initialized'     => true,
					),
				),
			),
		);
	}

	/**
	 * An opt-in is the one state that tells the page to start PostHog, and it sends the site details.
	 */
	public function test_the_page_is_told_to_track_after_an_opt_in() {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-settings'] = array(
			'general' => array(
				'enable_posthog_tracking' => true,
				'posthog_initialized'     => true,
			),
		);

		$config = $this->get_config();

		$this->assertSame( 1, $config['enabled'] );
		$this->assertSame( 'https://us.i.posthog.com', $config['host'] );
		$this->assertSame(
			array( 'php_version', 'mysql_version', 'server_software', 'wp_version', 'site_language', 'active_plugins_count', 'total_plugins_count', 'user_count' ),
			array_keys( $config['properties'] ),
			'The readme lists exactly these site details; change both together.'
		);
	}

	/**
	 * Call the private config builder on a constructor-less instance.
	 *
	 * @return array
	 */
	private function get_config() {
		$pages  = ( new \ReflectionClass( \RTGODAM\Inc\Pages::class ) )->newInstanceWithoutConstructor();
		$method = new \ReflectionMethod( $pages, 'get_posthog_config' );

		return $method->invoke( $pages );
	}
}
