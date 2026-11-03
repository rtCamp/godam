<?php
/**
 * Narrow WordPress stubs for EmbedGodamUrlTest.
 *
 * wp_kses() records its calls in `$GLOBALS['rtgodam_stub']['kses_calls']` and
 * returns `kses_result` when a test sets it (standing in for HTML being
 * removed), else its input. wp_kses_allowed_html() records its context in
 * `kses_context`. wp_oembed_add_provider() records each provider in `providers`.
 *
 * @package GoDAM
 */

if ( ! function_exists( 'wp_kses_allowed_html' ) ) {

	/**
	 * @param string $context Context.
	 * @return array A single allowed element, so a test can tell the post markup was the base.
	 */
	function wp_kses_allowed_html( $context = '' ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['kses_context'] = $context;

		return array( 'p' => array() );
	}
}

if ( ! function_exists( 'wp_kses' ) ) {

	/**
	 * @param string $content Content.
	 * @param array  $allowed Allowed HTML.
	 * @return string
	 */
	function wp_kses( $content, $allowed ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['kses_calls'][] = array(
			'content' => $content,
			'allowed' => $allowed,
		);

		return $GLOBALS['rtgodam_stub']['kses_result'] ?? $content;
	}
}

if ( ! function_exists( 'wp_oembed_add_provider' ) ) {

	/**
	 * @param string $format   URL pattern.
	 * @param string $provider Endpoint.
	 * @param bool   $regex    Whether the pattern is a regex.
	 * @return void
	 */
	function wp_oembed_add_provider( $format, $provider, $regex = false ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$GLOBALS['rtgodam_stub']['providers'][] = array( $format, $provider, $regex );
	}
}
