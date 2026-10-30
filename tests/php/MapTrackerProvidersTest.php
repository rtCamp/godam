<?php
/**
 * The frontend provider list the tracker is handed, which drops a tool that must
 * not be tracked on the page.
 *
 * Central's `map` block lists every tool connected on Central, but a tool is
 * dropped when the site has switched it off in the plugin settings, and HubSpot is
 * dropped too when the page's `hubspotutk` cookie belongs to a different portal
 * than Central forwards to (a leadin connection on another portal) — every HubSpot
 * milestone would otherwise arrive as "Unknown Contact". These pin that filtering,
 * driven by the same stubbed options/active-plugin state as HubspotConfigTest.
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
	 * Set a provider's site-level on/off switch (Settings → Integrations).
	 *
	 * @param string $integration `marketo` or `hubspot`.
	 * @param bool   $enable      Whether the integration is on.
	 */
	private function set_integration_enabled( string $integration, bool $enable ): void {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-settings']['integrations'][ $integration ] = array(
			'enable' => $enable,
		);
	}

	/**
	 * Set a provider's "Track video views on this site" switch, with the
	 * integration itself left on (so its forms still render).
	 *
	 * @param string $integration `marketo` or `hubspot`.
	 * @param bool   $track       Whether this site tracks the tool.
	 */
	private function set_site_tracking( string $integration, bool $track ): void {
		$GLOBALS['rtgodam_stub']['options']['rtgodam-settings']['integrations'][ $integration ] = array(
			'enable'      => true,
			'track_views' => $track,
		);
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
	 * Marketo switched off in the plugin settings: it is dropped even though Central
	 * still lists it, and HubSpot is unaffected.
	 */
	public function test_drops_marketo_when_disabled(): void {
		$this->set_central( array( 'portal_id' => '247' ) );
		$this->set_integration_enabled( 'marketo', false );

		$this->assertSame(
			array( 'HubSpot' ),
			Map_Tracker::frontend_providers( array( 'Marketo', 'HubSpot' ) )
		);
	}

	/**
	 * HubSpot switched off in the plugin settings: it is dropped even though its
	 * portal is aligned, and Marketo is unaffected.
	 */
	public function test_drops_hubspot_when_disabled(): void {
		$this->set_central( array( 'portal_id' => '247' ) );
		$this->set_integration_enabled( 'hubspot', false );

		$this->assertSame(
			array( 'Marketo' ),
			Map_Tracker::frontend_providers( array( 'Marketo', 'HubSpot' ) )
		);
	}

	/**
	 * Both switched off: nothing is tracked, so nothing is enqueued.
	 */
	public function test_drops_everything_when_both_disabled(): void {
		$this->set_central( array( 'portal_id' => '247' ) );
		$this->set_integration_enabled( 'marketo', false );
		$this->set_integration_enabled( 'hubspot', false );

		$this->assertSame(
			array(),
			Map_Tracker::frontend_providers( array( 'Marketo', 'HubSpot' ) )
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

	/**
	 * Marketo's site tracking switched off (integration still on): Marketo is
	 * dropped, HubSpot is unaffected.
	 */
	public function test_drops_marketo_when_site_tracking_is_off(): void {
		$this->set_central( array( 'portal_id' => '247' ) );
		$this->set_site_tracking( 'marketo', false );

		$this->assertSame(
			array( 'HubSpot' ),
			Map_Tracker::frontend_providers( array( 'Marketo', 'HubSpot' ) )
		);
	}

	/**
	 * HubSpot's site tracking switched off (integration still on): HubSpot is
	 * dropped, so its tracking code is not injected either.
	 */
	public function test_drops_hubspot_when_site_tracking_is_off(): void {
		$this->set_central( array( 'portal_id' => '247' ) );
		$this->set_site_tracking( 'hubspot', false );

		$this->assertSame(
			array( 'Marketo' ),
			Map_Tracker::frontend_providers( array( 'Marketo', 'HubSpot' ) )
		);
	}

	/**
	 * Settings saved before the switch existed have no `track_views`: both tools
	 * keep tracking.
	 */
	public function test_keeps_tracking_when_the_switch_was_never_saved(): void {
		$this->set_central( array( 'portal_id' => '247' ) );
		$this->set_integration_enabled( 'marketo', true );
		$this->set_integration_enabled( 'hubspot', true );

		$this->assertSame(
			array( 'Marketo', 'HubSpot' ),
			Map_Tracker::frontend_providers( array( 'Marketo', 'HubSpot' ) )
		);
	}
}
