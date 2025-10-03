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

async function loadHotspotIcons() {
	const { library, dom } = await import( '@fortawesome/fontawesome-svg-core' );
	const { fas } = await import( '@fortawesome/free-solid-svg-icons' );
	library.add( fas );
	dom.watch();
}

loadHotspotIcons();

/**
 * Quill dependencies dependencies for the CTA text layer
 */
import 'quill/dist/quill.snow.css';

/**
 * Internal dependencies
 */
import PlayerManager from './managers/playerManager.js';

/**
 * Initialize player on DOM content loaded
 */
document.addEventListener( 'DOMContentLoaded', () => new PlayerManager() );

/**
 * Legacy function for backward compatibility
 *
 * @param {HTMLElement} videoRef - Video element reference
 */
function GODAMPlayer( videoRef = null ) {
	return new PlayerManager( videoRef );
}

window.GODAMPlayer = GODAMPlayer;
