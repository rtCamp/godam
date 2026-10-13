<?php
/**
 * Minimal WordPress hook registry for unit tests.
 *
 * Enough of the Plugin API to observe *when* a callback is registered and to run
 * a hook on demand. That is what lets the #465 guards assert on behaviour — which
 * hook a registration lands on, and whether anything translates while a given
 * hook runs — instead of on the shape of the source.
 *
 * Registration order within a priority is preserved; priorities run low to high,
 * as in core. `$GLOBALS['rtgodam_hooks']` is the registry, and tests reset it in
 * setUp().
 *
 * @package GoDAM
 */

if ( ! isset( $GLOBALS['rtgodam_hooks'] ) ) {
	$GLOBALS['rtgodam_hooks'] = array();
}

if ( ! function_exists( 'add_filter' ) ) {

	/**
	 * Record a callback against a hook.
	 *
	 * @param string   $hook          Hook name.
	 * @param callable $callback      Callback.
	 * @param int      $priority      Priority.
	 * @param int      $accepted_args Argument count. Unused.
	 *
	 * @return true
	 */
	function add_filter( $hook, $callback, $priority = 10, $accepted_args = 1 ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- stub mirroring the WP function.
		$GLOBALS['rtgodam_hooks'][ $hook ][ $priority ][] = $callback;
		return true;
	}
}

if ( ! function_exists( 'add_action' ) ) {

	/**
	 * Actions and filters share one registry in core, and here too.
	 *
	 * @param string   $hook          Hook name.
	 * @param callable $callback      Callback.
	 * @param int      $priority      Priority.
	 * @param int      $accepted_args Argument count.
	 *
	 * @return true
	 */
	function add_action( $hook, $callback, $priority = 10, $accepted_args = 1 ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return add_filter( $hook, $callback, $priority, $accepted_args );
	}
}

if ( ! function_exists( 'apply_filters' ) ) {

	/**
	 * Run every callback on a hook, threading the first argument through.
	 *
	 * @param string $hook  Hook name.
	 * @param mixed  $value Value to filter.
	 * @param mixed  ...$args Extra arguments.
	 *
	 * @return mixed
	 */
	function apply_filters( $hook, $value = null, ...$args ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$callbacks = $GLOBALS['rtgodam_hooks'][ $hook ] ?? array();
		ksort( $callbacks );

		foreach ( $callbacks as $at_priority ) {
			foreach ( $at_priority as $callback ) {
				$value = $callback( $value, ...$args );
			}
		}

		return $value;
	}
}

if ( ! function_exists( 'do_action' ) ) {

	/**
	 * Run every callback on a hook, discarding return values.
	 *
	 * @param string $hook Hook name.
	 * @param mixed  ...$args Arguments passed to each callback.
	 *
	 * @return void
	 */
	function do_action( $hook, ...$args ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$callbacks = $GLOBALS['rtgodam_hooks'][ $hook ] ?? array();
		ksort( $callbacks );

		foreach ( $callbacks as $at_priority ) {
			foreach ( $at_priority as $callback ) {
				$callback( ...$args );
			}
		}
	}
}

if ( ! function_exists( 'has_action' ) ) {

	/**
	 * Whether a hook has any callback, or a specific one.
	 *
	 * @param string        $hook     Hook name.
	 * @param callable|null $callback Callback to look for, or null for any.
	 *
	 * @return bool
	 */
	function has_action( $hook, $callback = null ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$callbacks = $GLOBALS['rtgodam_hooks'][ $hook ] ?? array();

		if ( null === $callback ) {
			return array() !== $callbacks;
		}

		foreach ( $callbacks as $at_priority ) {
			foreach ( $at_priority as $registered ) {
				if ( $registered === $callback ) {
					return true;
				}
			}
		}

		return false;
	}
}

if ( ! function_exists( 'has_filter' ) ) {

	/**
	 * @param string        $hook     Hook name.
	 * @param callable|null $callback Callback to look for.
	 *
	 * @return bool
	 */
	function has_filter( $hook, $callback = null ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return has_action( $hook, $callback );
	}
}

if ( ! function_exists( 'is_admin' ) ) {

	/**
	 * Admin-request flag, set per test via $GLOBALS['rtgodam_stub']['is_admin'].
	 *
	 * @return bool
	 */
	function is_admin() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return ! empty( $GLOBALS['rtgodam_stub']['is_admin'] );
	}
}

if ( ! function_exists( 'is_plugin_active' ) ) {

	/**
	 * Active-plugin check, driven by $GLOBALS['rtgodam_stub']['active_plugins'].
	 *
	 * @param string $plugin Plugin basename.
	 *
	 * @return bool
	 */
	function is_plugin_active( $plugin ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$active = $GLOBALS['rtgodam_stub']['active_plugins'] ?? array();
		return in_array( $plugin, (array) $active, true );
	}
}
