<?php
/**
 * Dismissing the free-plan notice, the WooCommerce promo notice and the offer banner.
 *
 * Each dismissal is saved in an option that every administrator shares, so only an
 * administrator can make it. The nonce alone does not decide it: it is printed on
 * pages every signed-in user can open.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Media_Library_Ajax;

/**
 * Runs in separate processes, like the other tests that load the admin classes
 * and need their own function stubs.
 *
 * @covers \RTGODAM_Transcoder_Admin::dismiss_free_plan_notice
 * @covers \RTGODAM_Transcoder_Admin::dismiss_woo_promo_notice
 * @covers \RTGODAM\Inc\Media_Library_Ajax::dismiss_offer_banner
 *
 * @runTestsInSeparateProcesses
 * @preserveGlobalState disabled
 */
class NoticeDismissCapabilityTest extends TestCase {

	private const FREE_PLAN_OPTION = 'rtgodam_free_plan_notice_dismissed_timestamp';
	private const WOO_PROMO_OPTION = 'rtgodam_woo_promo_dismissed_timestamp';
	private const OFFER_OPTION     = 'rtgodam-offer-banner';

	/**
	 * The admin class, built without its constructor (which loads the transcoder handler).
	 *
	 * @var \RTGODAM_Transcoder_Admin
	 */
	private $admin;

	/**
	 * Load the classes under test and stub the slice of WordPress they touch.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_stub'] = array(
			'caps'        => array( 'manage_options' ),
			'nonce_valid' => true,
			'options'     => array(),
		);

		if ( ! defined( 'WP_PLUGIN_DIR' ) ) {
			define( 'WP_PLUGIN_DIR', sys_get_temp_dir() . '/rtgodam-no-plugins' );
		}

		$root = dirname( __DIR__, 2 );
		require_once $root . '/inc/classes/enums/class-api-key-status.php';
		require_once $root . '/inc/helpers/class-api-key.php';
		require_once $root . '/admin/godam-transcoder-functions.php';
		require_once $root . '/admin/class-rtgodam-transcoder-admin.php';

		// The senders end the request, so the stubs throw to let the test carry on and read what was sent.
		// phpcs:disable Squiz.PHP.Eval.Discouraged -- test-only stubs, isolated process.
		eval( 'function update_option( $key, $value ) { $GLOBALS["rtgodam_stub"]["options"][ $key ] = $value; return true; }' );
		eval( 'function add_option( $key, $value ) { $GLOBALS["rtgodam_stub"]["options"][ $key ] = $value; return true; }' );
		eval( 'function get_current_user_id() { return 1; }' );
		eval( 'function check_ajax_referer( $action = -1, $query_arg = false, $stop = true ) { if ( empty( $GLOBALS["rtgodam_stub"]["nonce_valid"] ) ) { throw new \RuntimeException( "bad nonce" ); } return 1; }' );
		eval( 'function wp_die() { throw new \RuntimeException( "died" ); }' );
		eval( 'function wp_send_json_error( $data = null, $status = null ) { $GLOBALS["rtgodam_stub"]["json"] = array( "success" => false, "data" => $data, "status" => $status ); throw new \RuntimeException( "json" ); }' );
		eval( 'function wp_send_json_success( $data = null ) { $GLOBALS["rtgodam_stub"]["json"] = array( "success" => true, "data" => $data, "status" => null ); throw new \RuntimeException( "json" ); }' );
		// phpcs:enable Squiz.PHP.Eval.Discouraged

		$this->admin = ( new \ReflectionClass( \RTGODAM_Transcoder_Admin::class ) )->newInstanceWithoutConstructor();
	}

	/**
	 * An administrator's dismissal is saved, as before.
	 *
	 * @dataProvider dismissals
	 *
	 * @param string $handler The handler's name.
	 * @param string $option  The option it saves.
	 */
	public function test_an_administrator_can_dismiss( $handler, $option ) {
		$this->call_handler( $handler );

		$this->assertArrayHasKey( $option, $GLOBALS['rtgodam_stub']['options'], 'The dismissal was not saved.' );
	}

	/**
	 * A user who cannot manage options saves nothing, and is told so.
	 *
	 * Every role below the administrator is covered: they can all reach the nonce,
	 * which is printed on pages they can open.
	 *
	 * @dataProvider dismissals_by_role
	 *
	 * @param string $handler The handler's name.
	 * @param string $option  The option it saves.
	 * @param array  $caps    The user's capabilities.
	 */
	public function test_other_roles_cannot_dismiss( $handler, $option, $caps ) {
		$GLOBALS['rtgodam_stub']['caps'] = $caps;

		$this->call_handler( $handler );

		$this->assertArrayNotHasKey( $option, $GLOBALS['rtgodam_stub']['options'], 'A dismissal from a non-admin was saved.' );
		$this->assertFalse( $GLOBALS['rtgodam_stub']['json']['success'] );
		$this->assertSame( 403, $GLOBALS['rtgodam_stub']['json']['status'] );
	}

	/**
	 * The nonce is still required, for an administrator too.
	 *
	 * @dataProvider dismissals
	 *
	 * @param string $handler The handler's name.
	 * @param string $option  The option it saves.
	 */
	public function test_a_bad_nonce_saves_nothing( $handler, $option ) {
		$GLOBALS['rtgodam_stub']['nonce_valid'] = false;

		$this->call_handler( $handler );

		$this->assertArrayNotHasKey( $option, $GLOBALS['rtgodam_stub']['options'] );
	}

	/**
	 * The offer banner is hidden for good, not for a set time.
	 */
	public function test_dismissing_the_offer_banner_turns_it_off() {
		$this->call_handler( 'dismiss_offer_banner' );

		$this->assertSame( 0, $GLOBALS['rtgodam_stub']['options'][ self::OFFER_OPTION ] );
		$this->assertTrue( $GLOBALS['rtgodam_stub']['json']['success'] );
	}

	/**
	 * The handlers, with the option each one saves.
	 *
	 * @return array<string, array>
	 */
	public function dismissals() {
		return array(
			'free-plan notice' => array( 'dismiss_free_plan_notice', self::FREE_PLAN_OPTION ),
			'Woo promo notice' => array( 'dismiss_woo_promo_notice', self::WOO_PROMO_OPTION ),
			'offer banner'     => array( 'dismiss_offer_banner', self::OFFER_OPTION ),
		);
	}

	/**
	 * Each handler against the capabilities of every role below the administrator.
	 *
	 * @return array<string, array>
	 */
	public function dismissals_by_role() {
		$roles = array(
			'editor'      => array( 'edit_posts', 'edit_others_posts', 'publish_posts', 'upload_files', 'read' ),
			'author'      => array( 'edit_posts', 'publish_posts', 'upload_files', 'read' ),
			'contributor' => array( 'edit_posts', 'read' ),
			'subscriber'  => array( 'read' ),
		);

		$cases = array();
		foreach ( $this->dismissals() as $label => list( $handler, $option ) ) {
			foreach ( $roles as $role => $caps ) {
				$cases[ $label . ', ' . $role ] = array( $handler, $option, $caps );
			}
		}

		return $cases;
	}

	/**
	 * Run a handler that ends the request, whichever way it ends.
	 *
	 * @param string $handler The handler's name.
	 */
	private function call_handler( $handler ) {
		$target = 'dismiss_offer_banner' === $handler
			? ( new \ReflectionClass( Media_Library_Ajax::class ) )->newInstanceWithoutConstructor()
			: $this->admin;

		try {
			$target->$handler();
		} catch ( \RuntimeException $e ) {
			$this->assertContains( $e->getMessage(), array( 'died', 'json', 'bad nonce' ) );
		}
	}
}
