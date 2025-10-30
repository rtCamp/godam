/**
 * External dependencies
 */
import videojs from 'video.js';

/**
 * Internal dependencies
 */
import Player from './player.js';

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
				video = videoElement.closest( `.easydam-player.video-js[data-id="${ attachmentID }"]` );
			} else {
				// It's the container div, use it directly
				video = videoElement;
			}
		} else if ( videoElement ) {
			// Only videoElement provided
			if ( videoElement.tagName.toLowerCase() === 'video' ) {
				// It's the <video> tag, find the parent container and get VideoJS instance
				video = videoElement.closest( `.easydam-player.video-js[data-id="${ attachmentID }"]` );
				videoJs = videojs.getPlayer( videoElement ) || videojs( videoElement );
			} else {
				// It's the container div, find the video tag inside
				video = videoElement;
				const videoTag = video.querySelector( 'video' );
				videoJs = videojs.getPlayer( videoTag ) || videojs( videoTag );
			}
		} else {
			// Nothing provided, search by attachment ID
			video = document.querySelector( `[data-id="${ attachmentID }"]` );
			const videoTag = video.querySelector( 'video' );
			videoJs = videojs.getPlayer( videoTag ) || videojs( videoTag );
		}

		return new Player( videoJs, video );
	},

	/**
	 * Get all players on the page
	 *
	 * @return {Array} Array of player objects with attachment ID and Player instance
	 */
	getAllPlayers() {
		const players = [];
		const videoContainers = document.querySelectorAll( '[data-id]' );

		videoContainers.forEach( ( container ) => {
			const attachmentId = container.dataset.id;
			const videoElement = container.querySelector( 'video' );

			if ( videoElement ) {
				try {
					// Check if VideoJS instance exists
					const videoJsInstance = videojs.getPlayer( videoElement );
					if ( videoJsInstance ) {
						const playerInstance = new Player( videoJsInstance, container );
						players.push( {
							attachmentId,
							player: playerInstance,
							container,
							videoElement,
							isReady: videoJsInstance.readyState() > 0,
						} );
					}
				} catch ( error ) {
					// VideoJS instance might not exist yet
				}
			}
		} );

		return players;
	},

	/**
	 * Get all ready players on the page
	 *
	 * @return {Array} Array of ready player objects
	 */
	getAllReadyPlayers() {
		return this.getAllPlayers().filter( ( playerObj ) => playerObj.isReady );
	},

};

