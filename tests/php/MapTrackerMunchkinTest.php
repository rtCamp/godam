<?php
/**
 * When the tracker loads Marketo's Munchkin tracking code, and what it runs.
 *
 * Marketo view tracking needs the visitor's `_mkto_trk` cookie, and only Munchkin
 * sets it (forms2 only reads it). So Munchkin is loaded whenever Marketo is a
 * frontend provider for the page, unless a site that loads it itself turns that
 * off with the `rtgodam_map_inject_munchkin` filter.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Map_Tracker;

/**
 * @covers \RTGODAM\Inc\Map_Tracker::munchkin_id_to_load
 * @covers \RTGODAM\Inc\Map_Tracker::munchkin_loader_js
 */
class MapTrackerMunchkinTest extends TestCase {

	/**
	 * Marketo connected on Central with a Munchkin ID, and no filters.
	 */
	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_stub']  = array(
			'options' => array(
				'rtgodam_user_data' => array(
					'user_data' => array( 'map' => array( 'marketo' => array( 'munchkin_id' => '123-ABC-456' ) ) ),
				),
			),
		);
		$GLOBALS['rtgodam_hooks'] = array();
	}

	/**
	 * Leave no stub state behind.
	 */
	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $GLOBALS['rtgodam_hooks'] );
		parent::tearDown();
	}

	/**
	 * Marketo tracked on the page: Munchkin is loaded for its Munchkin ID.
	 */
	public function test_loads_for_marketo(): void {
		$this->assertSame( '123-ABC-456', Map_Tracker::munchkin_id_to_load( array( 'HubSpot', 'Marketo' ) ) );
	}

	/**
	 * Marketo not tracked on the page (Central or the site switched it off, so
	 * frontend_providers() dropped it): Munchkin is not loaded.
	 */
	public function test_skips_without_marketo(): void {
		$this->assertSame( '', Map_Tracker::munchkin_id_to_load( array( 'HubSpot' ) ) );
		$this->assertSame( '', Map_Tracker::munchkin_id_to_load( array() ) );
	}

	/**
	 * A site that loads Munchkin itself turns ours off with the filter.
	 */
	public function test_filter_turns_it_off(): void {
		add_filter(
			'rtgodam_map_inject_munchkin',
			static function () {
				return false;
			}
		);

		$this->assertSame( '', Map_Tracker::munchkin_id_to_load( array( 'Marketo' ) ) );
	}

	/**
	 * No Munchkin ID, or one that is not in Marketo's format: nothing to load.
	 */
	public function test_skips_without_a_valid_munchkin_id(): void {
		foreach ( array( '', '123-ABC-456"};alert(1);//' ) as $munchkin_id ) {
			$GLOBALS['rtgodam_stub']['options']['rtgodam_user_data']['user_data']['map']['marketo']['munchkin_id'] = $munchkin_id;

			$this->assertSame( '', Map_Tracker::munchkin_id_to_load( array( 'Marketo' ) ), $munchkin_id );
		}
	}

	/**
	 * The loader fetches Marketo's Munchkin, initialises it for the ID, and does
	 * nothing when Munchkin is already on the page or GPC is sent.
	 */
	public function test_loader_js(): void {
		$js = Map_Tracker::munchkin_loader_js( '123-ABC-456' );

		$this->assertStringContainsString( '"https:\/\/munchkin.marketo.net\/munchkin.js"', $js );
		$this->assertStringContainsString( 'window.Munchkin.init("123-ABC-456")', $js );
		$this->assertStringContainsString( 'if(window.Munchkin||(navigator&&navigator.globalPrivacyControl===true)){return;}', $js );
	}
}
