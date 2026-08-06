/**
 * External dependencies
 */
import videojs from 'video.js';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	buildEmbedUrl,
	buildLightboxHash,
	findVideoById,
	getLightboxId,
	getLightboxRoot,
	isLightboxVideo,
	parseLightboxHash,
	parseStartTime,
} from '../utils/lightboxTargets.js';
import { seekPlayer } from '../utils/seekPlayer.js';

/**
 * "Show in lightbox" — open a GoDAM player inside a lightbox.
 *
 * Inspired by the GoDAM-for-Woo shoppable video modal: the already-initialised
 * inline player is simply moved into a shared, centered overlay on click and
 * played there; closing moves it back and pauses it. The inline render (poster,
 * player markup, etc.) is left completely untouched.
 *
 * Two content modes share one overlay. `element` moves an on-page player root
 * in and puts it back on close — used by an inline click, by a trigger pointing
 * at a lightbox player that is already rendered, and by the deep-link handler.
 * `iframe` renders the embed page instead, for a trigger whose video is not on
 * the page and so has no player to move.
 *
 * Use the module-level {@link getLightbox} singleton rather than constructing
 * this directly: the overlay is appended to `<body>`, so a second instance
 * means a second overlay.
 */
export class ModalManager {
	constructor() {
		this.modal = null; // { overlay, closeBtn, wrapper, content }, created on first open.
		this.activeEntry = null; // { mode, video, playerRoot, anchor, iframe, hash }.
		this.lastFocused = null;
		// Whether a history entry we pushed is currently on top, so close() knows
		// whether to pop one or merely strip the hash.
		this.historyPushed = false;
		this.handleKeydown = this.handleKeydown.bind( this );
	}

	/**
	 * Turn an inline show-in-lightbox player into a click-to-open trigger.
	 *
	 * @param {HTMLElement} video - The `.easydam-player.video-js` element.
	 */
	register( video ) {
		const playerRoot = getLightboxRoot( video );
		if ( ! playerRoot || playerRoot.dataset.godamModalBound === '1' ) {
			return;
		}
		playerRoot.dataset.godamModalBound = '1';

		// Intercept clicks in the capture phase — before Video.js handles them —
		// so an inline click opens the modal instead of playing inline.
		playerRoot.addEventListener(
			'click',
			( event ) => {
				// Once the player is live inside the modal, let clicks through to
				// the Video.js controls.
				if ( this.activeEntry && this.activeEntry.video === video ) {
					return;
				}
				event.preventDefault();
				event.stopPropagation();
				this.open( video, playerRoot, {
					// Make an inline-opened lightbox addressable too, so Back closes
					// it and the share button's page link matches what is on screen.
					historyId: getLightboxId( video ),
				} );
			},
			true,
		);
	}

	/**
	 * Whether the lightbox is currently showing something.
	 *
	 * @return {boolean} True when open.
	 */
	isOpen() {
		return this.activeEntry !== null;
	}

	/**
	 * Build the shared modal DOM once (overlay + close button + wrapper).
	 *
	 * @return {Object} The cached modal elements.
	 */
	ensureModal() {
		if ( this.modal ) {
			return this.modal;
		}

		const overlay = document.createElement( 'div' );
		overlay.className = 'godam-player-modal-overlay';
		overlay.addEventListener( 'click', () => this.close() );

		const closeBtn = document.createElement( 'button' );
		closeBtn.type = 'button';
		closeBtn.className = 'godam-player-modal-close';
		closeBtn.setAttribute( 'aria-label', __( 'Close', 'godam' ) );
		closeBtn.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
		closeBtn.addEventListener( 'click', () => this.close() );

		const wrapper = document.createElement( 'div' );
		wrapper.className = 'godam-player-modal-wrapper';
		wrapper.setAttribute( 'role', 'dialog' );
		wrapper.setAttribute( 'aria-modal', 'true' );
		wrapper.setAttribute( 'tabindex', '-1' );

		const content = document.createElement( 'div' );
		content.className = 'godam-player-modal-video';
		wrapper.appendChild( content );

		document.body.appendChild( overlay );
		document.body.appendChild( closeBtn );
		document.body.appendChild( wrapper );

		this.modal = { overlay, closeBtn, wrapper, content };
		return this.modal;
	}

	/**
	 * Move the player into the modal and play it.
	 *
	 * Kept for the inline-click path and as the stable public signature; new
	 * callers should prefer {@link ModalManager#openElement}.
	 *
	 * @param {HTMLElement} video      - The video element.
	 * @param {HTMLElement} playerRoot - The outer element to move into the modal.
	 * @param {Object}      options    - Passed through to `openElement`.
	 */
	open( video, playerRoot, options = {} ) {
		this.openElement( playerRoot, { ...options, video } );
	}

	/**
	 * Show an on-page element inside the lightbox.
	 *
	 * The node is physically moved, so a comment anchor is left behind to put it
	 * back in its exact position on close.
	 *
	 * @param {HTMLElement} playerRoot            - Element to move into the modal.
	 * @param {Object}      options               - Open options.
	 * @param {HTMLElement} [options.video]       - The `<video>` inside `playerRoot`.
	 * @param {number|null} [options.startTime]   - Seconds to seek to before playing.
	 * @param {boolean}     [options.autoplay]    - Whether to start playback (default true).
	 * @param {string}      [options.historyId]   - Push `#godam-video-{id}` when set.
	 * @param {boolean}     [options.pushHistory] - Set false when the URL already carries the hash.
	 * @param {string}      [options.requestedId] - The ID the caller asked for, for idempotence checks.
	 */
	openElement( playerRoot, {
		video = null,
		startTime = null,
		autoplay = true,
		historyId = null,
		pushHistory = true,
		requestedId = null,
	} = {} ) {
		if ( ! playerRoot ) {
			return;
		}

		// Swapping content, not closing: hand the history entry over so the
		// address bar tracks the new video without stacking another entry.
		if ( this.activeEntry ) {
			this.close( { keepHistory: true } );
		}

		const modal = this.ensureModal();
		this.lastFocused = playerRoot.ownerDocument.activeElement;

		// Leave an anchor so the player returns to its exact inline position.
		const anchor = document.createComment( 'godam-modal-anchor' );
		playerRoot.parentNode.insertBefore( anchor, playerRoot );
		modal.content.appendChild( playerRoot );
		playerRoot.classList.add( 'godam-player-modal-item' );

		this.activeEntry = {
			mode: 'element',
			video,
			playerRoot,
			anchor,
			iframe: null,
			hash: null,
			requestedId: requestedId === null ? null : String( requestedId ),
		};

		this.showModal( modal );
		this.applyHistory( historyId, pushHistory );

		const player = video ? videojs.getPlayer( video ) : null;
		if ( player ) {
			const seconds = parseStartTime( startTime );
			if ( seconds !== null ) {
				seekPlayer( player, seconds );
			}

			if ( autoplay ) {
				const playPromise = player.play();
				if ( playPromise && typeof playPromise.catch === 'function' ) {
					// Autoplay policies can still reject; ignore — the user can press
					// play in the modal.
					playPromise.catch( () => {} );
				}
			}
		}
	}

	/**
	 * Show the embed page inside the lightbox.
	 *
	 * Used when the requested video is not rendered on the page, so there is no
	 * initialised player to move in.
	 *
	 * @param {string}  src                   - Embed URL.
	 * @param {Object}  options               - Open options.
	 * @param {string}  [options.title]       - Iframe title for assistive tech.
	 * @param {string}  [options.historyId]   - Push `#godam-video-{id}` when set.
	 * @param {boolean} [options.pushHistory] - Set false when the URL already carries the hash.
	 * @param {string}  [options.requestedId] - The ID the caller asked for, for idempotence checks.
	 */
	openIframe( src, { title = '', historyId = null, pushHistory = true, requestedId = null } = {} ) {
		if ( ! src ) {
			return;
		}

		// Swapping content, not closing: hand the history entry over so the
		// address bar tracks the new video without stacking another entry.
		if ( this.activeEntry ) {
			this.close( { keepHistory: true } );
		}

		const modal = this.ensureModal();
		this.lastFocused = modal.wrapper.ownerDocument.activeElement;

		const iframe = document.createElement( 'iframe' );
		iframe.className = 'godam-player-modal-iframe';
		iframe.setAttribute( 'src', src );
		iframe.setAttribute( 'title', title || __( 'Video', 'godam' ) );
		iframe.setAttribute( 'allow', 'autoplay; fullscreen; picture-in-picture; encrypted-media' );
		iframe.setAttribute( 'allowfullscreen', 'true' );
		iframe.setAttribute( 'frameborder', '0' );
		modal.content.appendChild( iframe );

		this.activeEntry = {
			mode: 'iframe',
			video: null,
			playerRoot: null,
			anchor: null,
			iframe,
			hash: null,
			requestedId: requestedId === null ? null : String( requestedId ),
		};

		this.showModal( modal );
		this.applyHistory( historyId, pushHistory );

		iframe.focus?.( { preventScroll: true } );
	}

	/**
	 * Reveal the shared overlay and bind the while-open listeners.
	 *
	 * @param {Object} modal - The cached modal elements.
	 */
	showModal( modal ) {
		modal.overlay.classList.add( 'is-active' );
		modal.closeBtn.classList.add( 'is-active' );
		modal.wrapper.classList.add( 'is-active' );
		document.body.classList.add( 'godam-player-modal-open' );
		document.addEventListener( 'keydown', this.handleKeydown );
		modal.wrapper.focus( { preventScroll: true } );
	}

	/**
	 * Put `#godam-video-{id}` in the address bar so the open lightbox is
	 * shareable and Back closes it.
	 *
	 * Exactly one history entry ever represents "a lightbox is open". Switching
	 * straight from one video to another therefore *replaces* the hash rather than
	 * stacking a second entry — otherwise closing would need as many Backs as the
	 * visitor had opened videos.
	 *
	 * Pass `pushHistory` false when the URL already carries the hash (a deep-link
	 * entry), so Back is not turned into a no-op.
	 *
	 * @param {string|null} historyId   - Video ID to encode, or null to skip.
	 * @param {boolean}     pushHistory - Whether to add a history entry.
	 */
	applyHistory( historyId, pushHistory ) {
		if ( ! historyId || ! this.activeEntry ) {
			return;
		}

		const hash = buildLightboxHash( historyId );
		this.activeEntry.hash = hash;

		if ( ! pushHistory || typeof window.history?.pushState !== 'function' ) {
			return;
		}

		const state = { godamLightbox: String( historyId ) };

		try {
			if ( this.historyPushed || parseLightboxHash( window.location.hash ) ) {
				// Already sitting on a lightbox URL — swap the ID in place.
				window.history.replaceState( state, '', hash );
				return;
			}

			window.history.pushState( state, '', hash );
			this.historyPushed = true;
		} catch ( error ) {
			// Some environments (sandboxed iframes) reject history writes; the
			// lightbox itself still works, it just is not addressable.
		}
	}

	/**
	 * Undo whatever `applyHistory` did, so a closed lightbox never leaves a
	 * `#godam-video-{id}` behind — it would be a stale address for something no
	 * longer on screen, and would re-open the lightbox on reload.
	 *
	 * @param {boolean} fromPopState - True when the browser already moved us.
	 */
	restoreHistory( fromPopState ) {
		if ( fromPopState ) {
			// The browser already left our entry; just drop our claim on it.
			this.historyPushed = false;
			return;
		}

		if ( this.historyPushed ) {
			// Our own entry is on top — step off it so Back/Forward stay sane. That
			// lands on the entry before the lightbox, which by definition has no
			// lightbox hash.
			this.historyPushed = false;
			window.history.back();
			return;
		}

		// The entry is the browser's, not ours: a deep-link arrival or an anchor
		// click. Nothing to pop, so strip the hash in place.
		this.stripLightboxHash();
	}

	/**
	 * Drop a `#godam-video-{id}` from the address bar, keeping path and query.
	 *
	 * Deliberately matches *any* lightbox hash rather than the one this entry
	 * recorded: the two differ whenever a visitor follows a link written with the
	 * transcoding job ID, since the canonical hash uses the attachment ID.
	 * Comparing them would leave the hash stranded.
	 */
	stripLightboxHash() {
		if ( ! parseLightboxHash( window.location.hash ) ) {
			return;
		}

		if ( typeof window.history?.replaceState !== 'function' ) {
			return;
		}

		try {
			window.history.replaceState(
				window.history.state,
				'',
				window.location.pathname + window.location.search,
			);
		} catch ( error ) {
			// Ignore — cosmetic only.
		}
	}

	/**
	 * Pause, restore the content to where it came from, and hide the modal.
	 *
	 * Pass `keepHistory` when another open follows immediately, so the history
	 * entry is handed over to it rather than popped.
	 *
	 * @param {Object}  options                - Close options.
	 * @param {boolean} [options.fromPopState] - True when triggered by Back.
	 * @param {boolean} [options.keepHistory]  - True when swapping content.
	 */
	close( { fromPopState = false, keepHistory = false } = {} ) {
		if ( ! this.activeEntry ) {
			return;
		}
		const entry = this.activeEntry;
		const { mode, video, playerRoot, anchor, iframe } = entry;

		// Clear first: `restoreHistory()` can trigger a popstate that re-enters
		// close(), and an already-null entry makes that a no-op.
		this.activeEntry = null;

		if ( 'element' === mode ) {
			const player = video ? videojs.getPlayer( video ) : null;
			player?.pause();

			playerRoot.classList.remove( 'godam-player-modal-item' );

			if ( anchor && anchor.parentNode ) {
				anchor.parentNode.insertBefore( playerRoot, anchor );
				anchor.parentNode.removeChild( anchor );
			}
		} else if ( 'iframe' === mode ) {
			// Removing the iframe is what stops playback.
			iframe?.remove();
		}

		if ( this.modal ) {
			this.modal.overlay.classList.remove( 'is-active' );
			this.modal.closeBtn.classList.remove( 'is-active' );
			this.modal.wrapper.classList.remove( 'is-active' );
		}
		document.body.classList.remove( 'godam-player-modal-open' );
		document.removeEventListener( 'keydown', this.handleKeydown );

		if ( ! keepHistory ) {
			this.restoreHistory( fromPopState );
		}

		if ( this.lastFocused && typeof this.lastFocused.focus === 'function' ) {
			this.lastFocused.focus();
		}
		this.lastFocused = null;
	}

	/**
	 * Close on Escape, and keep Tab inside the dialog.
	 *
	 * @param {KeyboardEvent} event - Keydown event.
	 */
	handleKeydown( event ) {
		if ( 'Escape' === event.key ) {
			this.close();
			return;
		}

		if ( 'Tab' === event.key ) {
			this.trapFocus( event );
		}
	}

	/**
	 * Cycle Tab within the overlay so focus cannot reach the page behind it.
	 *
	 * The close button lives outside the wrapper (both are direct children of
	 * `<body>`), so it has to be folded into the list explicitly.
	 *
	 * @param {KeyboardEvent} event - The Tab keydown event.
	 */
	trapFocus( event ) {
		if ( ! this.modal ) {
			return;
		}

		const FOCUSABLE = 'a[href], area[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

		// Skip controls that are present but not currently offered — Video.js
		// hides inapplicable control-bar buttons with `vjs-hidden` rather than
		// removing them. Checked declaratively rather than via `offsetParent`, so
		// this needs no layout and behaves the same under test.
		const isAvailable = ( node ) =>
			! node.hasAttribute( 'hidden' ) &&
			'true' !== node.getAttribute( 'aria-hidden' ) &&
			! node.classList.contains( 'vjs-hidden' );

		const focusable = [
			...this.modal.wrapper.querySelectorAll( FOCUSABLE ),
			this.modal.closeBtn,
		].filter( isAvailable );

		if ( focusable.length === 0 ) {
			return;
		}

		const first = focusable[ 0 ];
		const last = focusable[ focusable.length - 1 ];
		const active = this.modal.wrapper.ownerDocument.activeElement;

		// Focus sitting on the wrapper itself (its initial home) counts as
		// "before the first item", so Tab moves into the dialog.
		if ( ! event.shiftKey && ( active === last || active === this.modal.wrapper ) ) {
			event.preventDefault();
			first.focus();
		} else if ( event.shiftKey && ( active === first || active === this.modal.wrapper ) ) {
			event.preventDefault();
			last.focus();
		}
	}
}

/**
 * The one lightbox for the page.
 *
 * A module-level singleton rather than one per `PlayerManager`: the overlay is
 * appended to `<body>`, triggers and the deep-link handler live outside
 * `PlayerManager`, and the legacy `GODAMPlayer()` factory constructs extra
 * managers — each of which used to mean another body-level overlay.
 *
 * @type {ModalManager|null}
 */
let lightbox = null;

/**
 * Get the shared lightbox, creating it on first use.
 *
 * @return {ModalManager} The singleton.
 */
export function getLightbox() {
	if ( ! lightbox ) {
		lightbox = new ModalManager();
	}
	return lightbox;
}

/**
 * Open the lightbox for a video ID, whether or not it is rendered on the page.
 *
 * The one place that decides between the two content modes, shared by element
 * triggers and by `GoDAMAPI.openLightbox()`. When the video is on the page as a
 * lightbox player, that player is moved in, so layers, chapters, ads and
 * analytics behave exactly as on an inline click. Anything else shows the embed
 * page in an iframe: an ordinary *visible* inline player is deliberately not
 * re-used, because opening moves the node out of the page, which would tear a
 * hole in the layout and hijack a player the visitor may already be watching.
 *
 * @param {string|number} id                    - Job ID or attachment ID.
 * @param {Object}        [options]             - Open options.
 * @param {number|null}   [options.startTime]   - Seconds to seek to.
 * @param {string}        [options.title]       - Iframe title, for iframe mode.
 * @param {boolean}       [options.pushHistory] - Whether to add a history entry.
 * @return {boolean} True when something was opened.
 */
export function openLightboxForId( id, { startTime = null, title = '', pushHistory = true } = {} ) {
	if ( id === null || id === undefined || id === '' ) {
		return false;
	}

	const instance = getLightbox();

	// Resolve directly rather than via GoDAMAPI.getPlayer(), which throws when
	// the video is absent — here that is the normal iframe-fallback case.
	const video = findVideoById( id );
	const playerRoot = isLightboxVideo( video ) ? getLightboxRoot( video ) : null;

	if ( playerRoot ) {
		instance.openElement( playerRoot, {
			video,
			startTime,
			historyId: getLightboxId( video ) || id,
			pushHistory,
			requestedId: id,
		} );
		return true;
	}

	instance.openIframe(
		buildEmbedUrl( {
			embedBaseUrl: window.godamData?.embedBaseUrl,
			id,
			hostPostId: window.godamData?.hostPostId,
			startTime,
		} ),
		{ title, historyId: id, pushHistory, requestedId: id },
	);

	return true;
}

/**
 * Bring the lightbox in line with whatever the URL currently says.
 *
 * The URL is the source of truth, which keeps Back and Forward symmetric and
 * makes a plain in-page `<a href="#godam-video-{id}">` work as a trigger.
 *
 * @param {Object} options             - Sync options.
 * @param {number} [options.startTime] - Seconds to seek to.
 */
export function syncLightboxWithUrl( { startTime = null } = {} ) {
	const instance = getLightbox();
	const targetId = parseLightboxHash( window.location.hash );

	if ( ! targetId ) {
		// Navigated off a lightbox URL — `fromPopState` because the browser has
		// already moved, so there is no entry of ours left to pop.
		if ( instance.isOpen() ) {
			instance.close( { fromPopState: true } );
		}
		return;
	}

	// Already showing exactly this video: nothing to do.
	//
	// Compare the ID that was *asked for*, not the resulting hash. A single anchor
	// click can fire both `popstate` and `hashchange`, so this guard runs on a
	// lightbox that is already open — and the hash it stored may be the video's job
	// ID while the URL carries its attachment ID. Comparing hashes would call those
	// different and needlessly tear the player down and rebuild it.
	// Accept either spelling: the entry records the ID that was asked for *and* the
	// canonical hash it produced, and those differ when a caller addresses a video
	// by job ID while the hash uses its attachment ID.
	const alreadyShowing = instance.activeEntry?.requestedId === String( targetId ) ||
		instance.activeEntry?.hash === buildLightboxHash( targetId );

	if ( instance.isOpen() && alreadyShowing ) {
		return;
	}

	// The hash is already in the address bar, so opening must not add to history.
	openLightboxForId( targetId, { startTime, pushHistory: false } );
}

/**
 * Whether {@link initLightboxUrlSync} has already run for this page.
 *
 * @type {boolean}
 */
let urlSyncBound = false;

/**
 * Keep the lightbox and the URL in step for the life of the page.
 *
 * Bound once and never removed — unlike a while-open listener, this also has to
 * catch the visitor arriving *at* a lightbox URL: pressing Forward after closing,
 * or following an in-page anchor.
 *
 * `popstate` covers Back/Forward; `hashchange` covers anchor links, which push a
 * history entry without firing `popstate`. Both land on the same idempotent
 * reconcile, so the overlap is harmless.
 */
export function initLightboxUrlSync() {
	if ( urlSyncBound ) {
		return;
	}
	urlSyncBound = true;

	const reconcile = () => syncLightboxWithUrl();

	window.addEventListener( 'popstate', reconcile );
	window.addEventListener( 'hashchange', reconcile );
}

export default ModalManager;
