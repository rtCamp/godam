/**
 * GoDAM player loader.
 *
 * This is the only player script that runs while the page loads, so it is kept
 * small and free of Video.js and the player managers. The player itself lives
 * in the runtime chunk (`runtime.js`), which is downloaded and started only
 * when a video needs it:
 *
 * - when the video comes within `NEAR_VIEWPORT_MARGIN` of the viewport. Videos
 * already on screen are reported straight away, so they start immediately.
 * - straight away for Priority videos, the video a deep link points at, and
 * pages that opt in with `window.godamPlayerLoaderConfig.eager`.
 * - when the visitor interacts with a video or a lightbox trigger first.
 *
 * A video further down the page therefore costs no main-thread time until the
 * visitor scrolls towards it.
 *
 * @see https://github.com/rtCamp/godam/issues/2403
 */

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { initLightboxTriggers, prepareTriggers } from './lightboxTriggers.js';
import {
	ACTIVATION_KEYS,
	TRIGGER_ATTRIBUTE,
	parseLightboxHash,
	resolveDeepLinkTarget,
} from './utils/lightboxTargets.js';
import { initBlurUpPlaceholders } from './utils/blurUp.js';

/**
 * A GoDAM `<video>` before Video.js has wrapped it. Matching on the tag matters:
 * once started, Video.js's generated wrapper `<div>` carries the same classes.
 *
 * @type {string}
 */
const VIDEO_SELECTOR = 'video.easydam-player.video-js';

/**
 * How close to the viewport a video must come before its player starts.
 *
 * Far enough ahead that a scrolling visitor finds the player ready, close
 * enough that videos well below the fold cost nothing at load.
 *
 * @type {string}
 */
const NEAR_VIEWPORT_MARGIN = '300px 0px';

/**
 * Promise of the runtime module, once its download has been requested.
 *
 * @type {Promise<Object>|null}
 */
let runtimePromise = null;

/**
 * Whether the runtime module has finished loading.
 *
 * @type {boolean}
 */
let runtimeLoaded = false;

/**
 * Download and evaluate the player runtime (once).
 *
 * @return {Promise<Object>} The runtime module.
 */
export function loadRuntime() {
	if ( ! runtimePromise ) {
		runtimePromise = import( /* webpackChunkName: "player-runtime" */ './runtime.js' ).then(
			( runtime ) => {
				runtimeLoaded = true;
				return runtime;
			},
			( error ) => {
				// Let a later trigger try again, e.g. after a network blip.
				runtimePromise = null;
				// eslint-disable-next-line no-console
				console.error( 'GoDAM: failed to load the video player.', error );
				throw error;
			},
		);
	}
	return runtimePromise;
}

/**
 * Whether a player has already been started for a video.
 *
 * @param {HTMLElement} video - GoDAM `<video>` element.
 * @return {boolean} True once started.
 */
const isStarted = ( video ) => video?.dataset?.godamInitialized === '1';

/**
 * Start the players for some videos.
 *
 * @param {Iterable<HTMLElement>} videos - GoDAM `<video>` elements.
 * @return {Promise<void>} Resolves once the players have started.
 */
function startVideos( videos ) {
	const pending = Array.from( videos ).filter( ( video ) => video && ! isStarted( video ) );
	if ( ! pending.length ) {
		return Promise.resolve();
	}
	pending.forEach( unobserve );
	return loadRuntime().then( ( runtime ) => runtime.initVideos( pending ) );
}

/**
 * Start one video's player, playing it once ready when the visitor asked to.
 *
 * @param {HTMLElement} video          - GoDAM `<video>` element.
 * @param {Object}      [options]      - Options.
 * @param {boolean}     [options.play] - Whether the visitor asked to play it.
 * @return {Promise<Object>} Resolves with the Video.js player once it is ready.
 */
function startVideo( video, { play = false } = {} ) {
	unobserve( video );
	return loadRuntime().then( ( runtime ) => runtime.startVideo( video, { play } ) );
}

/**
 * The GoDAM `<video>` that belongs to an element of its markup.
 *
 * @param {Element|null} element - Any element inside a GoDAM player.
 * @return {HTMLElement|null} The `<video>`, or null.
 */
function findVideoFor( element ) {
	const wrapper = element?.closest?.( '.godam-video-wrapper' );
	return wrapper ? wrapper.querySelector( VIDEO_SELECTOR ) : null;
}

/**
 * The element to watch for a video. The `<video>` itself has no box until its
 * player starts (its container is `display: none`), so watch the wrapper, which
 * holds the poster at the video's size.
 *
 * @param {HTMLElement} video - GoDAM `<video>` element.
 * @return {HTMLElement} The element to observe.
 */
const getObservedElement = ( video ) =>
	video.closest( '.godam-video-wrapper' ) || video.closest( 'figure' ) || video;

/**
 * Watched element → its `<video>`.
 *
 * @type {WeakMap<HTMLElement, HTMLElement>}
 */
const observedVideos = new WeakMap();

/**
 * The one observer that starts players as they come near the viewport.
 *
 * @type {IntersectionObserver|null}
 */
let nearViewportObserver = null;

/**
 * Get the near-viewport observer, creating it on first use.
 *
 * @return {IntersectionObserver|null} The observer, or null when unsupported.
 */
function getObserver() {
	if ( nearViewportObserver || ! ( 'IntersectionObserver' in window ) ) {
		return nearViewportObserver;
	}

	nearViewportObserver = new IntersectionObserver(
		( entries ) => {
			const near = entries
				.filter( ( entry ) => entry.isIntersecting )
				.map( ( entry ) => observedVideos.get( entry.target ) )
				.filter( Boolean );

			if ( near.length ) {
				startVideos( near );
			}
		},
		{ root: null, rootMargin: NEAR_VIEWPORT_MARGIN, threshold: 0 },
	);

	return nearViewportObserver;
}

/**
 * Stop watching a video, e.g. because its player has started.
 *
 * @param {HTMLElement} video - GoDAM `<video>` element.
 */
function unobserve( video ) {
	if ( ! nearViewportObserver ) {
		return;
	}
	const element = getObservedElement( video );
	if ( observedVideos.get( element ) === video ) {
		nearViewportObserver.unobserve( element );
		observedVideos.delete( element );
	}
}

/**
 * Make a video's poster placeholder operable before its player exists.
 *
 * The placeholder shows a play button, so it has to behave like one for
 * keyboard and screen-reader users too. The player hides the placeholder once
 * it starts, so these attributes only matter until then.
 *
 * @param {HTMLElement} video - GoDAM `<video>` element.
 */
function preparePlaceholder( video ) {
	const placeholder = video.closest( '.godam-video-wrapper' )?.querySelector( '.godam-video-placeholder' );
	if ( ! placeholder || placeholder.dataset.godamPlaceholderReady === '1' ) {
		return;
	}
	placeholder.dataset.godamPlaceholderReady = '1';

	if ( ! placeholder.hasAttribute( 'role' ) ) {
		placeholder.setAttribute( 'role', 'button' );
	}
	if ( ! placeholder.hasAttribute( 'tabindex' ) ) {
		placeholder.setAttribute( 'tabindex', '0' );
	}
	if ( ! placeholder.hasAttribute( 'aria-label' ) ) {
		const title = video.dataset.videoTitle;
		const label = title
			? sprintf(
				/* translators: %s: video title */
				__( 'Play video: %s', 'godam' ),
				title,
			)
			: __( 'Play video', 'godam' );
		placeholder.setAttribute( 'aria-label', label );
	}
}

/**
 * Whether the page is a page-builder or editor preview, where markup is
 * rendered and re-rendered after this script runs.
 *
 * @return {boolean} True inside a WPBakery or Elementor editor preview.
 */
function isBuilderPreview() {
	try {
		const frame = window.frameElement;
		if ( frame && /vc[-_]inline-frame|vc_editor/i.test( ( frame.id || '' ) + ' ' + ( frame.className || '' ) ) ) {
			return true;
		}
	} catch ( e ) {}

	const body = document.body;
	if ( body && ( body.classList.contains( 'vc_editor' ) || body.classList.contains( 'elementor-editor-active' ) ) ) {
		return true;
	}

	try {
		return new URLSearchParams( window.location.search ).has( 'elementor-preview' );
	} catch ( e ) {
		return false;
	}
}

/**
 * Whether every player on the page should start straight away.
 *
 * @return {boolean} True for single-video pages, editor previews and old browsers.
 */
function shouldStartEverything() {
	return (
		!! window.godamPlayerLoaderConfig?.eager ||
		! ( 'IntersectionObserver' in window ) ||
		isBuilderPreview()
	);
}

/**
 * Register GoDAM videos: start the ones that must start now and watch the rest.
 *
 * Safe to call again for markup added later; started and watched videos are
 * skipped.
 *
 * @param {Document|HTMLElement} [root=document] - Where to look for videos.
 * @return {Promise<void>} Resolves once the videos that start now have started.
 */
export function registerVideos( root = document ) {
	initBlurUpPlaceholders( root );

	const videos = Array.from( root.querySelectorAll( VIDEO_SELECTOR ) ).filter( ( video ) => ! isStarted( video ) );
	videos.forEach( preparePlaceholder );

	if ( shouldStartEverything() ) {
		return startVideos( videos );
	}

	const observer = getObserver();
	const now = [];

	videos.forEach( ( video ) => {
		// Priority is the per-video "load immediately" option for hero videos.
		if ( video.dataset.performanceMode === 'priority' ) {
			now.push( video );
			return;
		}

		const element = getObservedElement( video );
		if ( ! observedVideos.has( element ) ) {
			observedVideos.set( element, video );
			observer.observe( element );
		}
	} );

	return startVideos( now );
}

/**
 * Start players on the visitor's first interaction, before they come into view
 * or before the observer has reported them.
 *
 * `pointerover` and `focusin` start the player (a click is likely to follow);
 * a click or Enter/Space on the poster also plays it once ready. Clicks inside
 * the author's overlay blocks are left alone.
 */
function bindInteractionStart() {
	const start = ( event ) => {
		if ( event.target?.closest?.( '.godam-video-overlay-container' ) ) {
			return;
		}
		const video = findVideoFor( event.target );
		if ( video && ! isStarted( video ) ) {
			startVideo( video );
		}
	};

	const startAndPlay = ( event ) => {
		if ( event.target?.closest?.( '.godam-video-overlay-container' ) ) {
			return;
		}
		const video = findVideoFor( event.target );
		// Once a player has started it handles its own clicks.
		if ( ! video || video.dataset.godamPlayRequested === '1' || video.dataset.godamReady === '1' ) {
			return;
		}
		if ( ! event.target.closest( '.godam-video-placeholder' ) ) {
			return;
		}
		event.preventDefault();
		video.dataset.godamPlayRequested = '1';
		startVideo( video, { play: true } );
	};

	document.addEventListener( 'pointerover', start, { passive: true } );
	document.addEventListener( 'focusin', start );
	document.addEventListener( 'click', startAndPlay );
	document.addEventListener( 'keydown', ( event ) => {
		if ( ACTIVATION_KEYS.includes( event.key ) ) {
			startAndPlay( event );
		}
	} );
}

/**
 * Lightbox triggers and lightbox URLs work before the runtime has loaded: they
 * load it first. A trigger starts the download as soon as it is pressed or
 * focused, so it is usually ready by the time the click lands.
 */
function bindLightbox() {
	initLightboxTriggers( ( id, options ) =>
		loadRuntime().then( ( runtime ) => runtime.openLightboxForId( id, options ) ),
	);

	const prefetch = ( event ) => {
		if ( event.target?.closest?.( `[${ TRIGGER_ATTRIBUTE }]` ) ) {
			loadRuntime().catch( () => {} );
		}
	};
	document.addEventListener( 'pointerdown', prefetch, { passive: true, capture: true } );
	document.addEventListener( 'focusin', prefetch );

	// Back/Forward or an in-page link to `#godam-video-{id}`. Once loaded, the
	// runtime keeps the lightbox and the URL in step itself.
	const onUrlChange = () => {
		if ( ! runtimeLoaded && parseLightboxHash( window.location.hash ) ) {
			loadRuntime().then( ( runtime ) => runtime.syncLightboxWithUrl() );
		}
	};
	window.addEventListener( 'popstate', onUrlChange );
	window.addEventListener( 'hashchange', onUrlChange );
}

/**
 * Page builders (e.g. WPBakery's inline editor) render the shortcode markup into
 * their preview AFTER this script has run, so catch it with a few deferred passes
 * plus an observer for ongoing edits. Only scheduled inside an editor preview.
 */
function watchBuilderPreview() {
	const reregister = () => {
		// Triggers are bound by delegation, so injected markup needs no re-binding —
		// but a non-interactive trigger still needs its role/tabindex.
		prepareTriggers();
		registerVideos();
	};

	[ 300, 1200, 3000 ].forEach( ( delay ) => setTimeout( reregister, delay ) );

	if ( ! ( 'MutationObserver' in window ) ) {
		return;
	}

	let scheduled = false;
	const observer = new MutationObserver( () => {
		if ( scheduled ) {
			return;
		}
		scheduled = true;
		window.requestAnimationFrame( () => {
			scheduled = false;
			reregister();
		} );
	} );
	observer.observe( document.body, { childList: true, subtree: true } );
}

/**
 * Set the page up once the DOM is ready.
 */
function boot() {
	bindLightbox();
	bindInteractionStart();
	registerVideos();

	// A deep link (`#godam-video-{id}` or `?t=`) opens or seeks its video at
	// once; the runtime finds and starts the target.
	if ( resolveDeepLinkTarget( window.location ) ) {
		loadRuntime().catch( () => {} );
	}

	if ( isBuilderPreview() ) {
		watchBuilderPreview();
	}
}

/**
 * Legacy entry point, called after player markup is rendered late: by
 * Elementor's `element_ready` hook, the FluentForms editor and add-ons.
 *
 * With an element, starts the players inside it straight away. Without one,
 * registers every new player on the page the usual way: Priority videos and
 * editor previews start now, the rest as they near the viewport. (Elementor
 * calls it with no argument for every widget on a live page, so starting every
 * player here would undo the lazy start.)
 *
 * @param {HTMLElement|null} videoRef - Element containing the players.
 * @return {Promise<void>} Resolves once the players that start now have started.
 */
function GODAMPlayer( videoRef = null ) {
	// Load the engagement data for any bars rendered with the new markup.
	window.godamEngagement?.init?.();

	if ( ! videoRef ) {
		prepareTriggers();
		return registerVideos( document );
	}

	initBlurUpPlaceholders( videoRef );
	return startVideos( videoRef.querySelectorAll( VIDEO_SELECTOR ) );
}

// The same file is sometimes enqueued under two handles (FluentForms registers
// its own copy); only the first copy sets the page up.
if ( ! window.godamPlayerLoader ) {
	window.GODAMPlayer = GODAMPlayer;

	/**
	 * Public loader API, for add-ons and for markup inserted after page load.
	 *
	 * - `load()`: download the player runtime; resolves with it.
	 * - `observe( root )`: register videos inside `root` to start as they near the viewport.
	 * - `start( video, { play } )`: start one video's player now.
	 * - `startAll( root )`: start every player inside `root` now.
	 */
	window.godamPlayerLoader = {
		load: loadRuntime,
		observe: registerVideos,
		start: startVideo,
		startAll: ( root = document ) => startVideos( root.querySelectorAll( VIDEO_SELECTOR ) ),
	};

	// Run on DOMContentLoaded, or immediately if the DOM is already parsed. Page
	// builders such as WPBakery's inline editor enqueue/inject this script AFTER
	// DOMContentLoaded has fired inside their preview iframe, so a bare listener
	// would never run.
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}
}
