/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Class of the line under a failed file's reason that says what to do next.
 */
export const NEXT_STEP_CLASS = 'status-next-step';

/**
 * Whether a URL from the server is safe to link to.
 *
 * @param {string} url URL.
 *
 * @return {boolean} True for an http(s) URL.
 */
const isLinkable = ( url ) => typeof url === 'string' && /^https?:\/\//i.test( url );

/**
 * Build a link that opens in a new tab.
 *
 * @param {string} href URL.
 * @param {string} text Link text.
 *
 * @return {HTMLAnchorElement} The link.
 */
const link = ( href, text ) => {
	const anchor = document.createElement( 'a' );
	anchor.href = href;
	anchor.target = '_blank';
	anchor.rel = 'noopener noreferrer';
	anchor.textContent = text;

	return anchor;
};

/**
 * Show what to do about a failed or stuck transcode, under its reason.
 *
 * Mirrors rtgodam_render_transcoding_next_step() in admin/godam-transcoder-functions.php,
 * which prints the same line when the page loads. All wording comes from the server
 * (rtgodam_get_transcoding_failure_for_display()), so it's translated once.
 *
 * @param {HTMLElement} container Element the line goes in.
 * @param {Object|null} failure   The `failure` object from the status route, or null to remove the line.
 */
export const renderNextStep = ( container, failure ) => {
	container.querySelectorAll( `.${ NEXT_STEP_CLASS }` ).forEach( ( node ) => node.remove() );

	if ( ! failure || ( ! failure.next_step && ! isLinkable( failure.support_url ) ) ) {
		return;
	}

	const line = document.createElement( 'span' );
	line.className = NEXT_STEP_CLASS;

	if ( failure.next_step && isLinkable( failure.next_step_url ) ) {
		line.append( link( failure.next_step_url, failure.next_step ) );
	} else if ( failure.next_step ) {
		line.append( document.createTextNode( failure.next_step ) );
	}

	if ( isLinkable( failure.support_url ) ) {
		if ( line.childNodes.length ) {
			line.append( document.createTextNode( ' ' ) );
		}
		line.append( link( failure.support_url, __( 'Contact support', 'godam' ) ) );
	}

	container.append( line );
};

/**
 * Quote text for a CSS custom property read by `content:` (the status tooltip).
 *
 * @param {string} text Text.
 *
 * @return {string} A CSS string.
 */
export const cssString = ( text ) => JSON.stringify( String( text ) );

/**
 * Put a failed file's reason on its grid status icon: in the hover tooltip, and as the
 * icon's accessible name. With no reason, the stylesheet's generic label shows instead.
 *
 * @param {HTMLElement} loader  The `.transcoding-status__loader` element.
 * @param {string}      message Why it failed, from the server.
 */
export const setFailureText = ( loader, message ) => {
	if ( ! loader ) {
		return;
	}

	if ( ! message ) {
		loader.style.removeProperty( '--status-text' );
		loader.removeAttribute( 'title' );
		loader.removeAttribute( 'aria-label' );
		loader.removeAttribute( 'role' );
		return;
	}

	loader.style.setProperty( '--status-text', cssString( message ) );
	loader.setAttribute( 'title', message );
	loader.setAttribute( 'role', 'img' );
	loader.setAttribute( 'aria-label', message );
};
