<?php
/**
 * Shortcode parsing stubs for unit tests, copied from WordPress core
 * (wp-includes/shortcodes.php) so shortcode extraction can be tested
 * without loading WordPress.
 *
 * @package GoDAM
 */

if ( ! function_exists( 'get_shortcode_regex' ) ) {

	/**
	 * WordPress core's get_shortcode_regex().
	 *
	 * @param array $tagnames Shortcode tags.
	 * @return string
	 */
	function get_shortcode_regex( $tagnames = array() ) {
		$tagregexp = implode( '|', array_map( 'preg_quote', $tagnames ) );

		return '\\['
			. '(\\[?)'
			. "($tagregexp)"
			. '(?![\\w-])'
			. '('
			. '[^\\]\\/]*'
			. '(?:'
			. '\\/(?!\\])'
			. '[^\\]\\/]*'
			. ')*?'
			. ')'
			. '(?:'
			. '(\\/)'
			. '\\]'
			. '|'
			. '\\]'
			. '(?:'
			. '('
			. '[^\\[]*+'
			. '(?:'
			. '\\[(?!\\/\\2\\])'
			. '[^\\[]*+'
			. ')*+'
			. ')'
			. '\\[\\/\\2\\]'
			. ')?'
			. ')'
			. '(\\]?)';
	}
}

if ( ! function_exists( 'shortcode_parse_atts' ) ) {

	/**
	 * WordPress core's shortcode_parse_atts().
	 *
	 * @param string $text Attribute string.
	 * @return array|string
	 */
	function shortcode_parse_atts( $text ) {
		$atts    = array();
		$pattern = '/([\w-]+)\s*=\s*"([^"]*)"(?:\s|$)|([\w-]+)\s*=\s*\'([^\']*)\'(?:\s|$)|([\w-]+)\s*=\s*([^\s\'"]+)(?:\s|$)|"([^"]*)"(?:\s|$)|\'([^\']*)\'(?:\s|$)|(\S+)(?:\s|$)/';
		$text    = preg_replace( "/[\x{00a0}\x{200b}]+/u", ' ', $text );

		if ( preg_match_all( $pattern, $text, $match, PREG_SET_ORDER ) ) {
			foreach ( $match as $m ) {
				if ( ! empty( $m[1] ) ) {
					$atts[ strtolower( $m[1] ) ] = stripcslashes( $m[2] );
				} elseif ( ! empty( $m[3] ) ) {
					$atts[ strtolower( $m[3] ) ] = stripcslashes( $m[4] );
				} elseif ( ! empty( $m[5] ) ) {
					$atts[ strtolower( $m[5] ) ] = stripcslashes( $m[6] );
				} elseif ( isset( $m[7] ) && strlen( $m[7] ) ) {
					$atts[] = stripcslashes( $m[7] );
				} elseif ( isset( $m[8] ) && strlen( $m[8] ) ) {
					$atts[] = stripcslashes( $m[8] );
				} elseif ( isset( $m[9] ) ) {
					$atts[] = stripcslashes( $m[9] );
				}
			}
		} else {
			$atts = ltrim( $text );
		}

		return $atts;
	}
}
