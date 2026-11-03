<?php
/**
 * View tracking loads only on pages that have a GoDAM video player.
 *
 * The tracker used to treat `godam-player-frontend-script` being enqueued as "a
 * video is on this page". Other plugins enqueue that handle (or scripts that
 * depend on it) on every page, so the tracker, Munchkin and HubSpot's tracking
 * code loaded on 404s and search results too, recording a page visit in Marketo
 * and HubSpot. The player template now records that it rendered, and the tracker
 * asks that instead.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Map_Tracker;

require_once dirname( __DIR__ ) . '/stubs/script-functions.php';

/**
 * Runs in separate processes, like MapEventsTrackTest: each test evals its own
 * object cache, and the per-request "a player rendered" flag must start unset.
 *
 * @covers \RTGODAM\Inc\Map_Tracker::maybe_enqueue_script
 * @covers \RTGODAM\Inc\Map_Tracker::mark_video_rendered
 * @covers \RTGODAM\Inc\Map_Tracker::page_has_video
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class MapTrackerPageGateTest extends TestCase {

	/**
	 * Tracking on in Central for Marketo, Marketo on for this site, the tracker
	 * registered, and no player rendered yet.
	 */
	protected function setUp(): void {
		parent::setUp();
		$GLOBALS['rtgodam_hooks'] = array();
		$GLOBALS['rtgodam_cache'] = array();
		$GLOBALS['rtgodam_stub']  = array(
			'options'        => array(
				// A fresh cached `verify_api_key` response, so rtgodam_get_user_data()
				// serves it without calling Central.
				'rtgodam-api-key'        => 'key',
				'rtgodam-api-key-status' => 'valid',
				'rtgodam_user_data'      => array(
					'valid_api_key' => true,
					'timestamp'     => time(),
					'checked_at'    => time(),
					'user_data'     => array(
						'map' => array(
							'tracking'  => true,
							'providers' => array( 'Marketo' ),
							'marketo'   => array( 'munchkin_id' => '123-ABC-456' ),
						),
					),
				),
				'rtgodam-settings'       => array(
					'integrations' => array(
						'marketo' => array(
							'enable'      => true,
							'track_views' => true,
						),
					),
				),
			),
			'active_plugins' => array(),
		);

		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		eval( 'function wp_cache_get( $key, $group = "" ) { return $GLOBALS["rtgodam_cache"][ $group ][ $key ] ?? false; }' );
		eval( 'function wp_cache_set( $key, $value, $group = "", $expire = 0 ) { $GLOBALS["rtgodam_cache"][ $group ][ $key ] = $value; return true; }' );
		if ( ! function_exists( 'rest_url' ) ) {
			eval( 'function rest_url( $path = "" ) { return "https://example.com/wp-json/" . ltrim( $path, "/" ); }' );
		}
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		// rtgodam_get_user_data() reads the key status, which lives with the
		// transcoder helpers.
		$root = dirname( __DIR__, 2 );
		require_once $root . '/inc/helpers/class-api-key.php';
		require_once $root . '/admin/godam-transcoder-functions.php';

		wp_register_script( Map_Tracker::SCRIPT_HANDLE );
	}

	/**
	 * Leave no stub state behind.
	 */
	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'], $GLOBALS['rtgodam_hooks'], $GLOBALS['rtgodam_cache'], $GLOBALS['rtgodam_scripts'] );
		parent::tearDown();
	}

	/**
	 * Run the footer hook on a tracker instance.
	 *
	 * @return string[] Handles enqueued.
	 */
	private function run_footer(): array {
		$tracker = ( new \ReflectionClass( Map_Tracker::class ) )->newInstanceWithoutConstructor();
		$tracker->maybe_enqueue_script();

		return $GLOBALS['rtgodam_scripts']['enqueued'];
	}

	/**
	 * QA's case: another plugin enqueues the player script on a page with no
	 * video (a 404). Nothing is loaded, so no visit is recorded in Marketo.
	 */
	public function test_nothing_loads_when_only_another_plugin_enqueued_the_player_script(): void {
		wp_enqueue_script( 'godam-player-frontend-script' );

		$enqueued = $this->run_footer();

		$this->assertNotContains( Map_Tracker::SCRIPT_HANDLE, $enqueued );
		$this->assertNotContains( Map_Tracker::MUNCHKIN_HANDLE, $enqueued );
	}

	/**
	 * A player rendered on the page: the tracker and Munchkin load.
	 */
	public function test_loads_when_a_player_rendered(): void {
		Map_Tracker::mark_video_rendered();

		$enqueued = $this->run_footer();

		$this->assertContains( Map_Tracker::SCRIPT_HANDLE, $enqueued );
		$this->assertContains( Map_Tracker::MUNCHKIN_HANDLE, $enqueued );
		$this->assertStringContainsString( '"providers":["Marketo"]', $GLOBALS['rtgodam_scripts']['inline'][ Map_Tracker::SCRIPT_HANDLE ][0] );
	}

	/**
	 * A player rendered but tracking is off on Central: still nothing loads.
	 */
	public function test_nothing_loads_with_tracking_off_even_with_a_player(): void {
		$GLOBALS['rtgodam_stub']['options']['rtgodam_user_data']['user_data']['map']['tracking'] = false;
		Map_Tracker::mark_video_rendered();

		$this->assertSame( array(), $this->run_footer() );
	}

	/**
	 * The footer check runs after players rendered in `wp_footer` (Reel Pops, at
	 * the default priority 10) and before footer scripts print at 20.
	 */
	public function test_footer_check_runs_after_footer_players_and_before_footer_scripts(): void {
		$this->assertGreaterThan( 10, Map_Tracker::FOOTER_PRIORITY );
		$this->assertLessThan( 20, Map_Tracker::FOOTER_PRIORITY );
	}

	/**
	 * The flag starts off for each request and is set by a render.
	 */
	public function test_page_has_video_follows_the_render_flag(): void {
		$this->assertFalse( Map_Tracker::page_has_video() );

		Map_Tracker::mark_video_rendered();

		$this->assertTrue( Map_Tracker::page_has_video() );
	}

	/**
	 * A page whose players are built in the browser opts in with the filter.
	 */
	public function test_filter_opts_a_page_in(): void {
		add_filter(
			'rtgodam_map_page_has_video',
			static function () {
				return true;
			}
		);

		$this->assertContains( Map_Tracker::SCRIPT_HANDLE, $this->run_footer() );
	}
}
