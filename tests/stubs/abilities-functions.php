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

if ( ! function_exists( 'get_current_user_id' ) ) {

	/**
	 * The user the notice tests act as.
	 *
	 * @return int
	 */
	function get_current_user_id() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return 1;
	}
}

if ( ! function_exists( 'get_user_meta' ) ) {

	/**
	 * Reads user meta from the stub.
	 *
	 * @param int    $user_id User ID.
	 * @param string $key     Meta key.
	 * @return mixed
	 */
	function get_user_meta( $user_id, $key ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return $GLOBALS['rtgodam_stub']['user_meta'][ $user_id ][ $key ] ?? '';
	}
}

if ( ! function_exists( 'update_user_meta' ) ) {

	/**
	 * Stores user meta in the stub.
	 *
	 * @param int    $user_id User ID.
	 * @param string $key     Meta key.
	 * @param mixed  $value   Value.
	 * @return bool
	 */
	function update_user_meta( $user_id, $key, $value ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['user_meta'][ $user_id ][ $key ] = $value;
		return true;
	}
}
