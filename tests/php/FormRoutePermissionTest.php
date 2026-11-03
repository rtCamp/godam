<?php
/**
 * Unit tests for who can call the form-plugin REST routes.
 *
 * Only the Media Editor calls the form listing and single-form routes, so they
 * need `upload_files`, the capability the Media Editor page needs. The one form
 * route the front-end player calls, the Jetpack form submission, stays public,
 * and so do the routes that only repeat what WordPress already shows visitors.
 * Any route added later has to be placed in one of the lists below, so a new
 * form route cannot ship without a deliberate permission.
 *
 * The instances are built without the constructor (Base's constructor registers
 * WP hooks we don't want here). current_user_can() is stubbed in
 * tests/bootstrap.php and driven by $GLOBALS['rtgodam_stub']['caps'].
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Everest_Forms\Everest_Forms_Rest_Api;
use RTGODAM\Inc\Metform\Metform_Rest_Api;
use RTGODAM\Inc\Ninja_Forms\Ninja_Forms_Rest_Api;
use RTGODAM\Inc\REST_API\CF7;
use RTGODAM\Inc\REST_API\Fluent_Forms;
use RTGODAM\Inc\REST_API\Forminator_Forms;
use RTGODAM\Inc\REST_API\GF;
use RTGODAM\Inc\REST_API\Jetpack;
use RTGODAM\Inc\REST_API\SureForms;
use RTGODAM\Inc\REST_API\WPForms;

/**
 * @covers \RTGODAM\Inc\REST_API\Base::forms_permissions_check
 * @covers \RTGODAM\Inc\REST_API\CF7::get_rest_routes
 * @covers \RTGODAM\Inc\REST_API\Fluent_Forms::get_rest_routes
 * @covers \RTGODAM\Inc\REST_API\Forminator_Forms::get_rest_routes
 * @covers \RTGODAM\Inc\REST_API\GF::get_rest_routes
 * @covers \RTGODAM\Inc\REST_API\Jetpack::get_rest_routes
 * @covers \RTGODAM\Inc\REST_API\SureForms::get_rest_routes
 * @covers \RTGODAM\Inc\REST_API\WPForms::get_rest_routes
 * @covers \RTGODAM\Inc\Everest_Forms\Everest_Forms_Rest_Api::get_rest_routes
 * @covers \RTGODAM\Inc\Metform\Metform_Rest_Api::get_rest_routes
 * @covers \RTGODAM\Inc\Ninja_Forms\Ninja_Forms_Rest_Api::get_rest_routes
 */
class FormRoutePermissionTest extends TestCase {

	/**
	 * Routes only the Media Editor calls. They need `upload_files`.
	 */
	const EDITOR_ROUTES = array(
		'/godam/v1/gforms',
		'/godam/v1/gform',
		'/godam/v1/wpforms',
		'/godam/v1/wpform',
		'/godam/v1/sureforms',
		'/godam/v1/sureform',
		'/godam/v1/forminator-forms',
		'/godam/v1/forminator-form',
		'/godam/v1/fluent-forms',
		'/godam/v1/fluent-form',
		'/godam/v1/ninja-forms',
		'/godam/v1/ninja-form',
		'/godam/v1/everest-forms',
		'/godam/v1/everest-form',
		'/godam/v1/cf7-form',
		'/godam/v1/jetpack-form',
	);

	/**
	 * Routes that stay public.
	 *
	 * The Jetpack form submission is what the front-end player posts a visitor's
	 * entry to. MetForm's forms are public posts, and the Jetpack listing names
	 * published pages and posts, so those three routes return only what visitors
	 * can already read on the site.
	 */
	const PUBLIC_ROUTES = array(
		'/godam/v1/jetpack-form-submit',
		'/godam/v1/metforms',
		'/godam/v1/metform',
		'/godam/v1/jetpack-forms',
	);

	/**
	 * Capabilities of an author (the lowest role that can upload files).
	 */
	const AUTHOR_CAPS = array( 'read', 'edit_posts', 'upload_files' );

	/**
	 * Route args keyed by route path, e.g. '/godam/v1/wpforms'.
	 *
	 * @var array
	 */
	private $routes = array();

	protected function setUp(): void {
		parent::setUp();

		require_once dirname( __DIR__ ) . '/stubs/form-routes.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-cf7.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-fluent-forms.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-forminator-forms.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-jetpack.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-sureforms.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/rest-api/class-wpforms.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/everest-forms/class-everest-forms-rest-api.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/metform/class-metform-rest-api.php';
		require_once dirname( __DIR__, 2 ) . '/inc/classes/ninja-forms/class-ninja-forms-rest-api.php';

		// SureForms and Forminator only register their routes when the plugin is active.
		$GLOBALS['rtgodam_stub'] = array( 'active_plugins' => array( 'sureforms/sureforms.php' ) );

		$this->routes = array();
		foreach ( array( CF7::class, Fluent_Forms::class, Forminator_Forms::class, GF::class, Jetpack::class, SureForms::class, WPForms::class, Everest_Forms_Rest_Api::class, Metform_Rest_Api::class, Ninja_Forms_Rest_Api::class ) as $class ) {
			$instance = ( new \ReflectionClass( $class ) )->newInstanceWithoutConstructor();
			foreach ( $instance->get_rest_routes() as $route ) {
				// The routes have no base, so the route starts with a double slash.
				$path                  = '/' . $route['namespace'] . preg_replace( '#/+#', '/', $route['route'] );
				$this->routes[ $path ] = $route['args'][0];
			}
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

	/** Every form route is in exactly one of the two lists, so a new route needs a deliberate permission. */
	public function test_every_route_is_classified() {
		$classified = array_merge( self::EDITOR_ROUTES, self::PUBLIC_ROUTES );
		$this->assertSame( array(), array_diff( array_keys( $this->routes ), $classified ), 'a route is missing from the lists above' );
		$this->assertSame( array(), array_diff( $classified, array_keys( $this->routes ) ), 'a listed route is not registered' );
		$this->assertSame( count( $classified ), count( array_unique( $classified ) ), 'a route is in both lists' );
	}

	/** No editor route may be registered as public. */
	public function test_no_editor_route_is_public() {
		foreach ( self::EDITOR_ROUTES as $path ) {
			$this->assertArrayHasKey( 'permission_callback', $this->routes[ $path ], $path );
			$this->assertNotSame( '__return_true', $this->routes[ $path ]['permission_callback'], $path );
			$this->assertIsCallable( $this->routes[ $path ]['permission_callback'], $path );
		}
	}

	/** A logged-out visitor holds no capabilities and is refused on every editor route. */
	public function test_anonymous_caller_is_refused() {
		foreach ( self::EDITOR_ROUTES as $path ) {
			$this->assertFalse( $this->check_as( $this->routes[ $path ], array() ), $path );
		}
	}

	/** Subscribers and contributors cannot open the Media Editor, so its routes refuse them. */
	public function test_user_without_upload_files_is_refused() {
		foreach ( self::EDITOR_ROUTES as $path ) {
			$this->assertFalse( $this->check_as( $this->routes[ $path ], array( 'read' ) ), "$path as a subscriber" );
			$this->assertFalse( $this->check_as( $this->routes[ $path ], array( 'read', 'edit_posts' ) ), "$path as a contributor" );
		}
	}

	/** An author can open the Media Editor, so every route behind its form pickers answers them. */
	public function test_author_is_allowed_on_every_editor_route() {
		foreach ( self::EDITOR_ROUTES as $path ) {
			$this->assertTrue( $this->check_as( $this->routes[ $path ], self::AUTHOR_CAPS ), $path );
		}
	}

	/** The player posts a visitor's Jetpack form entry to a public route, so the route answers everyone. */
	public function test_jetpack_submission_route_stays_public() {
		$this->assertSame( '__return_true', $this->routes['/godam/v1/jetpack-form-submit']['permission_callback'] );
	}

	/** The routes that only repeat what visitors can already read stay as they were. */
	public function test_routes_that_repeat_public_data_stay_public() {
		foreach ( array( '/godam/v1/metforms', '/godam/v1/metform', '/godam/v1/jetpack-forms' ) as $path ) {
			$this->assertSame( '__return_true', $this->routes[ $path ]['permission_callback'], $path );
		}
	}
}
