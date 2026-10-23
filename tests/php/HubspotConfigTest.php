<?php
/**
 * HubSpot resolves which connection source is in effect, and whitelists its
 * saved settings.
 *
 * HubSpot can be connected two ways and the admin picks one: GoDAM Central or the
 * "HubSpot All-In-One Marketing" (leadin) plugin. `Hubspot::get_active_source()`
 * returns the chosen source only when it is actually connected, and collapses to
 * Central when the plugin is not active (so Central is the only method then).
 * These drive that resolution and the settings sanitiser with stubbed options and
 * active-plugin state.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Hubspot;

require_once dirname( __DIR__, 2 ) . '/inc/classes/class-hubspot.php';

/**
 * @covers \RTGODAM\Inc\Hubspot
 */
class HubspotConfigTest extends TestCase {

	/**
	 * Start every case with no options and no active plugins.
	 */
	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_stub'] = array(
			'options'        => array(),
			'active_plugins' => array(),
		);
	}

	/**
	 * Leave no stub state behind.
	 */
	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Set the chosen source (the site-level HubSpot settings).
	 *
	 * @param string $source `central` or `leadin`.
	 * @param bool   $enable Whether the integration is on.
	 */
	private function set_settings( string $source, bool $enable = true ): void {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-settings'] = array(
			'integrations' => array(
				'hubspot' => array(
					'enable' => $enable,
					'source' => $source,
				),
			),
		);
	}

	/**
	 * Put a HubSpot block into the cached licence response (Central source).
	 *
	 * @param array $hubspot The `map.hubspot` block.
	 */
	private function set_central( array $hubspot ): void {
		$GLOBALS['rtgodam_stub']['options']['rtgodam_user_data'] = array(
			'user_data' => array( 'map' => array( 'hubspot' => $hubspot ) ),
		);
	}

	/**
	 * Activate and (optionally) connect the leadin plugin.
	 *
	 * @param bool $connected Whether a portal ID and refresh token are present.
	 */
	private function activate_leadin( bool $connected = true ): void {
		$GLOBALS['rtgodam_stub']['active_plugins'] = array( 'leadin/leadin.php' );
		if ( $connected ) {
			$GLOBALS['rtgodam_stub']['options']['leadin_portalId']      = '111';
			$GLOBALS['rtgodam_stub']['options']['leadin_refresh_token'] = 'tok';
			$GLOBALS['rtgodam_stub']['options']['leadin_hublet']        = 'eu1';
		}
	}

	/**
	 * Central chosen and connected: Central is the active source.
	 */
	public function test_active_source_central_when_connected(): void {
		$this->set_settings( 'central' );
		$this->set_central(
			array(
				'portal_id' => '247',
				'region'    => 'na2',
			) 
		);

		$this->assertSame( 'central', Hubspot::get_active_source() );
		$this->assertSame( '247', Hubspot::get_effective_portal_id() );
		$this->assertSame( 'na2', Hubspot::get_effective_region() );
	}

	/**
	 * Central chosen but not connected: no active source.
	 */
	public function test_active_source_empty_when_central_not_connected(): void {
		$this->set_settings( 'central' );

		$this->assertSame( '', Hubspot::get_active_source() );
		$this->assertSame( '', Hubspot::get_effective_portal_id() );
	}

	/**
	 * leadin chosen, active and connected: leadin is the active source, and the
	 * portal and region come from its options.
	 */
	public function test_active_source_leadin_when_connected(): void {
		$this->set_settings( 'leadin' );
		$this->activate_leadin();

		$this->assertSame( 'leadin', Hubspot::get_active_source() );
		$this->assertSame( '111', Hubspot::get_effective_portal_id() );
		$this->assertSame( 'eu1', Hubspot::get_effective_region() );
	}

	/**
	 * leadin chosen but its plugin is not active: the choice collapses to Central,
	 * so a connected Central is used instead (the stored choice is left alone).
	 */
	public function test_leadin_choice_collapses_to_central_when_plugin_inactive(): void {
		$this->set_settings( 'leadin' );
		$this->set_central( array( 'portal_id' => '247' ) );
		// leadin not in active_plugins.

		$this->assertSame( 'leadin', Hubspot::get_chosen_source() );
		$this->assertSame( 'central', Hubspot::get_active_source() );
	}

	/**
	 * leadin chosen and active but not connected (no refresh token): no source.
	 */
	public function test_active_source_empty_when_leadin_active_but_not_connected(): void {
		$this->set_settings( 'leadin' );
		$GLOBALS['rtgodam_stub']['active_plugins'] = array( 'leadin/leadin.php' );

		$this->assertSame( '', Hubspot::get_active_source() );
	}

	/**
	 * is_configured() needs the integration on and a connected source.
	 */
	public function test_is_configured_requires_enabled_and_a_source(): void {
		$this->set_settings( 'central', true );
		$this->set_central( array( 'portal_id' => '247' ) );
		$this->assertTrue( Hubspot::is_configured() );

		// Switched off.
		$this->set_settings( 'central', false );
		$this->assertFalse( Hubspot::is_enabled() );
		$this->assertFalse( Hubspot::is_configured() );
	}

	/**
	 * The region falls back to na1 when Central sends none.
	 */
	public function test_region_defaults_to_na1(): void {
		$this->set_settings( 'central' );
		$this->set_central( array( 'portal_id' => '247' ) );

		$this->assertSame( 'na1', Hubspot::get_effective_region() );
	}

	/**
	 * The settings sanitiser keeps only enable + a whitelisted source.
	 */
	public function test_sanitize_whitelists_source_and_keys(): void {
		$hubspot = new \ReflectionClass( Hubspot::class );
		$object  = $hubspot->newInstanceWithoutConstructor();

		$defaults = array( 'integrations' => array( 'hubspot' => Hubspot::get_default_settings() ) );

		// A valid source is kept; unknown incoming keys are dropped.
		$out = $object->sanitize_integration_settings(
			array(),
			array(
				'integrations' => array(
					'hubspot' => array(
						'enable' => true,
						'source' => 'leadin',
						'podId'  => 'x',
					),
				),
			),
			$defaults
		);
		$this->assertSame( array( 'enable', 'source' ), array_keys( $out['hubspot'] ) );
		$this->assertTrue( $out['hubspot']['enable'] );
		$this->assertSame( 'leadin', $out['hubspot']['source'] );

		// An invalid source falls back to central; a falsey enable is coerced.
		$out = $object->sanitize_integration_settings(
			array(),
			array(
				'integrations' => array(
					'hubspot' => array(
						'enable' => '0',
						'source' => 'bogus',
					),
				),
			),
			$defaults
		);
		$this->assertFalse( $out['hubspot']['enable'] );
		$this->assertSame( 'central', $out['hubspot']['source'] );
	}
}
