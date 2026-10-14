<?php
/**
 * What the admin screens are told about PostHog.
 *
 * `pages/utils/posthog.js` starts PostHog only when the page's `posthogConfig.enabled`
 * is '1' or 1, so this is the PHP half of that contract. Tracking runs only while
 * it is switched on AND either an admin said so (the notice's Allow or the Help page
 * toggle) or the site has a GoDAM API key, which is what switched it on the first time.
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

		$root = dirname( __DIR__, 2 );
		require_once $root . '/inc/classes/enums/class-api-key-status.php';
		require_once $root . '/inc/helpers/class-api-key.php';
		require_once $root . '/inc/classes/class-pages.php';

		// The site details that go with a running config. Their values do not matter here.
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
	 * Whether the page is told to start PostHog, for every state a site can be in.
	 *
	 * @dataProvider states
	 *
	 * @param mixed $general  The `general` settings, or null for no settings saved yet.
	 * @param bool  $has_key  Whether the site has a GoDAM API key.
	 * @param int   $expected The `enabled` value the page should get.
	 */
	public function test_what_the_page_is_told( $general, $has_key, $expected ) {
		if ( null !== $general ) {
			$GLOBALS['rtgodam_stub']['options']['rtgodam-settings'] = array( 'general' => $general );
		}
		if ( $has_key ) {
			$GLOBALS['rtgodam_stub']['options']['rtgodam-api-key'] = 'test-api-key';
		}

		$config = $this->get_config();

		$this->assertSame( $expected, $config['enabled'] );
		$this->assertSame( 1 === $expected, array_key_exists( 'properties', $config ), 'Site details go to the page only while tracking runs.' );
	}

	/**
	 * Every state a site can be in.
	 *
	 * @return array<string, array>
	 */
	public function states() {
		$on_by_key    = array(
			'enable_posthog_tracking' => true,
			'posthog_initialized'     => true,
			'posthog_consent_source'  => 'api_key',
		);
		$on_by_admin  = array(
			'enable_posthog_tracking' => true,
			'posthog_initialized'     => true,
			'posthog_consent_source'  => 'explicit',
		);
		$old_site     = array(
			'enable_posthog_tracking' => true,
			'posthog_initialized'     => true,
		);
		$never_chosen = array(
			'enable_posthog_tracking' => false,
			'posthog_initialized'     => false,
		);
		$opted_out    = array_merge( $on_by_admin, array( 'enable_posthog_tracking' => false ) );

		return array(
			'nothing saved, no key'                     => array( null, false, 0 ),
			'never chose, no key'                       => array( $never_chosen, false, 0 ),
			'never chose, with a key'                   => array( $never_chosen, true, 0 ),
			'switched on by the key, key still there'   => array( $on_by_key, true, 1 ),
			'switched on by the key, then key removed'  => array( $on_by_key, false, 0 ),
			'allowed by an admin, no key'               => array( $on_by_admin, false, 1 ),
			'allowed by an admin, with a key'           => array( $on_by_admin, true, 1 ),
			'opted out by an admin, no key'             => array( $opted_out, false, 0 ),
			'opted out by an admin, with a key'         => array( $opted_out, true, 0 ),
			'old site (no source recorded), with a key' => array( $old_site, true, 1 ),
			'old site (no source recorded), no key'     => array( $old_site, false, 0 ),
			'an unknown source counts as not explicit'  => array( array_merge( $old_site, array( 'posthog_consent_source' => 'something-else' ) ), false, 0 ),
			'an empty stored value does not switch on'  => array( array_merge( $on_by_admin, array( 'enable_posthog_tracking' => '' ) ), true, 0 ),
		);
	}

	/**
	 * The page gets PostHog's address and exactly the site details the readme lists.
	 */
	public function test_the_config_carries_the_host_and_the_site_details_the_readme_lists() {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-settings'] = array(
			'general' => array(
				'enable_posthog_tracking' => true,
				'posthog_initialized'     => true,
				'posthog_consent_source'  => 'explicit',
			),
		);

		$config = $this->get_config();

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
