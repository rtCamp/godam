/**
 * External dependencies
 */

/**
 * VideoJs dependencies
 */
import 'video.js/dist/video-js.css';

/**
 * Internal dependencies
 */
import PlayerManager from './managers/playerManager.js';

import './api/godam-api.js';

/**
 * Initialize player on DOM content loaded
 */
document.addEventListener( 'DOMContentLoaded', () => new PlayerManager() );

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
