<?php
/**
 * Guard against reintroducing #465.
 *
 * Four GoDAM call sites used to translate before `init` — three during
 * `plugins_loaded`, one at plugin file load — which makes WordPress 6.7+ log
 * `_load_textdomain_just_in_time was called incorrectly` and, with
 * WP_DEBUG_DISPLAY on, print that notice into the page.
 *
 * These assertions are behavioural rather than textual. The stubs in
 * tests/stubs/ record every translation call and every hook registration, so a
 * test can run an early hook and assert that nothing translated while it did.
 * That covers the property instead of the four known instances: a fresh `__()`
 * added anywhere on an early path fails these tests, even in a function no
 * assertion here mentions by name.
 *
 * Core reports only the first such call per text domain per request, and stays
 * silent when the domain has no `.mo` file at all, so a regression is close to
 * invisible by eye on a default install.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Addons\Abstract_Addon;
use RTGODAM\Inc\Addons\Addon_Registry;
use RTGODAM\Inc\FluentForms\Init as FluentForms_Init;
use RTGODAM\Inc\WPForms\WPForms_Integration;
use ReflectionClass;

/**
 * @coversNothing
 */
class EarlyTranslationHooksTest extends TestCase {

	/**
	 * Reset the hook registry and translation log before each test.
	 */
	protected function setUp(): void {
		parent::setUp();

		$GLOBALS['rtgodam_hooks']      = array();
		$GLOBALS['rtgodam_translated'] = array();
		$GLOBALS['rtgodam_stub']       = array( 'is_admin' => true );
	}

	/*
	 * -----------------------------------------------------------------------
	 * Add-on registry: nothing may translate while `plugins_loaded` runs.
	 * -----------------------------------------------------------------------
	 */

	/**
	 * An add-on with an unmet dependency must not translate during
	 * `plugins_loaded`, and must still produce the notice when it renders.
	 *
	 * This is the regression itself. `boot_addons()` asks every add-on for its
	 * dependency state on every request, so anything translated there translates
	 * before any text domain is loaded.
	 */
	public function test_unmet_dependency_translates_only_when_the_notice_renders() {
		$this->register_addon( $this->addon_with_unmet_dependency() );

		do_action( 'plugins_loaded' );

		$this->assertSame(
			array(),
			$this->translated_texts(),
			'Something translated during plugins_loaded.'
		);

		$this->assertTrue( has_action( 'admin_notices' ), 'No notice was queued.' );

		ob_start();
		do_action( 'admin_notices' );
		$output = ob_get_clean();

		$this->assertContains( 'WooCommerce is required.', $this->translated_texts() );
		$this->assertStringContainsString( 'WooCommerce is required.', $output );
	}

	/**
	 * Same for the version-compatibility notice, which builds its text with
	 * `esc_html__()` inside a callback.
	 */
	public function test_incompatible_addon_translates_only_when_the_notice_renders() {
		$this->register_addon( $this->addon_requiring_a_newer_godam() );

		do_action( 'plugins_loaded' );

		$this->assertSame(
			array(),
			$this->translated_texts(),
			'The compatibility notice translated during plugins_loaded.'
		);

		ob_start();
		do_action( 'admin_notices' );
		$output = ob_get_clean();

		$this->assertStringContainsString( 'requires GoDAM', $output );
	}

	/**
	 * The compatibility warning is deferred to `admin_init`.
	 *
	 * `admin_init` is both later than `init` and admin-only, so the old
	 * `is_admin()` guard is redundant rather than dropped.
	 */
	public function test_compatibility_warning_is_deferred_to_admin_init() {
		$registry = $this->boot_registry();

		do_action( 'plugins_loaded' );

		$this->assertTrue(
			has_action( 'admin_init', array( $registry, 'warn_incompatible_addons' ) ),
			'warn_incompatible_addons is not on admin_init.'
		);

		// It translates when it runs — just not before `init`.
		do_action( 'admin_init' );
		$this->assertNotSame( array(), $this->translated_texts() );
	}

	/**
	 * Front-end, REST and cron requests never fire `admin_notices`, so no
	 * callback should be queued there at all.
	 */
	public function test_no_notice_is_queued_outside_the_admin() {
		$GLOBALS['rtgodam_stub']['is_admin'] = false;

		$this->register_addon( $this->addon_with_unmet_dependency() );

		do_action( 'plugins_loaded' );

		$this->assertFalse( has_action( 'admin_notices' ) );
		$this->assertSame( array(), $this->translated_texts() );
	}

	/*
	 * -----------------------------------------------------------------------
	 * Media list table column: registered on `admin_init`, not at file load.
	 * -----------------------------------------------------------------------
	 */

	/**
	 * Deciding whether to register the column resolves the API key, which can
	 * call `rtgodam_verify_api_key()` and translate. At file load that happened
	 * before `init` on every request, front end included.
	 */
	public function test_media_status_column_is_registered_on_admin_init() {
		$at_load = $this->load_transcoder_functions();

		$this->assertArrayHasKey(
			'admin_init',
			$at_load['hooks'],
			'The transcoder functions file registers nothing on admin_init.'
		);

		$admin_init = array_merge( ...array_values( $at_load['hooks']['admin_init'] ) );

		$this->assertContains( 'rtgodam_register_media_status_columns', $admin_init );
	}

	/** Loading the file must not translate anything by itself. */
	public function test_loading_the_transcoder_functions_translates_nothing() {
		$at_load = $this->load_transcoder_functions();

		$this->assertSame( array(), $at_load['translated'] );
	}

	/**
	 * The sortable-column filter belongs with the other two.
	 *
	 * Left at file scope it ran on front-end, REST and cron requests, and marked
	 * a column sortable even when an invalid API key meant the column did not
	 * exist.
	 */
	public function test_sortable_column_is_registered_with_the_others() {
		$this->load_transcoder_functions();

		$GLOBALS['rtgodam_hooks'] = array();
		rtgodam_register_media_status_columns();

		$this->assertTrue(
			has_filter( 'manage_upload_sortable_columns', 'rtgodam_status_column_register_sortable' ),
			'The sortable filter is not registered alongside the column.'
		);
	}

	/*
	 * -----------------------------------------------------------------------
	 * Form integrations: moved from the host plugin's own hook to `init`.
	 * -----------------------------------------------------------------------
	 */

	/**
	 * The WPForms field translates its labels in the constructor, so it must be
	 * built on `init` rather than `wpforms_loaded`, which fires during
	 * `plugins_loaded`.
	 */
	public function test_wpforms_field_is_registered_on_init() {
		$integration = ( new ReflectionClass( WPForms_Integration::class ) )->newInstanceWithoutConstructor();

		$GLOBALS['rtgodam_stub']['active_plugins'] = array( 'wpforms-lite/wpforms.php' );

		$integration->init();

		$this->assertTrue(
			has_action( 'init', array( $integration, 'init_godam_video_field' ) ),
			'The field is not built on init.'
		);
		$this->assertFalse( has_action( 'wpforms_loaded' ), 'Still hooked to wpforms_loaded.' );
		$this->assertSame( array(), $this->translated_texts() );
	}

	/**
	 * `init` no longer proves WPForms actually booted.
	 *
	 * `wpforms_loaded` did, by construction. On `init` the only gate is
	 * `is_plugin_active()`, which is true whenever the plugin file is in
	 * `active_plugins` even if WPForms aborted its own bootstrap — a requirements
	 * check, a license bail, fatal-recovery mode. `WPForms_Field` is then never
	 * declared, so the field class is never declared either, and an unguarded
	 * `new` fatals on every request.
	 */
	public function test_wpforms_field_survives_wpforms_not_bootstrapping() {
		$this->assertFalse(
			class_exists( 'WPForms_Field' ),
			'This test is meaningless if WPForms_Field exists.'
		);

		$integration = ( new ReflectionClass( WPForms_Integration::class ) )->newInstanceWithoutConstructor();

		$integration->init_godam_video_field();

		$this->assertFalse( class_exists( '\RTGODAM\Inc\WPForms\WPForms_Field_GoDAM_Video', false ) );
	}

	/** Same for the Fluent Forms recorder field, previously on `fluentform/loaded`. */
	public function test_fluentforms_field_is_registered_on_init() {
		$GLOBALS['rtgodam_stub']['active_plugins'] = array( 'fluentform/fluentform.php' );

		$init = $this->construct( FluentForms_Init::class );

		$this->assertTrue(
			has_action( 'init', array( $init, 'on_fluentforms_loaded' ) ),
			'The recorder field is not built on init.'
		);
		$this->assertFalse( has_action( 'fluentform/loaded' ), 'Still hooked to fluentform/loaded.' );
		$this->assertSame( array(), $this->translated_texts() );
	}

	/**
	 * Fluent Forms is the worse case: `Recorder_Field extends BaseFieldManager`
	 * unconditionally, so without the guard the include itself fatals rather than
	 * the instantiation.
	 */
	public function test_fluentforms_survives_fluentforms_not_bootstrapping() {
		$this->assertFalse(
			class_exists( 'FluentForm\App\Services\FormBuilder\BaseFieldManager' ),
			'This test is meaningless if BaseFieldManager exists.'
		);

		$init = ( new ReflectionClass( FluentForms_Init::class ) )->newInstanceWithoutConstructor();

		$init->on_fluentforms_loaded();

		$this->assertFalse( class_exists( '\RTGODAM\Inc\FluentForms\Fields\Recorder_Field', false ) );
	}

	/*
	 * -----------------------------------------------------------------------
	 * Helpers.
	 * -----------------------------------------------------------------------
	 */

	/**
	 * Texts passed to a translation function since the last reset.
	 *
	 * @return string[]
	 */
	private function translated_texts() {
		return array_column( $GLOBALS['rtgodam_translated'], 'text' );
	}

	/**
	 * Build an object whose constructor is protected (the Singleton trait).
	 *
	 * @param string $class_name Class name.
	 *
	 * @return object
	 */
	private function construct( $class_name ) {
		$reflection = new ReflectionClass( $class_name );
		$instance   = $reflection->newInstanceWithoutConstructor();

		$constructor = $reflection->getConstructor();
		$constructor->setAccessible( true );
		$constructor->invoke( $instance );

		return $instance;
	}

	/**
	 * A registry with its constructor run, so `init` is on `plugins_loaded`.
	 *
	 * @return Addon_Registry
	 */
	private function boot_registry() {
		return $this->construct( Addon_Registry::class );
	}

	/**
	 * Boot a registry and queue the given add-on for registration.
	 *
	 * @param Abstract_Addon $addon Add-on to register.
	 *
	 * @return Addon_Registry
	 */
	private function register_addon( Abstract_Addon $addon ) {
		$registry = $this->boot_registry();

		add_action(
			'godam_register_addons',
			static function ( $registry ) use ( $addon ) {
				$registry->register( $addon );
			}
		);

		return $registry;
	}

	/**
	 * An add-on whose dependency is unsatisfied and whose message translates.
	 *
	 * @return Abstract_Addon
	 */
	private function addon_with_unmet_dependency() {
		return new class() extends Abstract_Addon {

			public function get_slug() {
				return 'stub-addon';
			}

			public function get_name() {
				return 'Stub Add-on';
			}

			public function get_version() {
				return '1.0.0';
			}

			public function get_path() {
				return __DIR__;
			}

			public function get_url() {
				return 'https://example.org/';
			}

			public function boot() {}

			public function get_dependencies() {
				return array(
					array(
						'name'    => 'WooCommerce',
						'check'   => static function () {
							return false;
						},
						'message' => static function () {
							return __( 'WooCommerce is required.', 'godam' );
						},
					),
				);
			}
		};
	}

	/**
	 * An add-on demanding a GoDAM newer than this one, to reach the
	 * version-compatibility notice.
	 *
	 * @return Abstract_Addon
	 */
	private function addon_requiring_a_newer_godam() {
		return new class() extends Abstract_Addon {

			public function get_slug() {
				return 'future-addon';
			}

			public function get_name() {
				return 'Future Add-on';
			}

			public function get_version() {
				return '1.0.0';
			}

			public function get_path() {
				return __DIR__;
			}

			public function get_url() {
				return 'https://example.org/';
			}

			public function boot() {}

			public function get_minimum_godam_version() {
				return '999.0.0';
			}
		};
	}

	/**
	 * Load admin/godam-transcoder-functions.php once, capturing what it did.
	 *
	 * The file registers hooks at file scope, and `require_once` only fires the
	 * first time, so the state it produced is captured here for every test that
	 * needs it.
	 *
	 * @return array{hooks: array, translated: array}
	 */
	private function load_transcoder_functions() {
		static $at_load = null;

		if ( null === $at_load ) {
			$GLOBALS['rtgodam_hooks']      = array();
			$GLOBALS['rtgodam_translated'] = array();

			require_once dirname( __DIR__, 2 ) . '/admin/godam-transcoder-functions.php';

			$at_load = array(
				'hooks'      => $GLOBALS['rtgodam_hooks'],
				'translated' => $this->translated_texts(),
			);
		}

		return $at_load;
	}
}
