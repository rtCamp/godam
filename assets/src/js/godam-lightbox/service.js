/**
 * GoDAM Lightbox — the shared video lightbox service.
 *
 * One modal, reused by every surface that needs to play a video over the page.
 * Behaviour is extracted from the Gallery V2 block's private modal
 * (`assets/src/blocks/godam-gallery-v2/view.js`), which was the first
 * implementation and exposed no public entry point, so `godam-for-woo` had to
 * write a second one. This module is the door that was missing.
 *
 * Callers own their playlist and their own side effects (pausing tile previews,
 * resuming autoplay). This module owns the modal DOM, focus management,
 * keyboard handling, and the media lifecycle.
 *
 * A renderer decides HOW the video plays; the service decides everything around
 * it. Renderer contract:
 *
 * - `name` — string, for diagnostics.
 * - `canLoad( item )` — false means "not playable". open() then becomes a no-op
 * and leaves the page untouched.
 * - `ensure( host )` — idempotently create and attach the media element, and
 * return it.
 * - `load( item )` — point the media at item.
 * - `reset()` — return to an idle state, keeping the element attached.
 * - `flush()` — send anything the media has buffered. Called before every load
 * and before every reset, never after.
 * - `destroy()` — detach and forget the media element. Called only when a
 * different renderer takes over the shared modal.
 *
 * In-DOM playback (Video.js in the host page) is the second renderer this
 * contract exists for. It is deliberately not implemented here: `godam-for-woo`
 * already has a working in-DOM modal, and that renderer should land with its
 * migration, shaped by its real requirements (WooCommerce cart context, swipe
 * navigation, addon panels) rather than guessed at now.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Canonical class names. Every element also carries whatever aliases the caller
 * passes, so surfaces that shipped with their own class names (and the QA
 * selectors pointing at them) keep working while the CSS is consolidated.
 */
export const CLASSES = {
	overlay: 'godam-lightbox__overlay',
	dialog: 'godam-lightbox',
	media: 'godam-lightbox__media',
	close: 'godam-lightbox__close',
	nav: 'godam-lightbox__nav',
	navPrev: 'godam-lightbox__nav--prev',
	navNext: 'godam-lightbox__nav--next',
	bodyOpen: 'godam-lightbox-open',
};

const ICONS = {
	close: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
	prev: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>',
	next: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>',
};

/**
 * Marks nodes that join the focus trap alongside the visible buttons. The media
 * element carries it so the trap works whatever the renderer built.
 */
const FOCUSABLE_ATTR = 'data-godam-lightbox-focusable';
const FOCUS_TRAP_SELECTOR = `[${ FOCUSABLE_ATTR }="true"], button.is-active`;

// The shared modal DOM, built on first open.
let dom = null;

// The renderer currently mounted in the shared modal.
let mountedRenderer = null;

// The active session, or null when closed.
let session = null;

/**
 * Add class names to an element, skipping empty values.
 *
 * @param {Element}       element Target element.
 * @param {string[]|null} names   Class names to add.
 */
function addClasses( element, names ) {
	( names || [] ).forEach( ( name ) => {
		if ( name ) {
			element.classList.add( name );
		}
	} );
}

/**
 * Remove class names from an element, skipping empty values.
 *
 * @param {Element}       element Target element.
 * @param {string[]|null} names   Class names to remove.
 */
function removeClasses( element, names ) {
	( names || [] ).forEach( ( name ) => {
		if ( name ) {
			element.classList.remove( name );
		}
	} );
}

/**
 * Resolve the caller's playlist. Callers may pass a function so the list is
 * re-read on every navigation. The gallery needs that, because load-more injects
 * tiles into the same list the modal navigates.
 *
 * @param {Array|Function} items Playlist, or a resolver for one.
 * @return {Array} The current playlist.
 */
function resolveItems( items ) {
	const resolved = typeof items === 'function' ? items() : items;
	return Array.isArray( resolved ) ? resolved : [];
}

/**
 * Keyboard handling while open: Escape closes, arrows navigate, Tab is trapped
 * inside the dialog (WCAG 2.1.2, 2.4.3).
 *
 * @param {KeyboardEvent} event Key event.
 */
function handleKeydown( event ) {
	if ( ! session ) {
		return;
	}

	if ( event.key === 'Escape' ) {
		close();
		return;
	}

	if ( event.key === 'ArrowLeft' ) {
		navigate( -1 );
		return;
	}

	if ( event.key === 'ArrowRight' ) {
		navigate( 1 );
		return;
	}

	if ( event.key !== 'Tab' ) {
		return;
	}

	const focusable = Array.from(
		dom.dialog.querySelectorAll( FOCUS_TRAP_SELECTOR ),
	);

	if ( focusable.length === 0 ) {
		return;
	}

	const first = focusable[ 0 ];
	const last = focusable[ focusable.length - 1 ];
	const active = dom.dialog.ownerDocument.activeElement;

	if ( event.shiftKey && active === first ) {
		event.preventDefault();
		last.focus();
	} else if ( ! event.shiftKey && active === last ) {
		event.preventDefault();
		first.focus();
	}
}

/**
 * Build the shared modal DOM once and cache it.
 *
 * @return {Object} The modal parts.
 */
function getDom() {
	if ( dom ) {
		return dom;
	}

	const overlay = document.createElement( 'div' );
	overlay.className = CLASSES.overlay;
	document.body.appendChild( overlay );

	const dialog = document.createElement( 'div' );
	dialog.className = CLASSES.dialog;
	dialog.setAttribute( 'role', 'dialog' );
	dialog.setAttribute( 'aria-modal', 'true' );
	dialog.setAttribute( 'aria-label', __( 'Video player', 'godam' ) );
	document.body.appendChild( dialog );

	const closeButton = document.createElement( 'button' );
	closeButton.type = 'button';
	closeButton.className = CLASSES.close;
	closeButton.setAttribute( 'aria-label', __( 'Close', 'godam' ) );
	closeButton.innerHTML = ICONS.close;
	dialog.appendChild( closeButton );

	const prevButton = document.createElement( 'button' );
	prevButton.type = 'button';
	prevButton.className = `${ CLASSES.nav } ${ CLASSES.navPrev }`;
	prevButton.setAttribute( 'aria-label', __( 'Previous video', 'godam' ) );
	prevButton.innerHTML = ICONS.prev;
	dialog.appendChild( prevButton );

	const nextButton = document.createElement( 'button' );
	nextButton.type = 'button';
	nextButton.className = `${ CLASSES.nav } ${ CLASSES.navNext }`;
	nextButton.setAttribute( 'aria-label', __( 'Next video', 'godam' ) );
	nextButton.innerHTML = ICONS.next;
	dialog.appendChild( nextButton );

	overlay.addEventListener( 'click', () => close() );
	closeButton.addEventListener( 'click', () => close() );
	prevButton.addEventListener( 'click', () => navigate( -1 ) );
	nextButton.addEventListener( 'click', () => navigate( 1 ) );

	document.addEventListener( 'keydown', handleKeydown );

	dom = { overlay, dialog, closeButton, prevButton, nextButton };

	return dom;
}

/**
 * Mount the session's renderer, swapping out a different one if needed.
 *
 * The media element is inserted before the buttons so the focus trap walks
 * media, close, prev, next in DOM order.
 *
 * @param {Object} renderer Renderer for this session.
 * @return {Element|null} The media element.
 */
function mountRenderer( renderer ) {
	const parts = getDom();

	if ( mountedRenderer && mountedRenderer !== renderer ) {
		if ( typeof mountedRenderer.destroy === 'function' ) {
			mountedRenderer.destroy();
		}
		mountedRenderer = null;
	}

	const media = renderer.ensure( {
		dialog: parts.dialog,
		insertBefore: parts.closeButton,
		classes: CLASSES,
		focusableAttr: FOCUSABLE_ATTR,
	} );

	mountedRenderer = renderer;

	return media || null;
}

/**
 * Apply the caller's alias classes to the shared modal.
 *
 * @param {Object} aliases Alias class names, keyed like CLASSES.
 */
function applyAliases( aliases ) {
	const parts = getDom();
	addClasses( parts.overlay, [ aliases.overlay ] );
	addClasses( parts.dialog, [ aliases.dialog ] );
	addClasses( parts.closeButton, [ aliases.close ] );
	addClasses( parts.prevButton, [ aliases.nav, aliases.navPrev ] );
	addClasses( parts.nextButton, [ aliases.nav, aliases.navNext ] );
}

/**
 * Strip the session's alias classes so the next caller starts clean.
 *
 * @param {Object} aliases Alias class names, keyed like CLASSES.
 */
function stripAliases( aliases ) {
	const parts = getDom();
	removeClasses( parts.overlay, [ aliases.overlay ] );
	removeClasses( parts.dialog, [ aliases.dialog ] );
	removeClasses( parts.closeButton, [ aliases.close ] );
	removeClasses( parts.prevButton, [ aliases.nav, aliases.navPrev ] );
	removeClasses( parts.nextButton, [ aliases.nav, aliases.navNext ] );
	removeClasses( document.body, [ aliases.bodyOpen ] );
}

/**
 * Show one item. Used for the initial open and for every navigation, so the two
 * paths cannot drift apart.
 *
 * @param {number}  index      Index into the resolved playlist.
 * @param {boolean} isNavigate Whether this is a navigation, not a fresh open.
 * @return {boolean} Whether the item was shown.
 */
function show( index, isNavigate ) {
	const items = resolveItems( session.items );
	const item = items[ index ];
	const { renderer } = session;

	// Nothing playable: leave the page exactly as it was. No focus capture, no
	// callbacks, no modal.
	if ( ! item || ! renderer.canLoad( item ) ) {
		return false;
	}

	const parts = getDom();

	if ( ! isNavigate ) {
		session.previouslyFocused = parts.dialog.ownerDocument.activeElement;
	}

	// Let the caller quiet the page down (pause tile previews, cancel hover
	// timers) before the video starts.
	if ( typeof session.onShow === 'function' ) {
		session.onShow( { item, index, items, isNavigate } );
	}

	session.index = index;

	mountRenderer( renderer );

	// On navigation the outgoing media is about to be replaced. Give it a chance
	// to hand over anything it buffered first. For the iframe renderer this is
	// the difference between keeping and losing the viewer's heatmap data.
	renderer.flush();
	renderer.load( item );

	addClasses( parts.overlay, [ 'is-active' ] );
	addClasses( parts.dialog, [ 'is-active' ] );
	addClasses( parts.closeButton, [ 'is-active' ] );

	const navigable = session.navigation && items.length > 1;
	parts.prevButton.classList.toggle( 'is-active', navigable );
	parts.nextButton.classList.toggle( 'is-active', navigable );

	document.body.classList.add( CLASSES.bodyOpen );
	addClasses( document.body, [ session.aliases.bodyOpen ] );

	parts.closeButton.focus();

	return true;
}

/**
 * Open the lightbox.
 *
 * A function playlist is re-read on every navigation, so callers whose list can
 * grow while the modal is open (load-more, infinite scroll) stay navigable.
 *
 * @param {Object}         config              Session config.
 * @param {Array|Function} config.items        Playlist, or a resolver for one.
 * @param {number}         [config.index]      Item to open. Defaults to 0.
 * @param {Object}         config.renderer     Renderer for this session.
 * @param {boolean}        [config.navigation] Show prev/next for a multi-item playlist. Default true.
 * @param {Object}         [config.aliases]    Extra class names per element.
 * @param {Function}       [config.onShow]     Called before each item plays.
 * @param {Function}       [config.onClose]    Called after the modal closes.
 * @param {*}              [config.owner]      Opaque, returned by getState().
 * @return {boolean} Whether the lightbox opened.
 */
export function open( config ) {
	const { renderer } = config || {};

	if ( ! renderer || typeof renderer.ensure !== 'function' ) {
		return false;
	}

	// One modal, one session. A second caller takes over cleanly rather than
	// fighting the first for the shared DOM.
	if ( session ) {
		close();
	}

	session = {
		items: config.items,
		renderer,
		navigation: config.navigation !== false,
		aliases: config.aliases || {},
		onShow: config.onShow,
		onClose: config.onClose,
		owner: config.owner,
		index: -1,
		previouslyFocused: null,
	};

	applyAliases( session.aliases );

	const index = typeof config.index === 'number' ? config.index : 0;

	if ( ! show( index, false ) ) {
		// Nothing was shown, so nothing needs tearing down. Drop the half-built
		// session and leave the page untouched.
		stripAliases( session.aliases );
		session = null;
		return false;
	}

	return true;
}

/**
 * Move within the active playlist, wrapping at both ends.
 *
 * @param {number} direction +1 or -1.
 */
export function navigate( direction ) {
	if ( ! session ) {
		return;
	}

	const items = resolveItems( session.items );

	if ( items.length <= 1 ) {
		return;
	}

	const total = items.length;
	const nextIndex = ( session.index + direction + total ) % total;

	show( nextIndex, true );
}

/**
 * Close the lightbox and restore the page.
 */
export function close() {
	if ( ! session ) {
		return;
	}

	const parts = getDom();
	const closing = session;

	// Drop the session first so renderer teardown and the caller's onClose
	// cannot re-enter close() or navigate().
	session = null;

	removeClasses( parts.overlay, [ 'is-active' ] );
	removeClasses( parts.dialog, [ 'is-active' ] );
	removeClasses( parts.closeButton, [ 'is-active' ] );
	removeClasses( parts.prevButton, [ 'is-active' ] );
	removeClasses( parts.nextButton, [ 'is-active' ] );

	// Flush before reset, never after. Resetting tears the media down and the
	// browser cancels whatever request it had in flight.
	closing.renderer.flush();
	closing.renderer.reset();

	document.body.classList.remove( CLASSES.bodyOpen );
	stripAliases( closing.aliases );

	if ( closing.previouslyFocused && typeof closing.previouslyFocused.focus === 'function' ) {
		closing.previouslyFocused.focus();
	}

	if ( typeof closing.onClose === 'function' ) {
		closing.onClose( { index: closing.index, owner: closing.owner } );
	}
}

/**
 * @return {boolean} Whether a session is open.
 */
export function isOpen() {
	return session !== null;
}

/**
 * @return {Object} Snapshot of the active session.
 */
export function getState() {
	if ( ! session ) {
		return { open: false, index: -1, owner: null, item: null };
	}

	return {
		open: true,
		index: session.index,
		owner: session.owner,
		item: resolveItems( session.items )[ session.index ] || null,
	};
}

/**
 * Pull whatever the embed page has buffered and POST it from THIS context.
 *
 * Sending from the iframe right before teardown gets cancelled by the browser;
 * sending from here survives because the parent window is not being destroyed.
 * The caller is responsible for tearing the iframe down after this returns.
 *
 * Same-origin direct call — no postMessage round-trip, fully synchronous.
 * Cross-origin or missing function: silently no-op.
 *
 * `keepalive: true` is defense-in-depth here, not the primary mechanism (the
 * parent isn't unloading). It only matters if the user closes the entire tab
 * during the close handler's brief window — in that case keepalive lets the
 * request still reach the wire.
 *
 * @param {HTMLIFrameElement} iframe The embed iframe.
 */
function flushIframeAnalytics( iframe ) {
	try {
		const win = iframe?.contentWindow;
		if ( ! win || typeof win.godamGalleryFlushPayloads !== 'function' ) {
			return;
		}
		win.godamGalleryFlushPayloads().forEach( ( payload ) => {
			if ( ! payload?.endpoint || ! payload?.body ) {
				return;
			}
			fetch( `${ payload.endpoint }/analytics/`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( payload.body ),
				keepalive: true,
			} ).catch( () => {} );
		} );
	} catch ( e ) {
		// Cross-origin access or function threw — silently no-op.
	}
}

/**
 * Renderer that plays the video in the site's video-embed page, inside an
 * iframe. The default, because it costs nothing until the lightbox opens and
 * because player layers, ads and skins come along for free: the iframe is a real
 * render of the player template, not a reconstruction of it.
 *
 * @param {Object}   options                Renderer options.
 * @param {string}   [options.embedBaseUrl] Site URL the embed page hangs off.
 * @param {string}   [options.blockSource]  Analytics placement slug for plays from here.
 * @param {Function} [options.extraParams]  Returns extra query params, in emit order.
 * @param {Function} [options.hostPostId]   Returns the post ID plays are attributed to.
 * @param {string}   [options.title]        iframe title attribute.
 * @param {string}   [options.aliasClass]   Extra class for the iframe.
 * @return {Object} A renderer.
 */
export function createIframeRenderer( options = {} ) {
	const {
		embedBaseUrl = '/',
		blockSource = '',
		extraParams = () => ( {} ),
		hostPostId = () => window.videoAnalyticsParams?.postId || 0,
		title = __( 'Video player', 'godam' ),
		aliasClass = '',
	} = options;

	let iframe = null;

	/**
	 * Build the embed URL.
	 *
	 * Param order is deliberate and matches what the gallery has always
	 * emitted: godam_page, id, caller extras, host_post_id, block_source. Order
	 * is not functionally significant, but keeping it stable keeps this diff
	 * reviewable and any URL assertions intact.
	 *
	 * @param {Object} item Playlist item.
	 * @return {string} The embed URL.
	 */
	function buildSrc( item ) {
		const params = [
			[ 'godam_page', 'video-embed' ],
			[ 'id', item.videoId ],
		];

		Object.entries( extraParams( item ) || {} ).forEach( ( entry ) => {
			params.push( entry );
		} );

		params.push( [ 'host_post_id', hostPostId( item ) ] );
		params.push( [ 'block_source', blockSource ] );

		const query = params
			.map( ( [ key, value ] ) => `${ key }=${ encodeURIComponent( value ) }` )
			.join( '&' );

		return `${ embedBaseUrl }?${ query }`;
	}

	return {
		name: 'iframe',

		canLoad( item ) {
			return Boolean( item?.videoId );
		},

		ensure( host ) {
			if ( iframe && iframe.isConnected ) {
				return iframe;
			}

			iframe = document.createElement( 'iframe' );
			iframe.className = aliasClass
				? `${ host.classes.media } ${ aliasClass }`
				: host.classes.media;
			iframe.setAttribute( 'allowfullscreen', 'allowfullscreen' );
			iframe.setAttribute( 'loading', 'lazy' );
			iframe.setAttribute( 'title', title );
			iframe.setAttribute( host.focusableAttr, 'true' );
			host.dialog.insertBefore( iframe, host.insertBefore );

			return iframe;
		},

		load( item ) {
			if ( iframe ) {
				iframe.src = buildSrc( item );
			}
		},

		reset() {
			if ( iframe ) {
				iframe.src = 'about:blank';
			}
		},

		flush() {
			flushIframeAnalytics( iframe );
		},

		destroy() {
			if ( iframe ) {
				iframe.remove();
				iframe = null;
			}
		},
	};
}

/**
 * Tear the shared modal down completely. Test-only: the module keeps the modal
 * DOM and the mounted renderer alive for the page's lifetime by design, which
 * would otherwise leak between test cases.
 */
export function __resetForTests() {
	if ( session ) {
		close();
	}

	if ( mountedRenderer && typeof mountedRenderer.destroy === 'function' ) {
		mountedRenderer.destroy();
	}
	mountedRenderer = null;

	if ( dom ) {
		document.removeEventListener( 'keydown', handleKeydown );
		dom.overlay.remove();
		dom.dialog.remove();
		dom = null;
	}

	document.body.className = '';
}
