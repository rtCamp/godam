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
document.addEventListener( 'DOMContentLoaded', () => {
	new PlayerManager();

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
} );

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
