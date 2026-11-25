<?php
/**
 * Stubs for deciding how a stylesheet is printed (DeferredPlayerStylesTest).
 *
 * Driven by `$GLOBALS['rtgodam_stub']`: `did_action`, `did_filter` (hook => count)
 * and `block_theme` (bool).
 *
 * @package GoDAM
 */

if ( ! function_exists( 'did_action' ) ) {

	/**
	 * @param string $hook Hook.
	 * @return int
	 */
	function did_action( $hook ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return (int) ( $GLOBALS['rtgodam_stub']['did_action'][ $hook ] ?? 0 );
	}
}

if ( ! function_exists( 'did_filter' ) ) {

	/**
	 * @param string $hook Hook.
	 * @return int
	 */
	function did_filter( $hook ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return (int) ( $GLOBALS['rtgodam_stub']['did_filter'][ $hook ] ?? 0 );
	}
}

if ( ! function_exists( 'wp_is_block_theme' ) ) {

	/**
	 * @return bool
	 */
	function wp_is_block_theme() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return ! empty( $GLOBALS['rtgodam_stub']['block_theme'] );
	}
}
