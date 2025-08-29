/**
 * External dependencies
 */

/**
 * VideoJs dependencies
 */
import 'video.js/dist/video-js.css';
import 'videojs-contrib-ads/dist/videojs.ads.css';
import 'videojs-ima/dist/videojs.ima.css';
import 'videojs-contrib-ads';
import 'videojs-ima';
import 'videojs-flvjs-es6';

/**
 * FontAwesome dependencies
 */
import { library, dom } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';

/**
 * Quill dependencies dependencies for the CTA text layer
 */
import 'quill/dist/quill.snow.css';

/**
 * Internal dependencies
 */
import PlayerManager from './managers/playerManager.js';
import GodamDeveloperAPI from './developer-api.js';

library.add( fas );
dom.watch();

/**
 * Initialize player on DOM content loaded
 */
document.addEventListener( 'DOMContentLoaded', () => {
	// Initialize the developer API first
	const developerAPI = new GodamDeveloperAPI();
	
	// Then initialize the player manager
	new PlayerManager();
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
