/**
 * External dependencies
 */

/**
 * VideoJs dependencies
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

import './api/godam-api.js';

/**
 * Initialize player on DOM content loaded
 */
let godamPlayerManager = null;
const initGodamPlayers = () => {
	// Idempotent: if a deferred re-init pass (editor preview) already created the
	// manager, reuse it and just initialize any pending players — never construct
	// a second PlayerManager (which would duplicate global listeners).
	if ( godamPlayerManager ) {
		godamPlayerManager.initializePendingVideos();
	} else {
		godamPlayerManager = new PlayerManager();
	}

	// Scroll to a specific video and optionally seek to a timestamp when the URL
	// hash matches #godam-video-{jobId} and an optional ?t={seconds} query param is present.
	const hash = window.location.hash;
	if ( hash && hash.startsWith( '#godam-video-' ) ) {
		const jobId = hash.replace( '#godam-video-', '' );
		const searchParams = new URLSearchParams( window.location.search );
		const startTime = parseFloat( searchParams.get( 't' ) );

		const scrollToVideo = () => {
			const videoEl = document.querySelector( `video[data-job_id="${ CSS.escape( jobId ) }"]` );
			const container = videoEl?.closest( '.godam-video-wrapper' ) || videoEl?.closest( 'figure' );
			if ( container ) {
				container.scrollIntoView( { behavior: 'smooth', block: 'center' } );
			}
		};

		// Wait for player initialization and layout to complete before scrolling.
		setTimeout( scrollToVideo, 500 );

		// Seek to the timestamp when the specific player is fully ready.
		// We use 'godamPlayerReady' (fires per-player from within player.ready()) rather than
		// 'godamAllPlayersReady' because the latter can fire before Video.js has initialised
		// the player instance, causing getPlayer() to return null and the seek to be lost.
		if ( ! isNaN( startTime ) && startTime > 0 ) {
			const onPlayerReady = ( event ) => {
				const { videoElement, player } = event.detail;

				// Only act on the specific video targeted by the URL hash.
				if ( ! videoElement || videoElement.dataset.job_id !== jobId ) {
					return;
				}

				// This is our player – remove the listener so it only runs once.
				document.removeEventListener( 'godamPlayerReady', onPlayerReady );

				const seekToTime = () => player.currentTime( startTime );

				// If media metadata is already loaded, seek immediately.
				if ( player.readyState() >= 1 ) {
					seekToTime();
					return;
				}

				// For media not yet loaded: seek as soon as metadata is available.
				player.one( 'loadedmetadata', seekToTime );

				// Also seek on the first play event to cover the race where
				// loadedmetadata fires before our listener above is bound,
				// or for HLS streams where currentTime must be set after play starts.
				player.one( 'play', () => {
					if ( player.currentTime() < startTime ) {
						seekToTime();
					}
					player.off( 'loadedmetadata', seekToTime );
				} );
			};

			document.addEventListener( 'godamPlayerReady', onPlayerReady );
		}
	}
};

// Run on DOMContentLoaded, or immediately if the DOM is already parsed. Page
// builders such as WPBakery's inline editor enqueue/inject this script AFTER
// DOMContentLoaded has fired inside their preview iframe, so a bare listener
// would never run and the player would stay stuck in its pre-init "loading"
// state (0×0, only the play button visible). The readyState fallback ensures
// PlayerManager still runs in that case.
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', initGodamPlayers );
} else {
	initGodamPlayers();
}

/**
 * Re-initialize any players that appear after the initial run.
 *
 * Page builders (e.g. WPBakery's inline editor) render the shortcode markup into
 * their preview AFTER this script has already executed, leaving the player stuck
 * in its pre-init "loading" state (0×0, only the play button visible). This
 * initializes only players that were missed (via the manager's guarded
 * `initializePendingVideos()`), so it never duplicates global listeners.
 */
const reinitPendingPlayers = () => {
	if ( ! document.querySelector( '.easydam-player.video-js:not([data-godam-initialized])' ) ) {
		return;
	}
	if ( godamPlayerManager ) {
		godamPlayerManager.initializePendingVideos();
	} else {
		godamPlayerManager = new PlayerManager();
	}
};

/**
 * Detect a WPBakery editor preview. The re-init timers/observer below are scoped
 * to this so nothing extra runs on the published front end, where the one-shot
 * init above already handles every player present at load.
 *
 * @return {boolean} True when running inside a WPBakery editor preview.
 */
const isBuilderPreview = () => {
	try {
		const fe = window.frameElement;
		if ( fe && /vc[-_]inline-frame|vc_editor/i.test( ( fe.id || '' ) + ' ' + ( fe.className || '' ) ) ) {
			return true;
		}
	} catch ( e ) {}
	try {
		return !! document.body?.classList.contains( 'vc_editor' );
	} catch ( e ) {
		return false;
	}
};

// Only in a page-builder preview: the markup is rendered/re-rendered after this
// script runs, so catch it with a few deferred passes plus an observer for
// ongoing edits. None of this is scheduled on the published front end.
if ( isBuilderPreview() ) {
	[ 300, 1200, 3000 ].forEach( ( delay ) => setTimeout( reinitPendingPlayers, delay ) );

	if ( 'MutationObserver' in window ) {
		let scheduled = false;
		const observer = new MutationObserver( () => {
			if ( scheduled ) {
				return;
			}
			scheduled = true;
			window.requestAnimationFrame( () => {
				scheduled = false;
				reinitPendingPlayers();
			} );
		} );
		const startObserving = () => observer.observe( document.body, { childList: true, subtree: true } );
		if ( document.body ) {
			startObserving();
		} else {
			document.addEventListener( 'DOMContentLoaded', startObserving );
		}
	}
}

/**
 * Handle Content Security Policy (CSP) violations related to blob workers
 *
 * @see https://github.com/rtCamp/godam/issues/1227
 */
let isCSPWarningLogged = false;
window.addEventListener( 'securitypolicyviolation', ( e ) => {
	if ( e.blockedURI === 'blob' && e.violatedDirective === 'worker-src' ) {
		// Handle the violation
		if ( isCSPWarningLogged ) {
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
	}
} );

/**
 * Legacy function for backward compatibility
 *
 * @param {HTMLElement} videoRef - Video element reference
 */
function GODAMPlayer( videoRef = null ) {
	return new PlayerManager( videoRef );
}

window.GODAMPlayer = GODAMPlayer;
