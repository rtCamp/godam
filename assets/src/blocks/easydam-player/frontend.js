/**
 * External dependencies
 */
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'videojs-contrib-quality-menu';

// Adding an event listener for the 'DOMContentLoaded' event to ensure the script runs after the complete page is loaded.
document.addEventListener( 'DOMContentLoaded', () => easyDAMPlayer() );

/**
 * RT Player
 */
function easyDAMPlayer() {
	const videos = document.querySelectorAll( '.easydam-player.video-js' );

	videos.forEach( ( video ) => {
		// read the data-setup attribute.
		const videoSetupOptions = video.dataset.setup
			? JSON.parse( video.dataset.setup )
			: {
				controls: true,
				autoplay: false,
				preload: 'auto',
				fluid: true,
			};

		console.log( 'Parsed options:', videoSetupOptions );

		const player = videojs( video, videoSetupOptions );

		// Find and initialize layers from easydam_meta
		const layers = videoSetupOptions.easydam_meta?.layers || [];
		const formLayers = []; // Store references to form layers for future visibility.

		// Hide all the layers initially.
		layers.forEach( ( layer ) => {
			if ( layer.type === 'form' || layer.type === 'cta' ) {
				const layerId = `layer-${ layer.id }`;
				const layerElement = document.querySelector( `#${ layerId }` );

				if ( layerElement ) {
					layerElement.classList.add( 'hidden' ); // Initially hidden
					formLayers.push( {
						layerElement,
						displayTime: parseFloat( layer.displayTime ),
						show: true,
					} );
				}
			}
		} );

		// Listen for the timeupdate event and display layers at specific display times.
		player.on( 'timeupdate', () => {
			const currentTime = player.currentTime();

			formLayers.forEach( ( layerObj ) => {
				if (
					layerObj.show && // Only display if 'show' is true
					currentTime >= layerObj.displayTime &&
					layerObj.layerElement.classList.contains( 'hidden' )
				) {
					// Show the layer
					layerObj.layerElement.classList.remove( 'hidden' );

					// Pause the video
					player.pause();
				}
			} );
		} );

		// Allow closing or skipping layers
		formLayers.forEach( ( layerObj ) => {
			const skipButton = document.createElement( 'button' );
			skipButton.textContent = 'Skip';
			skipButton.classList.add( 'skip-button' );

			// Observe changes in the layer's DOM for the confirmation message
			const observer = new MutationObserver( ( mutations ) => {
				mutations.forEach( ( mutation ) => {
					if ( layerObj.layerElement.querySelector( '.gform_confirmation_message' ) ) {
						// Update the Skip button to Continue
						skipButton.textContent = 'Continue';
					}
				} );
			} );

			// Start observing the layer's element for child list changes
			observer.observe( layerObj.layerElement, { childList: true, subtree: true } );

			skipButton.addEventListener( 'click', () => {
				layerObj.show = false; // Set to false to prevent re-displaying
				layerObj.layerElement.classList.add( 'hidden' );
				player.play();
			} );

			layerObj.layerElement.appendChild( skipButton );
		} );

		player.qualityMenu();
	} );
}
