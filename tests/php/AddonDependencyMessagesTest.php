<?php
/**
 * Unit tests for add-on dependency notice messages.
 *
 * Regression cover for #465: GoDAM asks add-ons for their dependencies during
 * `plugins_loaded`, so an add-on that builds a translated message there triggers
 * `_load_textdomain_just_in_time was called incorrectly` on every request. A
 * 'message' may therefore be a callback, resolved only when the notice renders.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;
use RTGODAM\Inc\Addons\Abstract_Addon;

require_once __DIR__ . '/../../inc/classes/addons/class-abstract-addon.php';

/**
 * @covers \RTGODAM\Inc\Addons\Abstract_Addon::get_missing_dependency_messages
 * @covers \RTGODAM\Inc\Addons\Abstract_Addon::dependencies_met
 */
class AddonDependencyMessagesTest extends TestCase {

	/**
	 * Build a minimal add-on reporting the given dependencies.
	 *
	 * @param array $dependencies Dependency definitions.
	 *
	 * @return Abstract_Addon
	 */
	private function make_addon( array $dependencies ) {
		return new class( $dependencies ) extends Abstract_Addon {

			/**
			 * Dependencies to report.
			 *
			 * @var array
			 */
			private $dependencies;

			/**
			 * Constructor.
			 *
			 * @param array $dependencies Dependency definitions.
			 */
			public function __construct( array $dependencies ) {
				$this->dependencies = $dependencies;
			}

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
				return $this->dependencies;
			}
		};
	}

	/**
	 * Dependency definition with a message supplied in the requested style.
	 *
	 * @param bool            $satisfied Whether the dependency check passes.
	 * @param string|callable $message   Notice text, or a callback returning it.
	 *
	 * @return array
	 */
	private function dependency( $satisfied, $message ) {
		return array(
			array(
				'name'    => 'WooCommerce',
				'check'   => static function () use ( $satisfied ) {
					return $satisfied;
				},
				'message' => $message,
			),
		);
	}

	/** A callback message is resolved when the messages are requested. */
	public function test_callable_message_is_resolved() {
		$addon = $this->make_addon(
			$this->dependency(
				false,
				static function () {
					return 'WooCommerce is required.';
				}
			)
		);

		$this->assertSame( array( 'WooCommerce is required.' ), $addon->get_missing_dependency_messages() );
	}

	/** A plain string message keeps working, so existing add-ons are unaffected. */
	public function test_string_message_still_works() {
		$addon = $this->make_addon( $this->dependency( false, 'WooCommerce is required.' ) );

		$this->assertSame( array( 'WooCommerce is required.' ), $addon->get_missing_dependency_messages() );
	}

	/**
	 * A message string is returned as-is even when a function of that name
	 * exists, so `is_callable()` on a string can never turn a message into a
	 * function call.
	 */
	public function test_string_message_matching_a_function_name_is_not_invoked() {
		$addon = $this->make_addon( $this->dependency( false, 'phpversion' ) );

		$this->assertSame( array( 'phpversion' ), $addon->get_missing_dependency_messages() );
	}

	/**
	 * The dependency check itself must never build the message. This is the
	 * actual #465 regression: `dependencies_met()` runs on every request, so a
	 * message built there translates on every request.
	 */
	public function test_dependency_check_does_not_build_the_message() {
		$built = 0;
		$addon = $this->make_addon(
			$this->dependency(
				false,
				static function () use ( &$built ) {
					++$built;
					return 'WooCommerce is required.';
				}
			)
		);

		$addon->dependencies_met();

		$this->assertSame( 0, $built, 'The message callback ran during the dependency check.' );

		$addon->get_missing_dependency_messages();

		$this->assertSame( 1, $built, 'The message callback did not run when the notice was built.' );
	}

	/** Satisfied dependencies produce no message at all. */
	public function test_satisfied_dependency_produces_no_message() {
		$addon = $this->make_addon(
			$this->dependency(
				true,
				static function () {
					return 'WooCommerce is required.';
				}
			)
		);

		$this->assertTrue( $addon->dependencies_met() );
		$this->assertSame( array(), $addon->get_missing_dependency_messages() );
	}
}
