<?php
/**
 * The frontend provider list the tracker is handed, which drops a tool that cannot
 * be matched on the page.
 *
 * Central's `map` block lists every connected tool, but HubSpot view tracking only
 * works when the page's `hubspotutk` cookie belongs to Central's portal. When a
 * leadin connection points at a different portal, every HubSpot milestone would
 * arrive as "Unknown Contact", so HubSpot is filtered out before it is ever sent.
 * These pin that filtering, driven by the same stubbed options/active-plugin state
 * as HubspotConfigTest.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Map_Tracker;

require_once dirname( __DIR__, 2 ) . '/inc/classes/class-hubspot.php';

/**
 * @covers \RTGODAM\Inc\Map_Tracker::frontend_providers
 */
class MapTrackerProvidersTest extends TestCase {

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
	 * Activate and connect the leadin plugin on a given portal.
	 *
	 * @param string $portal_id The leadin portal ID.
	 */
	private function connect_leadin( string $portal_id ): void {
		$GLOBALS['rtgodam_stub']['active_plugins']                  = array( 'leadin/leadin.php' );
		$GLOBALS['rtgodam_stub']['options']['leadin_portalId']      = $portal_id;
		$GLOBALS['rtgodam_stub']['options']['leadin_refresh_token'] = 'tok';
	}

	/**
	 * Central connected, no leadin: HubSpot is kept.
	 */
	public function test_keeps_hubspot_when_portal_aligned(): void {
		$this->set_central( array( 'portal_id' => '247' ) );

		$this->assertSame(
			array( 'Marketo', 'HubSpot' ),
			Map_Tracker::frontend_providers( array( 'Marketo', 'HubSpot' ) )
		);
	}

	/**
	 * leadin on a different portal: HubSpot is dropped, Marketo stays.
	 */
	public function test_drops_hubspot_on_portal_mismatch(): void {
		$this->set_central( array( 'portal_id' => '247' ) );
		$this->connect_leadin( '111' );

		$this->assertSame(
			array( 'Marketo' ),
			Map_Tracker::frontend_providers( array( 'Marketo', 'HubSpot' ) )
		);
	}

	/**
	 * No Central portal at all: HubSpot cannot be matched, so it is dropped.
	 */
	public function test_drops_hubspot_without_central_portal(): void {
		$this->assertSame(
			array(),
			Map_Tracker::frontend_providers( array( 'HubSpot' ) )
		);
	}

	/**
	 * leadin on the same portal as Central: the cookie matches, so HubSpot is kept.
	 */
	public function test_keeps_hubspot_when_portals_match(): void {
		$this->set_central( array( 'portal_id' => '111' ) );
		$this->connect_leadin( '111' );

		$this->assertSame(
			array( 'HubSpot' ),
			Map_Tracker::frontend_providers( array( 'HubSpot' ) )
		);
	}

	/**
	 * Junk and non-string entries are normalised away.
	 */
	public function test_normalises_the_list(): void {
		$this->set_central( array( 'portal_id' => '247' ) );

		$this->assertSame(
			array( 'Marketo' ),
			Map_Tracker::frontend_providers( array( 'Marketo', '', null ) )
		);
	}
}
