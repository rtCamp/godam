<?php
/**
 * Stubs for the ability tests: wp_register_ability() records what each
 * ability was registered with, and add_option() stores into the options stub
 * that get_option() reads.
 *
 * @package GoDAM
 */

if ( ! function_exists( 'wp_register_ability' ) ) {

	/**
	 * Records the ability instead of registering it.
	 *
	 * @param string $name Ability name.
	 * @param array  $args Ability arguments.
	 * @return void
	 */
	function wp_register_ability( $name, $args ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['abilities'][ $name ] = $args;
	}
}

if ( ! function_exists( 'add_option' ) ) {

	/**
	 * Stores the option unless it exists, like core.
	 *
	 * @param string $option Option name.
	 * @param mixed  $value  Value.
	 * @return bool
	 */
	function add_option( $option, $value = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		if ( isset( $GLOBALS['rtgodam_stub']['options'] ) && array_key_exists( $option, $GLOBALS['rtgodam_stub']['options'] ) ) {
			return false;
		}

		$GLOBALS['rtgodam_stub']['options'][ $option ] = $value;
		return true;
	}
}
