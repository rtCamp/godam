/**
 * GoDAM player runtime.
 *
 * Everything needed to start and run players: Video.js, the managers, the
 * lightbox, deep links and `window.GoDAMAPI`. The small loader (`frontend.js`)
 * imports this chunk only once a video needs it: when the video nears the
 * viewport, when the visitor interacts with it, or straight away for Priority
 * videos. Importing it starts nothing by itself.
 */

/**
 * NOTE: Ads plugins (videojs-contrib-ads & videojs-ima) are loaded dynamically
 * in videoPlayer.js BEFORE player initialization when ads are detected.
 * This is required because videojs-contrib-ads must be initialized in the same
 * tick as video.js to avoid missing the loadstart event.
 * @see videoPlayer.js loadRequiredPlugins()
 * @see pluginLoader.js loadAdsPlugins()
 */

/**
 * Internal dependencies
 */
import PlayerManager from './managers/playerManager.js';
import {
	getLightbox,
	initLightboxUrlSync,
	openLightboxForId,
	setLightboxVideoPreparer,
	syncLightboxWithUrl,
} from './managers/modalManager.js';
import { getVisibilityManager } from './managers/visibilityManager.js';
import {
	findFirstInlineVideo,
	findVideoById,
	getLightboxId,
	getLightboxRoot,
	isLightboxVideo,
	resolveDeepLinkTarget,
} from './utils/lightboxTargets.js';
import { seekPlayer } from './utils/seekPlayer.js';
import { whenPlayerReady } from './utils/playerReady.js';
import { ensurePlayerStyles } from './utils/playerStyles.js';

import './api/godam-api.js';

export { openLightboxForId, syncLightboxWithUrl, whenPlayerReady };

/**
 * The one manager every batch of players goes through, so page-wide setup
 * (keyboard shortcuts, the autoplay observer) happens once.
 *
 * @type {PlayerManager|null}
 */
let playerManager = null;

/**
 * Get the shared player manager.
 *
 * @return {PlayerManager} The manager.
 */
function getPlayerManager() {
	if ( ! playerManager ) {
		playerManager = new PlayerManager( null, { autoInit: false } );
		playerManager.initializeGlobalKeyboardHandler();
	}
	return playerManager;
}

/**
 * Start players.
 *
 * Waits for the deferred player stylesheets first, so a player is never shown
 * unstyled. Videos already started are skipped.
 *
 * @param {Iterable<HTMLElement>} videos - GoDAM `<video>` elements.
 * @return {Promise<void>} Resolves once the players have started.
 */
export async function initVideos( videos ) {
	const list = Array.from( videos || [] );
	if ( ! list.length ) {
		return;
	}
	await ensurePlayerStyles();
	await getPlayerManager().initializeVideos( list );
}

/**
 * Start every not-yet-started player inside an element.
 *
 * @param {Document|HTMLElement} [root=document] - Where to look.
 * @return {Promise<void>} Resolves once the players have started.
 */
export function initAll( root = document ) {
	return initVideos( root.querySelectorAll( 'video.easydam-player.video-js' ) );
}

/**
 * Start one player and, when the visitor asked for it, play it once it's ready.
 *
 * A lightbox player opens in the lightbox instead of playing inline, which is
 * what a click on it does once it has started.
 *
 * @param {HTMLElement} video          - GoDAM `<video>` element.
 * @param {Object}      [options]      - Options.
 * @param {boolean}     [options.play] - Whether the visitor asked to play it.
 * @return {Promise<Object>} Resolves with the Video.js player once it is ready.
 */
export function startVideo( video, { play = false } = {} ) {
	initVideos( [ video ] );
	const ready = whenPlayerReady( video );

	if ( play ) {
		ready.then( ( player ) => {
			if ( isLightboxVideo( video ) ) {
				const playerRoot = getLightboxRoot( video );
				if ( playerRoot ) {
					getLightbox().open( video, playerRoot, { historyId: getLightboxId( video ) } );
				}
				return;
			}

			// Starting a video counts as the visitor taking control of it.
			getVisibilityManager().markInteraction( player );
			const playPromise = player.play();
			if ( playPromise && typeof playPromise.catch === 'function' ) {
				// The play policy can still refuse; the big play button remains.
				playPromise.catch( () => {} );
			}
		} );
	}

	return ready;
}

/**
 * Open (or scroll to) the video a `#godam-video-{id}` URL points at.
 *
 * The hash is what the share modal's "WP page link" emits. For a *lightbox*
 * video, scrolling is not enough: its inline render is only a poster, so a
 * recipient sent a link to watch the video would land on the page with it
 * closed. Those open in the lightbox; every other video keeps the original
 * scroll-and-seek behaviour.
 *
 * The ID is resolved as a job ID first and an attachment ID second — see
 * `findVideoById()`.
 *
 * A `?t=` with no `#godam-video-{id}` hash (for example a key-moment link
 * whose fragment was dropped) seeks the first ordinary GoDAM video on the
 * page instead.
 *
 * The loader starts the target player as soon as the page loads; this waits
 * for it to be ready.
 */
function applyDeepLink() {
	const target = resolveDeepLinkTarget( window.location );
	if ( ! target ) {
		return;
	}

	const { targetId, startTime, fromHash } = target;
	// Without a hash, only an inline player is seeked; a lightbox copy of the
	// same video is left closed.
	const videoElement = fromHash ? findVideoById( targetId ) : findFirstInlineVideo();
	if ( ! videoElement ) {
		return;
	}

	startVideo( videoElement ).then( ( player ) => {
		if ( isLightboxVideo( videoElement ) ) {
			const playerRoot = getLightboxRoot( videoElement );
			if ( playerRoot ) {
				// The hash is already in the address bar, so opening must not push
				// a duplicate history entry.
				getLightbox().openElement( playerRoot, {
					video: videoElement,
					startTime,
					historyId: targetId,
					pushHistory: false,
				} );
				return;
			}
		}

		if ( startTime !== null ) {
			// The visitor followed a link to this moment, so load the metadata
			// now: the seek then shows on the progress bar before they press play.
			if ( player.readyState() === 0 && player.preload() === 'none' ) {
				player.preload( 'metadata' );
				player.load();
			}
			seekPlayer( player, startTime );
		}
	} );

	// Inline videos are brought into view once player init and layout have
	// settled. Lightbox videos are excluded: they get an overlay instead, and
	// scrolling the page underneath it is just noise.
	if ( ! isLightboxVideo( videoElement ) ) {
		setTimeout( () => {
			const container = videoElement.closest( '.godam-video-wrapper' ) || videoElement.closest( 'figure' );
			container?.scrollIntoView( { behavior: 'smooth', block: 'center' } );
		}, 500 );
	}
}

/**
 * Handle Content Security Policy (CSP) violations related to blob workers
 *
 * @see https://github.com/rtCamp/godam/issues/1227
 */
function watchBlobWorkerCsp() {
	let isCSPWarningLogged = false;
	window.addEventListener( 'securitypolicyviolation', ( e ) => {
		if ( e.blockedURI !== 'blob' || e.violatedDirective !== 'worker-src' || isCSPWarningLogged ) {
			return;
		}
		isCSPWarningLogged = true;
		// eslint-disable-next-line no-console
		console.error(
			'⚠️ Video playback is blocked due to Content Security Policy (CSP) restrictions.',
			{
				error: "Refused to create a worker from 'blob:<URL>' because it violates the CSP.",
				guidance: [
					"1️⃣ First, try adding 'blob:' to the 'worker-src' directive in your CSP header.",
					"   Example: Content-Security-Policy: worker-src 'self' blob:;",
					"2️⃣ If the issue persists, you may also need to add 'blob:' to 'script-src'.",
					"   Example: Content-Security-Policy: script-src 'self' https: blob:;",
				],
				resources: [
					'MDN CSP docs: https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP',
				],
			},
		);
	} );
}

// One-time page setup, run when the runtime first loads.
watchBlobWorkerCsp();
// A lightbox player the loader has not started yet is started before it opens.
setLightboxVideoPreparer( ( video ) => startVideo( video ) );
initLightboxUrlSync();
applyDeepLink();
