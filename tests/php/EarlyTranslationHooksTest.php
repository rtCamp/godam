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
	 * The WPForms field translates its labels in the constructor, so it must not
	 * be built on `wpforms_loaded` (which fires during `plugins_loaded`).
	 *
	 * Only this callback is pinned to `init`. An unrelated future
	 * `add_action( 'wpforms_loaded', … )` in the same file is nobody's business
	 * here, and failing on it would make this guard an obstacle rather than a net.
	 */
	public function test_wpforms_field_is_registered_on_init() {
		$source = $this->source( 'inc/classes/wpforms/class-wpforms-integration.php' );

		$this->assertDoesNotMatchRegularExpression(
			$this->registration_pattern( 'wpforms_loaded', 'init_godam_video_field' ),
			$source
		);
		$this->assertMatchesRegularExpression( $this->registration_pattern( 'init', 'init_godam_video_field' ), $source );
	}

	/**
	 * `init` is later than `wpforms_loaded`, so WPForms having booted is no longer
	 * implied by the hook firing. The field's parent class is declared
	 * conditionally, so instantiating it unguarded is a fatal on every request
	 * when WPForms is active but did not boot.
	 */
	public function test_wpforms_field_instantiation_is_guarded() {
		$source = $this->source( 'inc/classes/wpforms/class-wpforms-integration.php' );

		$this->assertMatchesRegularExpression(
			'/function\s+init_godam_video_field\(\s*\)\s*\{\s*if\s*\(\s*!\s*class_exists\(\s*[\'"]WPForms_Field[\'"]\s*\)\s*\)/',
			$source
		);
	}

	/**
	 * Same for the Fluent Forms recorder field, previously built on
	 * `fluentform/loaded`.
	 */
	public function test_fluentforms_field_is_registered_on_init() {
		$source = $this->source( 'inc/classes/fluentforms/class-init.php' );

		$this->assertDoesNotMatchRegularExpression(
			$this->registration_pattern( 'fluentform/loaded', 'on_fluentforms_loaded' ),
			$source
		);
		$this->assertMatchesRegularExpression( $this->registration_pattern( 'init', 'on_fluentforms_loaded' ), $source );
	}

	/**
	 * `Recorder_Field extends BaseFieldManager` unconditionally, so the same
	 * `init` timing problem is a fatal here too — and with no conditional class
	 * declaration to soften it.
	 */
	public function test_fluentforms_field_instantiation_is_guarded() {
		$source = $this->source( 'inc/classes/fluentforms/class-init.php' );

		$this->assertMatchesRegularExpression(
			'/function\s+on_fluentforms_loaded\(\s*\)\s*\{\s*if\s*\(\s*!\s*class_exists\(\s*[\'"][^\'"]*BaseFieldManager[\'"]\s*\)\s*\)/',
			$source
		);
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

	/**
	 * Nothing in that file registers a media column hook at file scope.
	 *
	 * The sortable-columns filter used to, which meant it ran on front-end, REST
	 * and cron requests as well, and advertised a column that the API key check
	 * may have declined to add. All three registrations now happen together.
	 */
	public function test_no_media_column_hook_is_registered_at_file_scope() {
		$source = $this->source( 'admin/godam-transcoder-functions.php' );

		// Unindented add_filter/add_action is file scope; inside a function it is
		// always indented.
		$this->assertDoesNotMatchRegularExpression(
			'/^add_(action|filter)\(\s*[\'"]manage_/m',
			$source
		);

		$body = $this->function_body( $source, 'rtgodam_register_media_status_columns' );

		foreach ( array( 'manage_media_columns', 'manage_media_custom_column', 'manage_upload_sortable_columns' ) as $hook ) {
			$this->assertStringContainsString(
				$hook,
				$body,
				sprintf( '%s is not registered by rtgodam_register_media_status_columns().', $hook )
			);
		}
	}

	/**
	 * Body of a top-level function, which WordPress style puts between a
	 * `function foo() {` and a `}` both at column 0.
	 *
	 * @param string $source Source file contents.
	 * @param string $name   Function name.
	 *
	 * @return string
	 */
	private function function_body( $source, $name ) {
		$matched = preg_match(
			'/^function\s+' . preg_quote( $name, '/' ) . '\([^)]*\)\s*\{$(.*?)^\}$/ms',
			$source,
			$matches
		);

		$this->assertSame( 1, $matched, sprintf( 'Could not find function %s().', $name ) );

		return $matches[1];
	}
}
