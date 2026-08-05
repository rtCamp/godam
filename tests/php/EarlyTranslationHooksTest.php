<?php
/**
 * Guard against reintroducing #465.
 *
 * Four GoDAM call sites used to translate before `init` — three during
 * `plugins_loaded`, one at plugin file load — which makes WordPress 6.7+ log
 * `_load_textdomain_just_in_time was called incorrectly` and, with
 * WP_DEBUG_DISPLAY on, print that notice into the page.
 *
 * Core reports only the first such call per text domain per request, so a
 * regression in any one of these is easy to miss by eye. The media-column site
 * is worse still: it only translates once the cached API key data is over an
 * hour old, so it reads as clean on almost every request even with a `gettext`
 * filter attached. These assertions read the source directly instead.
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
	 * Pattern matching `add_action( '<hook>', … '<callback>' … )`, tolerating
	 * whitespace, short array syntax and extra arguments, so that a harmless
	 * reformat does not fail the guard.
	 *
	 * @param string $hook     Hook name.
	 * @param string $callback Method name.
	 *
	 * @return string
	 */
	private function registration_pattern( $hook, $callback ) {
		return '/add_action\(\s*[\'"]' . preg_quote( $hook, '/' ) . '[\'"][^)]*[\'"]' . preg_quote( $callback, '/' ) . '[\'"]/';
	}

	/**
	 * Pattern matching any registration on the given hook, whatever the callback.
	 *
	 * @param string $hook Hook name.
	 *
	 * @return string
	 */
	private function hook_pattern( $hook ) {
		return '/add_action\(\s*[\'"]' . preg_quote( $hook, '/' ) . '[\'"]/';
	}

	/**
	 * The WPForms field translates its labels in the constructor, so it must not
	 * be built on `wpforms_loaded` (which fires during `plugins_loaded`).
	 */
	public function test_wpforms_field_is_registered_on_init() {
		$source = $this->source( 'inc/classes/wpforms/class-wpforms-integration.php' );

		$this->assertDoesNotMatchRegularExpression( $this->hook_pattern( 'wpforms_loaded' ), $source );
		$this->assertMatchesRegularExpression( $this->registration_pattern( 'init', 'init_godam_video_field' ), $source );
	}

	/**
	 * Same for the Fluent Forms recorder field, previously built on
	 * `fluentform/loaded`.
	 */
	public function test_fluentforms_field_is_registered_on_init() {
		$source = $this->source( 'inc/classes/fluentforms/class-init.php' );

		$this->assertDoesNotMatchRegularExpression( $this->hook_pattern( 'fluentform/loaded' ), $source );
		$this->assertMatchesRegularExpression( $this->registration_pattern( 'init', 'on_fluentforms_loaded' ), $source );
	}

	/**
	 * The add-on compatibility warning builds translated notice text, so it runs
	 * on `admin_init` rather than inline during `plugins_loaded`.
	 */
	public function test_addon_compatibility_warning_runs_on_admin_init() {
		$source = $this->source( 'inc/classes/addons/class-addon-registry.php' );

		$this->assertDoesNotMatchRegularExpression( '/\$this->warn_incompatible_addons\(\s*\)\s*;/', $source );
		$this->assertMatchesRegularExpression( $this->registration_pattern( 'admin_init', 'warn_incompatible_addons' ), $source );
	}

	/**
	 * Add-on boot notices are built by a callback at render time, so nothing in
	 * `boot_addons()` translates during `plugins_loaded`.
	 */
	public function test_addon_boot_notices_are_deferred() {
		$source = $this->source( 'inc/classes/addons/class-addon-registry.php' );

		$this->assertMatchesRegularExpression(
			'/function\s+show_admin_notice\(\s*callable\s+\$\w+\s*\)/',
			$source
		);
	}

	/**
	 * The media list table column is registered on `admin_init`, not at file
	 * load. Deciding whether to register it resolves the API key, which can call
	 * `rtgodam_verify_api_key()` and translate, so a file-scope call translated
	 * before `init`.
	 */
	public function test_media_status_columns_are_registered_on_admin_init() {
		$source = $this->source( 'admin/godam-transcoder-functions.php' );

		// File scope, not a call inside a function: those are always indented.
		$this->assertDoesNotMatchRegularExpression(
			'/^\$\w+\s*=\s*rtgodam_get_user_data\(/m',
			$source
		);

		$this->assertMatchesRegularExpression(
			$this->registration_pattern( 'admin_init', 'rtgodam_register_media_status_columns' ),
			$source
		);
	}
}
