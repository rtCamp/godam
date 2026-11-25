/**
 * Deferred player stylesheets.
 *
 * On the front end the server prints the player and skin stylesheets as
 * `media="print"` with `data-godam-deferred-style="{media}"`, so they don't
 * block the first render (see `GoDAM_Player::defer_player_style_tag()`). Their
 * inline `onload` normally switches them to their real media once downloaded.
 *
 * Before a player is revealed, its styles must be applied, or the visitor would
 * briefly see an unstyled Video.js. This switches every deferred stylesheet on
 * (covering a Content Security Policy that blocks the inline `onload`) and
 * waits for them to load.
 */

/**
 * Attribute the server adds to a deferred stylesheet; holds its real media.
 *
 * @type {string}
 */
export const DEFERRED_STYLE_ATTRIBUTE = 'data-godam-deferred-style';

/**
 * Longest wait for a stylesheet before showing the player anyway.
 *
 * @type {number}
 */
const STYLE_TIMEOUT = 3000;

/**
 * Switch one deferred stylesheet on and wait for it to load.
 *
 * @param {HTMLLinkElement} link    - The `<link rel="stylesheet">`.
 * @param {number}          timeout - Longest wait, in milliseconds.
 * @return {Promise<void>} Resolves once loaded, failed, or timed out.
 */
function applyStylesheet( link, timeout ) {
	const media = link.getAttribute( DEFERRED_STYLE_ATTRIBUTE ) || 'all';
	if ( link.media !== media ) {
		link.media = media;
	}

	// `sheet` is set once the file has loaded, whatever its media.
	if ( link.sheet ) {
		return Promise.resolve();
	}

	return new Promise( ( resolve ) => {
		const done = () => {
			clearTimeout( timer );
			resolve();
		};
		const timer = setTimeout( done, timeout );
		link.addEventListener( 'load', done, { once: true } );
		link.addEventListener( 'error', done, { once: true } );
	} );
}

/**
 * Apply every deferred GoDAM player stylesheet on the page.
 *
 * @param {Object} [options]         - Options.
 * @param {number} [options.timeout] - Longest wait per stylesheet, in milliseconds.
 * @return {Promise<void>} Resolves once they are loaded (or have timed out).
 */
export function ensurePlayerStyles( { timeout = STYLE_TIMEOUT } = {} ) {
	const links = document.querySelectorAll( `link[${ DEFERRED_STYLE_ATTRIBUTE }]` );
	return Promise.all( Array.from( links, ( link ) => applyStylesheet( link, timeout ) ) ).then( () => {} );
}
