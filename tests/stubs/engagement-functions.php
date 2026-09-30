<?php
/**
 * Narrow WordPress stubs for the Engagement REST route tests.
 *
 * They cover the current user, avatars, the object cache and wp_remote_post().
 * Each reads per-test state from `$GLOBALS['rtgodam_stub']`, matching the
 * convention in bootstrap.php:
 *  - `user`         array( 'email' => ..., 'name' => ... ) for a signed-in user;
 *                   leave it unset for a logged-out visitor.
 *  - `post_handler` callable( $url, $args ) that answers a wp_remote_post() call.
 *  - `posts`        every wp_remote_post() call, recorded as array( 'url', 'args' ).
 *
 * All guarded so a real WP test bootstrap that already defines these wins.
 *
 * @package GoDAM
 */

if ( ! defined( 'RTGODAM_API_BASE' ) ) {
	define( 'RTGODAM_API_BASE', 'https://central.test' );
}

if ( ! function_exists( 'is_user_logged_in' ) ) {

	/**
	 * @return bool
	 */
	function is_user_logged_in() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return ! empty( $GLOBALS['rtgodam_stub']['user'] );
	}
}

if ( ! function_exists( 'wp_get_current_user' ) ) {

	/**
	 * @return object Only the fields the plugin reads.
	 */
	function wp_get_current_user() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$user = $GLOBALS['rtgodam_stub']['user'] ?? array();

		return (object) array(
			'user_email'   => $user['email'] ?? '',
			'display_name' => $user['name'] ?? '',
		);
	}
}

if ( ! function_exists( 'get_avatar_url' ) ) {

	/**
	 * A stand-in URL that is stable per email, like a Gravatar link.
	 *
	 * @param mixed $id_or_email User ID or email.
	 * @return string
	 */
	function get_avatar_url( $id_or_email ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return 'https://avatar.test/' . md5( strtolower( (string) $id_or_email ) ) . '?s=96';
	}
}

if ( ! function_exists( 'wp_timezone' ) ) {

	/**
	 * UTC unless a test sets `timezone`, so another test file's stub of this
	 * function can be the one that loads first without losing its zone.
	 *
	 * @return DateTimeZone
	 */
	function wp_timezone() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return $GLOBALS['rtgodam_stub']['timezone'] ?? new DateTimeZone( 'UTC' );
	}
}

if ( ! function_exists( 'home_url' ) ) {

	/**
	 * @param string $path Path to append.
	 * @return string
	 */
	function home_url( $path = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return 'https://www.example.com' . $path;
	}
}

if ( ! function_exists( 'wp_parse_args' ) ) {

	/**
	 * @param array $args     Values that win.
	 * @param array $defaults Values used when missing.
	 * @return array
	 */
	function wp_parse_args( $args, $defaults = array() ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return array_merge( (array) $defaults, (array) $args );
	}
}

if ( ! function_exists( 'wp_using_ext_object_cache' ) ) {

	/**
	 * @return bool The tests use the transient path.
	 */
	function wp_using_ext_object_cache() { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return false;
	}
}

if ( ! function_exists( 'delete_transient' ) ) {

	/**
	 * @param string $key Transient key.
	 * @return bool
	 */
	function delete_transient( $key ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		unset( $GLOBALS['rtgodam_stub']['transient'][ $key ] );
		return true;
	}
}

if ( ! function_exists( 'wp_remote_post' ) ) {

	/**
	 * Records the call, then lets the test answer it.
	 *
	 * @param string $url  Requested URL.
	 * @param array  $args Request args, including the JSON body.
	 * @return mixed The handler's response, or an empty 200.
	 */
	function wp_remote_post( $url, $args = array() ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['posts'][] = array(
			'url'  => $url,
			'args' => $args,
		);

		$handler = $GLOBALS['rtgodam_stub']['post_handler'] ?? null;

		return is_callable( $handler ) ? $handler( $url, $args ) : array(
			'code' => 200,
			'body' => '{}',
		);
	}
}
