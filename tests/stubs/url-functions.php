<?php
/**
 * Stand-in for core's esc_url_raw(), for unit tests that need its protocol allow-list.
 *
 * It mirrors the parts the plugin relies on: the character filter esc_url() applies
 * (which drops control characters, quotes and angle brackets), a bare host getting
 * `http://`, and a scheme outside the allow-list emptying the URL. It is not a
 * copy of core's function. The real one runs when the helper that calls it renders
 * in WordPress.
 *
 * @package GoDAM
 */

if ( ! function_exists( 'esc_url_raw' ) ) {

	/**
	 * @param string        $url       URL to clean.
	 * @param string[]|null $protocols Allowed schemes; core's default list when null.
	 * @return string The cleaned URL, or '' when its scheme is not allowed.
	 */
	function esc_url_raw( $url, $protocols = null ) { // phpcs:ignore WordPress.NamingConventions.PrefixAllGlobals.NonPrefixedFunctionFound -- stub mirroring the WP function.
		$url = str_replace( ' ', '%20', ltrim( (string) $url ) );
		$url = preg_replace( '|[^a-z0-9-~+_.?#=!&;,/:%@$\|*\'()\[\]\\x80-\\xff]|i', '', $url );

		if ( '' === $url ) {
			return '';
		}

		if ( false === strpos( $url, ':' ) && ! in_array( $url[0], array( '/', '#', '?' ), true ) ) {
			$url = 'http://' . $url;
		}

		if ( null === $protocols ) {
			$protocols = array( 'http', 'https', 'ftp', 'ftps', 'mailto', 'news', 'irc', 'irc6', 'ircs', 'gopher', 'nntp', 'feed', 'telnet', 'mms', 'rtsp', 'sms', 'svn', 'tel', 'fax', 'xmpp', 'webcal', 'urn' );
		}

		if ( preg_match( '/^([a-z][a-z0-9+.\-]*):/i', $url, $scheme ) && ! in_array( strtolower( $scheme[1] ), $protocols, true ) ) {
			return '';
		}

		return $url;
	}
}
