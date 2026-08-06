/**
 * Lightbox targeting helpers.
 *
 * Shared by the element-trigger runtime (`lightboxTriggers.js`) and the
 * deep-link handler (`frontend.js`) so both address a video the same way.
 *
 * A GoDAM video can be addressed by two different IDs, and share links use
 * whichever one the player was rendered with. `data-job_id` is the transcoding
 * job ID — what `shareManager` puts in the `#godam-video-{id}` hash, so it is
 * tried first. `data-id` is the WordPress attachment ID: the fallback, and the
 * one authors have to hand when writing a trigger.
 *
 * Keep everything here free of DOM *mutation* and of module state so it stays
 * unit-testable.
 */

export const LIGHTBOX_HASH_PREFIX = '#godam-video-';

/**
 * Attribute an element carries to become a lightbox trigger.
 */
export const TRIGGER_ATTRIBUTE = 'data-godam-lightbox';

/**
 * Keys that activate a click target that is not natively a button.
 *
 * `Spacebar` is the legacy spelling some older browsers still report.
 */
export const ACTIVATION_KEYS = [ 'Enter', ' ', 'Spacebar' ];

/**
 * Read the video ID out of a `#godam-video-{id}` hash.
 *
 * @param {string} hash - A location hash, with or without the leading `#`.
 * @return {string|null} The ID, or null when the hash is not a lightbox link.
 */
export function parseLightboxHash( hash ) {
	if ( ! hash || typeof hash !== 'string' ) {
		return null;
	}

	const normalised = hash.startsWith( '#' ) ? hash : `#${ hash }`;
	if ( ! normalised.startsWith( LIGHTBOX_HASH_PREFIX ) ) {
		return null;
	}

	const id = normalised.slice( LIGHTBOX_HASH_PREFIX.length ).trim();
	return id === '' ? null : id;
}

/**
 * Build the `#godam-video-{id}` hash for a video ID.
 *
 * @param {string|number} id - Job ID or attachment ID.
 * @return {string} The hash, including the leading `#`.
 */
export function buildLightboxHash( id ) {
	return `${ LIGHTBOX_HASH_PREFIX }${ id }`;
}

/**
 * Parse a `?t=` / `data-godam-lightbox-t` start time.
 *
 * @param {string|number|null} value - Raw value.
 * @return {number|null} Positive seconds, or null when absent/invalid.
 */
export function parseStartTime( value ) {
	if ( value === null || value === undefined || value === '' ) {
		return null;
	}

	const seconds = parseFloat( value );
	return ! isNaN( seconds ) && seconds > 0 ? seconds : null;
}

/**
 * Escape a value for use inside a double-quoted attribute selector.
 *
 * Not `CSS.escape()`: that escapes for use as an *identifier*, while these values
 * go inside a quoted string, where only the closing quote and a literal
 * backslash can break out. Doing it this way also keeps the module usable
 * wherever `CSS` is absent (jsdom under unit tests, very old browsers).
 *
 * @param {string} value - Raw attribute value.
 * @return {string} Escaped value.
 */
function escapeAttributeValue( value ) {
	return String( value ).replace( /["\\]/g, '\\$&' );
}

/**
 * Find the `<video>` element for a video ID.
 *
 * Tries the job ID first, then the attachment ID — a share link carries the
 * job ID, while a hand-written trigger usually carries the attachment ID.
 *
 * Always matches on `video[data-*]` rather than the `.easydam-player.video-js`
 * class: Video.js wraps the `<video>` in a generated div that inherits those
 * classes, so the class selector matches different nodes before and after
 * initialisation.
 *
 * @param {string|number} id  - Job ID or attachment ID.
 * @param {Document}      doc - Document to search (defaults to `document`).
 * @return {HTMLElement|null} The video element, or null when not on the page.
 */
export function findVideoById( id, doc = document ) {
	if ( id === null || id === undefined || id === '' ) {
		return null;
	}

	const escaped = escapeAttributeValue( id );

	for ( const attribute of [ 'data-job_id', 'data-id' ] ) {
		const matches = doc.querySelectorAll( `video[${ attribute }="${ escaped }"]` );
		if ( ! matches.length ) {
			continue;
		}

		// The same video can be on a page more than once — say once as a lightbox
		// poster and again as an ordinary inline player. Prefer the lightbox one:
		// it is the only kind a trigger may re-use, and document order cannot be
		// trusted here because opening moves that player to the end of <body>,
		// which would otherwise hand priority to the inline copy on a re-resolve.
		return [ ...matches ].find( isLightboxVideo ) || matches[ 0 ];
	}

	return null;
}

/**
 * Get the element to move into the lightbox for a given video.
 *
 * The template nests `div > figure > div.godam-video-wrapper > … > video`, and it
 * is that **outermost div** — the parent of `<figure>` — that carries the
 * aspect-ratio and brand-colour custom properties plus the inline max-width from
 * Player Height, so it is the movable root. `.godam-video-wrapper` is only a
 * fallback for markup rendered without the outer div.
 *
 * Every caller must agree on this, so `ModalManager`'s bound/active bookkeeping
 * lines up on the same node.
 *
 * @param {HTMLElement} video - The `<video>` element.
 * @return {HTMLElement|null} The movable root, or null.
 */
export function getLightboxRoot( video ) {
	if ( ! video ) {
		return null;
	}

	const figure = video.closest( 'figure' );
	return figure?.parentElement || video.closest( '.godam-video-wrapper' ) || null;
}

/**
 * The canonical ID to put in a `#godam-video-{id}` URL for a video.
 *
 * Prefers the WordPress attachment ID: it is the ID authors recognise, the one
 * they write into triggers, and the one the share button now produces. Virtual
 * media has no local attachment, so it falls back to the transcoding job ID.
 *
 * Only affects the IDs this plugin *writes*. Resolution accepts either spelling,
 * so links shared before this change keep working — see {@link findVideoById}.
 *
 * @param {HTMLElement} video - The `<video>` element.
 * @return {string|null} The ID, or null when the video carries neither.
 */
export function getLightboxId( video ) {
	return video?.dataset?.id || video?.dataset?.job_id || null;
}

/**
 * Whether a video was rendered as a "Show in lightbox" player.
 *
 * Only these players may be re-used by a trigger: opening one physically moves
 * it out of the page flow, which is already what an inline click does to them.
 * Moving an ordinary visible player instead would tear a hole in the layout.
 *
 * @param {HTMLElement} video - The `<video>` element.
 * @return {boolean} True when the video is a lightbox player.
 */
export function isLightboxVideo( video ) {
	return video?.dataset?.showInLightbox === 'true';
}

/**
 * Build the embed-page URL used when the requested video is not on the page.
 *
 * Mirrors the gallery's iframe URL so analytics attribution survives.
 *
 * @param {Object}        options               - URL parts.
 * @param {string}        options.embedBaseUrl  - Site base URL.
 * @param {string|number} options.id            - Attachment ID.
 * @param {string|number} [options.hostPostId]  - Post the trigger lives on.
 * @param {string}        [options.blockSource] - Attribution source.
 * @param {number|null}   [options.startTime]   - Seconds to seek to.
 * @return {string} The embed URL.
 */
export function buildEmbedUrl( {
	embedBaseUrl = '/',
	id,
	hostPostId = '',
	blockSource = 'lightbox-trigger',
	startTime = null,
} = {} ) {
	const params = new URLSearchParams();
	params.set( 'godam_page', 'video-embed' );
	params.set( 'id', String( id ) );
	params.set( 'block_source', blockSource );

	if ( hostPostId !== '' && hostPostId !== null && hostPostId !== undefined ) {
		params.set( 'host_post_id', String( hostPostId ) );
	}

	const seconds = parseStartTime( startTime );
	if ( seconds !== null ) {
		params.set( 't', String( seconds ) );
	}

	const base = embedBaseUrl || '/';
	const separator = base.includes( '?' ) ? '&' : '?';

	return `${ base }${ separator }${ params.toString() }`;
}
