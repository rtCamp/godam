<?php
/**
 * Narrow post stubs: get_post() and is_post_publicly_viewable().
 *
 * Shared by the video SEO / sitemap tests (through video-seo-functions.php) and
 * the Engagement and Analytics route tests, which need them without the rest of
 * that file. Both read from `$GLOBALS['rtgodam_stub']`, which each test resets.
 * Guarded so a real WordPress bootstrap wins.
 *
 * @package GoDAM
 */

// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found -- test stubs mirroring WP APIs.

if ( ! function_exists( 'get_post' ) ) {

	/**
	 * @param int $post_id Post ID.
	 * @return object|null Post from $GLOBALS['rtgodam_stub']['site_posts'][ $post_id ]
	 *                     (see rtgodam_stub_video()), else from `posts`.
	 */
	function get_post( $post_id = 0 ) {
		return $GLOBALS['rtgodam_stub']['site_posts'][ (int) $post_id ] ?? $GLOBALS['rtgodam_stub']['posts'][ (int) $post_id ] ?? null;
	}
}

if ( ! function_exists( 'is_post_publicly_viewable' ) ) {

	/**
	 * Published posts are viewable; a post stub without a status counts as published.
	 *
	 * @param WP_Post|object $post Post.
	 * @return bool
	 */
	function is_post_publicly_viewable( $post = null ) {
		return is_object( $post ) && 'publish' === ( $post->post_status ?? 'publish' );
	}
}
