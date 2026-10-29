<?php
/**
 * Shortcode registry and runner stubs for the pure (no-WordPress) unit suite.
 *
 * add_shortcode() fills the same `$shortcode_tags` global core uses (left unset until a test
 * registers a tag; video-seo-functions.php gives it a default set for the SEO tests), and
 * do_shortcode() expands registered tags with core's own pattern, so a test can tell whether text that
 * reaches do_shortcode() runs another shortcode. Every string handed to do_shortcode() is
 * also recorded in `$GLOBALS['rtgodam_stub']['shortcodes']`; with no tag registered it
 * returns '' (the recorder FormLayerPreviewIdTest relies on).
 *
 * rtgodam_stub_register_player_and_marker() registers the two shortcodes the player-attribute
 * tests use: a `godam_video` double that records the attributes it is given in
 * `$GLOBALS['rtgodam_stub']['player_atts']`, and a `gx_marker` shortcode that counts its runs in
 * `$GLOBALS['rtgodam_stub']['marker_runs']`.
 *
 * @package GoDAM
 */

// phpcs:disable WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound, WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedVariableFound, Generic.CodeAnalysis.UnusedFunctionParameter.Found, Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- stubs mirroring WP functions.

// get_shortcode_regex() and shortcode_parse_atts(), copied from core.
require_once __DIR__ . '/shortcode-functions.php';

if ( ! function_exists( 'add_shortcode' ) ) {

	/**
	 * @param string   $tag      Shortcode tag.
	 * @param callable $callback Callback.
	 * @return void
	 */
	function add_shortcode( $tag, $callback ) {
		global $shortcode_tags;
		$shortcode_tags[ $tag ] = $callback;
	}
}

if ( ! function_exists( 'remove_shortcode' ) ) {

	/**
	 * @param string $tag Shortcode tag.
	 * @return void
	 */
	function remove_shortcode( $tag ) {
		global $shortcode_tags;
		unset( $shortcode_tags[ $tag ] );
	}
}

if ( ! function_exists( 'shortcode_exists' ) ) {

	/**
	 * @param string $tag Shortcode tag.
	 * @return bool
	 */
	function shortcode_exists( $tag ) {
		global $shortcode_tags;
		return isset( $shortcode_tags ) && array_key_exists( $tag, $shortcode_tags );
	}
}

if ( ! function_exists( 'rtgodam_stub_do_shortcode_tag' ) ) {

	/**
	 * Core's do_shortcode_tag(), without the filters.
	 *
	 * @param array $m Regular expression match array.
	 * @return string
	 */
	function rtgodam_stub_do_shortcode_tag( $m ) {
		global $shortcode_tags;

		// Allow [[foo]] syntax for escaping a tag.
		if ( '[' === $m[1] && ']' === $m[6] ) {
			return substr( $m[0], 1, -1 );
		}

		$tag     = $m[2];
		$attr    = shortcode_parse_atts( $m[3] );
		$content = isset( $m[5] ) ? $m[5] : null;

		return $m[1] . call_user_func( $shortcode_tags[ $tag ], $attr, $content, $tag ) . $m[6];
	}
}

if ( ! function_exists( 'do_shortcode' ) ) {

	/**
	 * Record the string, then expand the registered shortcodes in it as core does.
	 *
	 * @param string $content     Content with shortcodes.
	 * @param bool   $ignore_html Ignored.
	 * @return string
	 */
	function do_shortcode( $content, $ignore_html = false ) {
		global $shortcode_tags;

		$GLOBALS['rtgodam_stub']['shortcodes'][] = $content;

		if ( empty( $shortcode_tags ) ) {
			return '';
		}

		if ( false === strpos( $content, '[' ) ) {
			return $content;
		}

		preg_match_all( '@\[([^<>&/\[\]\x00-\x20=]++)@', $content, $matches );
		$tagnames = array_intersect( array_keys( $shortcode_tags ), $matches[1] );

		if ( empty( $tagnames ) ) {
			return $content;
		}

		return preg_replace_callback( '/' . get_shortcode_regex( $tagnames ) . '/', 'rtgodam_stub_do_shortcode_tag', $content );
	}
}

if ( ! function_exists( 'apply_filters_deprecated' ) ) {

	/**
	 * Runs a deprecated filter when something is hooked to it, and records the hook name.
	 *
	 * @param string $hook_name   Hook name.
	 * @param array  $args        Arguments passed to the callbacks.
	 * @param string $version     Version it was deprecated in.
	 * @param string $replacement Hook to use instead.
	 * @return mixed
	 */
	function apply_filters_deprecated( $hook_name, $args, $version, $replacement = '' ) {
		if ( ! has_filter( $hook_name ) ) {
			return $args[0];
		}

		$GLOBALS['rtgodam_stub']['deprecated_hooks'][] = $hook_name;

		return apply_filters( $hook_name, ...$args );
	}
}

if ( ! function_exists( 'rtgodam_stub_register_player_and_marker' ) ) {

	/**
	 * Start a case with only the player double and the marker shortcode registered.
	 *
	 * @return void
	 */
	function rtgodam_stub_register_player_and_marker() {
		$GLOBALS['shortcode_tags']              = array();
		$GLOBALS['rtgodam_stub']['player_atts'] = array();
		$GLOBALS['rtgodam_stub']['marker_runs'] = 0;

		add_shortcode(
			'godam_video',
			static function ( $atts ) {
				$GLOBALS['rtgodam_stub']['player_atts'][] = $atts;

				$atts = is_array( $atts ) ? $atts : array();

				return '<div class="godam-player-double" data-id="' . esc_attr( $atts['id'] ?? '' ) . '" data-src="' . esc_attr( $atts['src'] ?? '' ) . '" data-transcoded-url="' . esc_attr( $atts['transcoded_url'] ?? '' ) . '"></div>';
			}
		);

		add_shortcode(
			'gx_marker',
			static function () {
				++$GLOBALS['rtgodam_stub']['marker_runs'];

				return 'GX-MARKER';
			}
		);
	}
}
