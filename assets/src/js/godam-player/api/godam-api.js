/**
 * External dependencies
 */
import videojs from 'video.js';

/**
 * Internal dependencies
 */
import Player from './player.js';
import { getLightbox, openLightboxForId } from '../managers/modalManager.js';

window.GoDAMAPI = {
	/**
	 * Get Player Instance
	 *
	 * @param {string}      attachmentID - The attachment ID of the video
	 * @param {HTMLElement} videoElement - (optional) an actual video tag element
	 * @param {Object}      player       - (optional) the video.js player instance
	 * @return {Player} Player instance, only return player if it is ready.
	 */
	getPlayer( attachmentID, videoElement = null, player = null ) {
		let video, videoJs;

		// Error message constant for better maintainability
		const ERROR_NO_VIDEO_FOUND = window.godamAPIKeyData?.noVideoFound
			? window.godamAPIKeyData.noVideoFound + ' ' + attachmentID
			: `No video found for attachment ID ${ attachmentID }`;

		if ( videoElement && player ) {
			// Both provided, use them directly
			videoJs = player;

			// Check if videoElement is the actual <video> tag or the container div
			if ( videoElement.tagName.toLowerCase() === 'video' ) {
				// It's the <video> tag, find the parent container div
				video = videoElement.closest( `.easydam-player.video-js[data-id="${ attachmentID }"]` );
				if ( ! video ) {
					throw new Error( ERROR_NO_VIDEO_FOUND );
				}
			} else {
				// It's the container div, use it directly
				video = videoElement;
			}
		} else if ( videoElement ) {
			// Only videoElement provided
			if ( videoElement.tagName.toLowerCase() === 'video' ) {
				// It's the <video> tag, find the parent container and get VideoJS instance
				video = videoElement.closest( `.easydam-player.video-js[data-id="${ attachmentID }"]` );
				if ( ! video ) {
					throw new Error( ERROR_NO_VIDEO_FOUND );
				}
				// Don't initialize if already initializing
				if ( video.dataset.videojsInitializing === 'true' ) {
					throw new Error( `Player for attachment ID ${ attachmentID } is currently initializing. Please wait, you must call the function only after "godamAllPlayersReady" event is dispatched.` );
				}
				videoJs = videojs.getPlayer( videoElement );
			} else {
				// It's the container div, find the video tag inside
				video = videoElement;
				const videoTag = video.querySelector( 'video' );
				if ( ! videoTag ) {
					throw new Error( ERROR_NO_VIDEO_FOUND );
				}
				// Don't initialize if already initializing
				if ( video.dataset.videojsInitializing === 'true' ) {
					throw new Error( `Player for attachment ID ${ attachmentID } is currently initializing. Please wait, you must call the function only after "godamAllPlayersReady" event is dispatched.` );
				}
				videoJs = videojs.getPlayer( videoTag );
			}
		} else {
			// Nothing provided, search by attachment ID
			video = document.querySelector( `.easydam-player.video-js[data-id="${ attachmentID }"]` );
			if ( ! video ) {
				throw new Error( ERROR_NO_VIDEO_FOUND );
			}
			const videoTag = video.querySelector( 'video' );
			if ( ! videoTag ) {
				throw new Error( ERROR_NO_VIDEO_FOUND );
			}
			// Don't initialize if already initializing
			if ( video.dataset.videojsInitializing === 'true' ) {
				throw new Error( `Player for attachment ID ${ attachmentID } is currently initializing. Please wait, you must call the function only after "godamAllPlayersReady" event is dispatched.` );
			}
			videoJs = videojs.getPlayer( videoTag );
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

	/**
	 * Open a video in the lightbox.
	 *
	 * The programmatic equivalent of a `data-godam-lightbox` trigger element. If
	 * the video is rendered on the page as a "Show in lightbox" player, that
	 * player is moved into the lightbox; otherwise the video's embed page is shown
	 * in an iframe. Either way the page URL gains a `#godam-video-{id}` hash, so
	 * the open lightbox is shareable and Back closes it.
	 *
	 * Unlike getPlayer(), this never throws for an unknown ID.
	 *
	 * @param {string|number} attachmentID        - Attachment ID or transcoding job ID.
	 * @param {Object}        [options]           - Open options.
	 * @param {number}        [options.startTime] - Seconds to seek to.
	 * @param {string}        [options.title]     - Iframe title, when not on the page.
	 * @return {boolean} True when the lightbox opened.
	 */
	openLightbox( attachmentID, options = {} ) {
		return openLightboxForId( attachmentID, options );
	},

	/**
	 * Close the lightbox if it is open.
	 *
	 * @return {void}
	 */
	closeLightbox() {
		getLightbox().close();
	},

	/**
	 * Whether the lightbox is currently showing a video.
	 *
	 * @return {boolean} True when open.
	 */
	isLightboxOpen() {
		return getLightbox().isOpen();
	},

};

