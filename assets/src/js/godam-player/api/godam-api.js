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
	 * Get Player Instance
	 *
	 * @param {string}      attachmentID - The attachment ID of the video
	 * @param {HTMLElement} videoElement - (optional) an actual video tag element
	 * @param {Object}      player       - (optional) the video.js player instance
	 * @return {Player} Player instance
	 */
	getPlayer( attachmentID, videoElement = null, player = null ) {
		let video, videoJs;

		if ( videoElement && player ) {
			// Both provided, use them directly
			videoJs = player;

			// Check if videoElement is the actual <video> tag or the container div
			if ( videoElement.tagName.toLowerCase() === 'video' ) {
				// It's the <video> tag, find the parent container div
				video = videoElement.closest( `[data-id="${ attachmentID }"]` );
			} else {
				// It's the container div, use it directly
				video = videoElement;
			}
		} else if ( videoElement ) {
			// Only videoElement provided
			if ( videoElement.tagName.toLowerCase() === 'video' ) {
				// It's the <video> tag, find the parent container and get VideoJS instance
				video = videoElement.closest( `[data-id="${ attachmentID }"]` );
				videoJs = videojs( videoElement );
			} else {
				// It's the container div, find the video tag inside
				video = videoElement;
				videoJs = videojs( video.querySelector( 'video' ) );
			}
		} else {
			// Nothing provided, search by attachment ID
			video = document.querySelector( `[data-id="${ attachmentID }"]` );
			videoJs = videojs( video.querySelector( 'video' ) );
		}

		return new Player( videoJs, video );
	},

};

