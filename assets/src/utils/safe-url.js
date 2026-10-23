/**
 * Protocols a stored link may use as an `href`: web pages and mail addresses.
 * Anything else (`javascript:`, `data:`, `vbscript:` and friends) is never made
 * navigable.
 */
const SAFE_LINK_PROTOCOLS = [ 'http:', 'https:', 'mailto:' ];

/**
 * Return a stored link when it is safe to use as an `href`, or an empty string.
 *
 * The protocol is read with the same URL parser the browser applies to an `href`,
 * so a scheme hidden behind letter case, leading spaces or stray tabs and newlines
 * is seen for what it is. Relative links resolve against the current page and so
 * pass as http(s).
 *
 * @since n.e.x.t
 *
 * @param {*} url Stored link.
 * @return {string} The trimmed link when it is http(s), mailto or relative, otherwise ''.
 */
export function getSafeLinkUrl( url ) {
	if ( 'string' !== typeof url ) {
		return '';
	}

	const link = url.trim();

	if ( ! link ) {
		return '';
	}

	try {
		const { protocol } = new URL( link, window.location.href );

		return SAFE_LINK_PROTOCOLS.includes( protocol ) ? link : '';
	} catch ( e ) {
		return '';
	}
}
