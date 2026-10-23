<?php
/**
 * Narrow WordPress stubs for the Engagement REST route tests.
 *
 * They cover the current user, avatars, the object cache and wp_remote_post().
 * Each reads per-test state from `$GLOBALS['rtgodam_stub']`, matching the
 * convention in bootstrap.php:
 *  - `home_url`     the site's home URL (default https://example.test);
 *  - `user`         array( 'email' => ..., 'name' => ... ) for a signed-in user;
 *                   leave it unset for a logged-out visitor.
 *  - `post_handler` callable( $url, $args ) that answers a wp_remote_post() call.
 *  - `posts`        every wp_remote_post() call, recorded as array( 'url', 'args' ).
 *  - `site_posts`, `attachment_meta`, `video_posts`, `object_caps`
 *                   the site's videos, which the routes look up before they ask
 *                   Central: see rtgodam_stub_video(). `site_posts` is what
 *                   get_post() reads (video-seo-functions.php), kept apart from
 *                   `posts` above; `attachment_meta` and `object_caps` are read
 *                   by get_post_meta() and current_user_can() in bootstrap.php.
 *  - `get_posts_args` every get_posts() query, recorded.
 *
 * All guarded so a real WP test bootstrap that already defines these wins.
 *
 * @package GoDAM
 */

// Same value as tests/stubs/site-functions.php, so the constant is the same
// whichever stub file loads first; no test depends on it.
if ( ! defined( 'RTGODAM_API_BASE' ) ) {
	define( 'RTGODAM_API_BASE', 'https://api.test' );
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
			'ID'           => $user['id'] ?? 0,
			'user_email'   => $user['email'] ?? '',
			'display_name' => $user['name'] ?? '',
			// Like WordPress: an empty object for a visitor who is not signed in.
			'data'         => (object) ( isset( $user['email'] ) ? array( 'user_email' => $user['email'] ) : array() ),
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
	 * The home URL a test sets in `home_url`, https://example.test otherwise:
	 * the same key and default as tests/stubs/site-functions.php, so either
	 * file can load first.
	 *
	 * @param string $path Path to append.
	 * @return string
	 */
	function home_url( $path = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		return ( isset( $GLOBALS['rtgodam_stub']['home_url'] ) ? (string) $GLOBALS['rtgodam_stub']['home_url'] : 'https://example.test' ) . $path;
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

if ( ! function_exists( 'rtgodam_stub_video' ) ) {

	/**
	 * Adds an attachment of the site, with the lookups the Engagement routes make.
	 *
	 * The attachment is found by its ID and, when it has a job, by get_posts()
	 * searching for that job. A status other than 'publish' makes it non-public
	 * for is_post_publicly_viewable().
	 *
	 * @param int    $attachment_id Attachment ID.
	 * @param string $job_id        Transcoding job ID, or '' for an attachment without one.
	 * @param string $status        'publish' for a public attachment, 'private' for one only some users may read.
	 * @param string $post_type     Post type, 'attachment' unless a test needs another.
	 * @return void
	 */
	function rtgodam_stub_video( $attachment_id, $job_id, $status = 'publish', $post_type = 'attachment' ) {
		$GLOBALS['rtgodam_stub']['site_posts'][ $attachment_id ] = (object) array(
			'ID'          => $attachment_id,
			'post_type'   => $post_type,
			'post_status' => $status,
		);

		$GLOBALS['rtgodam_stub']['attachment_meta'][ $attachment_id ] = '' === $job_id ? array() : array( 'rtgodam_transcoding_job_id' => $job_id );

		if ( '' !== $job_id ) {
			$GLOBALS['rtgodam_stub']['video_posts'][ $job_id ][] = $attachment_id;
		}
	}
}

if ( ! function_exists( 'get_posts' ) ) {

	/**
	 * Answers the job lookup: the attachments rtgodam_stub_video() registered for the
	 * job the query asks for. The query is recorded.
	 *
	 * @param array $args Query args; the job is the first meta_query value.
	 * @return int[]
	 */
	function get_posts( $args = array() ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['get_posts_args'][] = $args;

		return $GLOBALS['rtgodam_stub']['video_posts'][ $args['meta_query'][0]['value'] ?? '' ] ?? array();
	}
}
