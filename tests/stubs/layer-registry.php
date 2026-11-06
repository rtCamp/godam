<?php
/**
 * Loads the Layer API PHP registry (#2295) for pure unit tests, with the
 * narrow WP stubs it needs.
 *
 * @package GoDAM
 */

require_once __DIR__ . '/hooks.php';
require_once __DIR__ . '/i18n.php';
require_once __DIR__ . '/script-functions.php';

if ( ! defined( 'RTGODAM_PATH' ) ) {
	define( 'RTGODAM_PATH', dirname( __DIR__, 2 ) . '/' );
}

if ( ! function_exists( 'did_action' ) ) {

	/**
	 * @param string $hook Hook.
	 * @return int
	 */
	function did_action( $hook ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return (int) ( $GLOBALS['rtgodam_stub']['did_action'][ $hook ] ?? 0 );
	}
}

if ( ! function_exists( 'wp_json_file_decode' ) ) {

	/**
	 * @param string $filename File.
	 * @param array  $options  `associative`.
	 * @return mixed
	 */
	function wp_json_file_decode( $filename, $options = array() ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		// phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- test stub.
		return json_decode( (string) file_get_contents( $filename ), ! empty( $options['associative'] ) );
	}
}

if ( ! function_exists( 'trailingslashit' ) ) {

	/**
	 * @param string $value Path.
	 * @return string
	 */
	function trailingslashit( $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return rtrim( $value, '/\\' ) . '/';
	}
}

if ( ! function_exists( 'wp_normalize_path' ) ) {

	/**
	 * @param string $path Path.
	 * @return string
	 */
	function wp_normalize_path( $path ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return str_replace( '\\', '/', (string) $path );
	}
}

if ( ! function_exists( 'plugins_url' ) ) {

	/**
	 * @param string $path   Path relative to the plugin file's folder.
	 * @param string $plugin A file in the plugin.
	 * @return string
	 */
	function plugins_url( $path = '', $plugin = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return 'https://example.com/plugins/' . basename( dirname( $plugin ) ) . '/' . ltrim( $path, '/' );
	}
}

if ( ! function_exists( '_doing_it_wrong' ) ) {

	/**
	 * Record the message.
	 *
	 * @param string $function_name Function.
	 * @param string $message       Message.
	 * @param string $version       Version.
	 */
	function _doing_it_wrong( $function_name, $message, $version ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['doing_it_wrong'][] = $message;
	}
}

if ( ! function_exists( 'do_action_deprecated' ) ) {

	/**
	 * Run a deprecated action and record its name when something is hooked to it.
	 *
	 * @param string $hook_name   Hook.
	 * @param array  $args        Arguments.
	 * @param string $version     Version.
	 * @param string $replacement Replacement.
	 */
	function do_action_deprecated( $hook_name, $args, $version, $replacement = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- stub mirroring the WP function.
		if ( has_action( $hook_name ) ) {
			$GLOBALS['rtgodam_stub']['deprecated_hooks'][] = $hook_name . '@' . $version;
		}
		do_action( $hook_name, ...$args );
	}
}

if ( ! function_exists( 'do_shortcode' ) ) {

	/**
	 * Record the shortcode and print nothing.
	 *
	 * @param string $content Content.
	 * @return string
	 */
	function do_shortcode( $content ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['shortcodes'][] = $content;
		return '';
	}
}

require_once RTGODAM_PATH . 'inc/traits/trait-singleton.php';
require_once RTGODAM_PATH . 'inc/classes/layers/class-layer-type-registry.php';
require_once RTGODAM_PATH . 'inc/classes/layers/class-core-layer-types.php';
require_once RTGODAM_PATH . 'inc/classes/layers/class-legacy-layer-types.php';
require_once RTGODAM_PATH . 'inc/classes/layers/class-layer-sanitizer.php';
require_once RTGODAM_PATH . 'inc/helpers/layer-functions.php';

/**
 * Empty the registry and register GoDAM's core layer types again.
 */
function rtgodam_test_register_core_layer_types() {
	\RTGODAM\Inc\Layers\Layer_Type_Registry::get_instance()->reset();
	// The source copies of the core layer folders (the build copies are identical).
	\RTGODAM\Inc\Layers\Core_Layer_Types::get_instance()->register( RTGODAM_PATH . 'assets/src/layers' );
	\RTGODAM\Inc\Layers\Legacy_Layer_Types::register();
}
