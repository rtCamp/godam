<?php
/**
 * Unit tests for the analytics REST route permissions.
 *
 * Every analytics read route proxies the site's stored API key and account
 * token to the analytics microservice, so none of them may answer an anonymous
 * caller. These tests build the route table and check each permission callback
 * against three tiers:
 *  - the routes the Analytics page and Video Editor call need `upload_files`;
 *  - the routes only the Dashboard calls need `edit_pages` (what the Dashboard
 *    menu needs);
 *  - the Dashboard routes whose whole answer is store data (products,
 *    add-to-carts, orders, revenue) also need WooCommerce's report permission,
 *    `view_woocommerce_reports`, which editors and authors do not hold.
 * The three routes that take a `video_id` (fetch, history, layer-analytics) also
 * ask that the video is an attachment of this site the user can edit, as the
 * Media Editor does: editors and administrators can edit every video, an author
 * only their own.
 * Any route added later has to be placed in one of the lists below, so a new
 * route cannot ship without a deliberate permission.
 *
 * The instance is built without the constructor (Base's constructor registers
 * WP hooks we don't want here). current_user_can() is stubbed in
 * tests/bootstrap.php and driven by $GLOBALS['rtgodam_stub']['caps'], and for a
 * capability asked about one post by 'object_caps'.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Analytics;

require_once dirname( __DIR__ ) . '/stubs/post-functions.php';

/**
 * @covers \RTGODAM\Inc\REST_API\Analytics::get_rest_routes
 * @covers \RTGODAM\Inc\REST_API\Analytics::check_analytics_read_permission
 * @covers \RTGODAM\Inc\REST_API\Analytics::can_read_video_analytics
 * @covers \RTGODAM\Inc\REST_API\Analytics::check_dashboard_read_permission
 * @covers \RTGODAM\Inc\REST_API\Analytics::check_dashboard_store_permission
 * @covers \RTGODAM\Inc\REST_API\Analytics::can_view_store_data
 */
class AnalyticsRoutePermissionTest extends TestCase {

	/**
	 * Routes only the Dashboard page calls and that carry video data (or a mix
	 * whose store fields are stripped in the response). They need `edit_pages`,
	 * like the Dashboard menu.
	 */
	const DASHBOARD_ROUTES = array(
		'/analytics/dashboard-metrics',
		'/analytics/dashboard-history',
		'/analytics/top-videos',
	);

	/**
	 * Dashboard routes whose whole answer is store data. They need `edit_pages`
	 * and `view_woocommerce_reports`.
	 */
	const STORE_ROUTES = array(
		'/analytics/top-products',
		'/analytics/placement-funnels',
		'/analytics/revenue-summary',
		'/analytics/video-funnel',
	);

	/**
	 * Routes the Analytics page and the Video Editor call. They need `upload_files`,
	 * like the Analytics and Media Editor menus.
	 */
	const UPLOAD_FILES_ROUTES = array(
		'/analytics/fetch',
		'/analytics/history',
		'/analytics/layer-analytics',
	);

	/**
	 * Capabilities of an author (the lowest role that can upload files).
	 */
	const AUTHOR_CAPS = array( 'read', 'edit_posts', 'upload_files' );

	/**
	 * Capabilities of an editor (an author plus edit_pages).
	 */
	const EDITOR_CAPS = array( 'read', 'edit_posts', 'upload_files', 'edit_pages' );

	/**
	 * Capabilities of a shop manager (an editor plus WooCommerce's report permission).
	 */
	const SHOP_MANAGER_CAPS = array( 'read', 'edit_posts', 'upload_files', 'edit_pages', 'view_woocommerce_reports' );

	/**
	 * A video the user can edit unless a test says otherwise.
	 */
	const VIDEO = 101;

	/**
	 * Route args keyed by route path, e.g. '/analytics/fetch'.
	 *
	 * @var array
	 */
	private $routes = array();

	protected function setUp(): void {
		parent::setUp();

		$analytics = ( new \ReflectionClass( Analytics::class ) )->newInstanceWithoutConstructor();

		$GLOBALS['rtgodam_hooks'] = array();
		rtgodam_stub_video( self::VIDEO, 'job-101' );

		$this->routes = array();
		foreach ( $analytics->get_rest_routes() as $route ) {
			$this->routes[ $route['route'] ] = $route['args'];
		}
	}

	protected function tearDown(): void {
		unset( $GLOBALS['rtgodam_stub'] );
		parent::tearDown();
	}

	/**
	 * Call a route's permission callback as the given user.
	 *
	 * By default the user can edit the video the request names; pass the
	 * attachment IDs they can edit to say otherwise.
	 *
	 * @param array $args     Route args.
	 * @param array $caps     Capabilities the current user holds.
	 * @param int[] $editable Attachment IDs the user can edit.
	 * @param int   $video_id Video the request names.
	 * @return mixed
	 */
	private function check_as( array $args, array $caps, array $editable = array( self::VIDEO ), $video_id = self::VIDEO ) {
		$GLOBALS['rtgodam_stub']['caps']        = $caps;
		$GLOBALS['rtgodam_stub']['object_caps'] = array_map(
			static function ( $id ) {
				return 'edit_post:' . $id;
			},
			$editable
		);
		return call_user_func( $args['permission_callback'], new \WP_REST_Request( array( 'video_id' => $video_id ) ) );
	}

	/** The routes the Dashboard, Analytics and Video Editor pages call are all registered. */
	public function test_admin_read_routes_are_registered() {
		foreach ( array( 'fetch', 'history', 'dashboard-metrics', 'dashboard-history', 'top-videos', 'layer-analytics' ) as $name ) {
			$this->assertArrayHasKey( '/analytics/' . $name, $this->routes );
		}
	}

	/** No analytics route may be registered as public. */
	public function test_no_route_is_public() {
		foreach ( $this->routes as $path => $args ) {
			$this->assertArrayHasKey( 'permission_callback', $args, $path );
			$this->assertNotSame( '__return_true', $args['permission_callback'], $path );
			$this->assertIsCallable( $args['permission_callback'], $path );
		}
	}

	/** A logged-out visitor holds no capabilities and is refused on every route. */
	public function test_anonymous_caller_is_refused() {
		foreach ( $this->routes as $path => $args ) {
			$this->assertFalse( $this->check_as( $args, array() ), $path );
		}
	}

	/** Every registered route is in exactly one of the two lists, so a new route needs a deliberate permission. */
	public function test_every_route_is_classified() {
		$classified = array_merge( self::DASHBOARD_ROUTES, self::STORE_ROUTES, self::UPLOAD_FILES_ROUTES );
		$this->assertSame( array(), array_diff( array_keys( $this->routes ), $classified ), 'a route is missing from the lists above' );
		$this->assertSame( array(), array_diff( $classified, array_keys( $this->routes ) ), 'a listed route is not registered' );
		$this->assertSame( count( $classified ), count( array_unique( $classified ) ), 'a route is in both lists' );
	}

	/** Subscribers and contributors lack upload_files and are refused everywhere. */
	public function test_user_without_upload_files_is_refused() {
		foreach ( $this->routes as $path => $args ) {
			$this->assertFalse( $this->check_as( $args, array( 'read', 'edit_posts' ) ), $path );
		}
	}

	/** An author can use the routes behind the Analytics page and the Video Editor. */
	public function test_author_is_allowed_on_the_upload_files_routes() {
		foreach ( self::UPLOAD_FILES_ROUTES as $path ) {
			$this->assertTrue( $this->check_as( $this->routes[ $path ], self::AUTHOR_CAPS ), $path );
		}
	}

	/** An author cannot open the Dashboard, so the routes behind it refuse them too, store or not. */
	public function test_author_is_refused_on_every_dashboard_route() {
		foreach ( array_merge( self::DASHBOARD_ROUTES, self::STORE_ROUTES ) as $path ) {
			$this->assertFalse( $this->check_as( $this->routes[ $path ], self::AUTHOR_CAPS ), $path );
		}
	}

	/** An editor can open the Dashboard and read its video routes, and uses the two upload_files routes too. */
	public function test_editor_is_allowed_on_the_video_routes() {
		foreach ( array_merge( self::DASHBOARD_ROUTES, self::UPLOAD_FILES_ROUTES ) as $path ) {
			$this->assertTrue( $this->check_as( $this->routes[ $path ], self::EDITOR_CAPS ), $path );
		}
	}

	/** Editors see video data only: the routes that are all store data refuse them. */
	public function test_editor_is_refused_on_the_store_routes() {
		foreach ( self::STORE_ROUTES as $path ) {
			$this->assertFalse( $this->check_as( $this->routes[ $path ], self::EDITOR_CAPS ), $path );
		}
	}

	/** A shop manager (edit_pages plus WooCommerce's report permission) can use every route. */
	public function test_shop_manager_is_allowed_on_every_route() {
		foreach ( $this->routes as $path => $args ) {
			$this->assertTrue( $this->check_as( $args, self::SHOP_MANAGER_CAPS ), $path );
		}
	}

	/** edit_pages alone opens the video Dashboard routes, matching the Dashboard menu check. */
	public function test_dashboard_routes_follow_edit_pages_not_upload_files() {
		foreach ( self::DASHBOARD_ROUTES as $path ) {
			$this->assertTrue( $this->check_as( $this->routes[ $path ], array( 'read', 'edit_pages' ) ), $path );
		}
	}

	/** The report permission alone does not open the Dashboard's store routes: the Dashboard rule stays on top. */
	public function test_store_routes_need_both_edit_pages_and_the_report_permission() {
		foreach ( self::STORE_ROUTES as $path ) {
			$this->assertFalse( $this->check_as( $this->routes[ $path ], array( 'read', 'upload_files', 'view_woocommerce_reports' ) ), "$path with the report permission but not edit_pages" );
			$this->assertFalse( $this->check_as( $this->routes[ $path ], array( 'read', 'upload_files', 'edit_pages' ) ), "$path with edit_pages but not the report permission" );
			$this->assertTrue( $this->check_as( $this->routes[ $path ], array( 'read', 'edit_pages', 'view_woocommerce_reports' ) ), "$path with both" );
		}
	}

	/** An author can read the analytics of their own video but not of a video they cannot edit. */
	public function test_author_is_refused_on_a_video_they_cannot_edit() {
		rtgodam_stub_video( 102, 'job-102' );

		foreach ( self::UPLOAD_FILES_ROUTES as $path ) {
			$this->assertTrue( $this->check_as( $this->routes[ $path ], self::AUTHOR_CAPS, array( 102 ), 102 ), "$path own video" );
			$this->assertFalse( $this->check_as( $this->routes[ $path ], self::AUTHOR_CAPS, array( 102 ), self::VIDEO ), "$path someone else's video" );
		}
	}

	/** An editor can edit every attachment, so the video check changes nothing for them. */
	public function test_editor_is_allowed_on_any_video() {
		rtgodam_stub_video( 102, 'job-102' );

		foreach ( self::UPLOAD_FILES_ROUTES as $path ) {
			$this->assertTrue( $this->check_as( $this->routes[ $path ], self::EDITOR_CAPS, array( self::VIDEO, 102 ), 102 ), $path );
			$this->assertTrue( $this->check_as( $this->routes[ $path ], self::EDITOR_CAPS, array( self::VIDEO, 102 ), self::VIDEO ), $path );
		}
	}

	/** Only a video of this site: a post that is not an attachment, or an ID with no post, is refused even to someone who can edit it. */
	public function test_only_an_attachment_that_exists_is_a_video() {
		rtgodam_stub_video( 103, '', 'publish', 'page' );

		foreach ( self::UPLOAD_FILES_ROUTES as $path ) {
			$this->assertFalse( $this->check_as( $this->routes[ $path ], self::EDITOR_CAPS, array( 103, 999 ), 103 ), "$path page" );
			$this->assertFalse( $this->check_as( $this->routes[ $path ], self::EDITOR_CAPS, array( 103, 999 ), 999 ), "$path missing" );
			$this->assertFalse( $this->check_as( $this->routes[ $path ], self::EDITOR_CAPS, array( self::VIDEO ), 0 ), "$path no video" );
		}
	}

	/** The capability still comes first: without upload_files the video check does not matter. */
	public function test_capability_is_still_required_for_a_video_the_user_can_edit() {
		foreach ( self::UPLOAD_FILES_ROUTES as $path ) {
			$this->assertFalse( $this->check_as( $this->routes[ $path ], array( 'read', 'edit_posts' ), array( self::VIDEO ), self::VIDEO ), $path );
		}
	}

	/** The routes without a video, the Dashboard's, are not affected by the video check. */
	public function test_dashboard_routes_do_not_depend_on_a_video() {
		foreach ( array_merge( self::DASHBOARD_ROUTES, self::STORE_ROUTES ) as $path ) {
			$this->assertTrue( $this->check_as( $this->routes[ $path ], self::SHOP_MANAGER_CAPS, array(), 0 ), $path );
		}
	}

	/** The attachment lookup is bracketed for integrations that keep media on another site, and the pair stays balanced. */
	public function test_attachment_lookup_is_bracketed() {
		$calls = array();
		add_action(
			'rtgodam_before_attachment_lookup',
			static function () use ( &$calls ) {
				$calls[] = 'before';
			}
		);
		add_action(
			'rtgodam_after_attachment_lookup',
			static function () use ( &$calls ) {
				$calls[] = 'after';
			}
		);

		$this->check_as( $this->routes['/analytics/fetch'], self::AUTHOR_CAPS );
		$this->assertSame( array( 'before', 'after' ), $calls );

		// No video ID, nothing to look up.
		$calls = array();
		$this->check_as( $this->routes['/analytics/fetch'], self::AUTHOR_CAPS, array( self::VIDEO ), 0 );
		$this->assertSame( array(), $calls );
	}
}
