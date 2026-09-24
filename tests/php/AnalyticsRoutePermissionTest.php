<?php
/**
 * Unit tests for the analytics REST route permissions.
 *
 * Every analytics read route proxies the site's stored API key and account
 * token to the analytics microservice, so none of them may answer an anonymous
 * caller. These tests build the route table and check that each permission
 * callback requires `upload_files`, which also covers analytics routes added
 * later.
 *
 * The instance is built without the constructor (Base's constructor registers
 * WP hooks we don't want here). current_user_can() is stubbed in
 * tests/bootstrap.php and driven by $GLOBALS['rtgodam_stub']['caps'].
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\REST_API\Analytics;

/**
 * @covers \RTGODAM\Inc\REST_API\Analytics::get_rest_routes
 * @covers \RTGODAM\Inc\REST_API\Analytics::check_analytics_read_permission
 */
class AnalyticsRoutePermissionTest extends TestCase {

	/**
	 * Route args keyed by route path, e.g. '/analytics/fetch'.
	 *
	 * @var array
	 */
	private $routes = array();

	protected function setUp(): void {
		parent::setUp();

		$analytics = ( new \ReflectionClass( Analytics::class ) )->newInstanceWithoutConstructor();

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
	 * @param array $args Route args.
	 * @param array $caps Capabilities the current user holds.
	 * @return mixed
	 */
	private function check_as( array $args, array $caps ) {
		$GLOBALS['rtgodam_stub']['caps'] = $caps;
		return call_user_func( $args['permission_callback'] );
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

	/** Subscribers and contributors lack upload_files and are refused. */
	public function test_user_without_upload_files_is_refused() {
		foreach ( $this->routes as $path => $args ) {
			$this->assertFalse( $this->check_as( $args, array( 'read', 'edit_posts' ) ), $path );
		}
	}

	/** Authors and above keep access, so the admin pages keep working. */
	public function test_user_with_upload_files_is_allowed() {
		foreach ( $this->routes as $path => $args ) {
			$this->assertTrue( $this->check_as( $args, array( 'read', 'edit_posts', 'upload_files' ) ), $path );
		}
	}
}
