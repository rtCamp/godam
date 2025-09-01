/**
 * External dependencies
 */
import videojs from 'video.js';

/**
 * Internal dependencies
 */
import Player from './player';

window.GoDAMAPI = {
	/**
	 *
	 * @param {string} attachmentID
	 */
	getPlayer( attachmentID ) {
		// get the player instance from this, which would include the videoJS ID and others.
		const video = document.querySelector( `[data-id="${ attachmentID }"]` );
		const videoJs = videojs( video.querySelector( 'video' ) );
		return new Player( videoJs, video );
	},

};

