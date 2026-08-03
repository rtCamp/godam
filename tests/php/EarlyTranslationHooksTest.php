<?php
/**
 * Guard against reintroducing #465.
 *
 * Three GoDAM call sites used to translate during `plugins_loaded`, which makes
 * WordPress 6.7+ log `_load_textdomain_just_in_time was called incorrectly` and,
 * with WP_DEBUG_DISPLAY on, print that notice into the page. Core reports only
 * the first such call per text domain per request, so a regression in any one of
 * these is easy to miss by eye. These assertions read the source directly.
 *
 * @package GoDAM
 */

namespace RTGODAM\Tests;

use PHPUnit\Framework\TestCase;

/**
 * @coversNothing
 */
class EarlyTranslationHooksTest extends TestCase {

	/**
	 * Read a plugin source file.
	 *
	 * @param string $relative_path Path relative to the plugin root.
	 *
	 * @return string
	 */
	private function source( $relative_path ) {
		$path = dirname( __DIR__, 2 ) . '/' . $relative_path;

		$this->assertFileExists( $path );

		return (string) file_get_contents( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
	}

	/**
	 * The WPForms field translates its labels in the constructor, so it must not
	 * be built on `wpforms_loaded` (which fires during `plugins_loaded`).
	 */
	public function test_wpforms_field_is_registered_on_init() {
		$source = $this->source( 'inc/classes/wpforms/class-wpforms-integration.php' );

		$this->assertStringNotContainsString( "add_action( 'wpforms_loaded'", $source );
		$this->assertStringContainsString( "add_action( 'init', array( \$this, 'init_godam_video_field' ) )", $source );
	}

	/**
	 * Same for the Fluent Forms recorder field, previously built on
	 * `fluentform/loaded`.
	 */
	public function test_fluentforms_field_is_registered_on_init() {
		$source = $this->source( 'inc/classes/fluentforms/class-init.php' );

		$this->assertStringNotContainsString( "add_action( 'fluentform/loaded'", $source );
		$this->assertStringContainsString( "add_action( 'init', array( \$this, 'on_fluentforms_loaded' ) )", $source );
	}

	/**
	 * The add-on compatibility warning builds translated notice text, so it runs
	 * on `admin_init` rather than inline during `plugins_loaded`.
	 */
	public function test_addon_compatibility_warning_runs_on_admin_init() {
		$source = $this->source( 'inc/classes/addons/class-addon-registry.php' );

		$this->assertStringNotContainsString( '$this->warn_incompatible_addons();', $source );
		$this->assertStringContainsString( "add_action( 'admin_init', array( \$this, 'warn_incompatible_addons' ) )", $source );
	}

	/**
	 * Add-on boot notices are built by a callback at render time, so nothing in
	 * `boot_addons()` translates during `plugins_loaded`.
	 */
	public function test_addon_boot_notices_are_deferred() {
		$source = $this->source( 'inc/classes/addons/class-addon-registry.php' );

		$this->assertStringContainsString( 'private function show_admin_notice( callable $message_callback )', $source );
	}
}
