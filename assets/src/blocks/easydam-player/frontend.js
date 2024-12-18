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
		const pendingQueue = []; // Queue to manage pending layers.

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
						allowSkip: layer.allow_skip !== undefined ? layer.allow_skip : true,
					} );
				}
			}
		} );

		// Function to display a layer and pause video
		const showLayer = ( layerObj ) => {
			layerObj.layerElement.classList.remove( 'hidden' );
			player.pause();
			player.controls( false ); // Disable player controls
		};

		// Function to process the next layer in the queue
		const processQueue = () => {
			if ( pendingQueue.length > 0 ) {
				const layerObj = pendingQueue.shift(); // Get the next layer
				showLayer( layerObj );

				// Allow closing or skipping the layer
				const skipButton = document.createElement( 'button' );
				skipButton.textContent = layerObj.allowSkip ? 'Skip' : 'Continue';
				skipButton.classList.add( 'skip-button' );

				if ( ! layerObj.allowSkip ) {
					skipButton.classList.add( 'hidden' ); // Hide skip button if not allowed
				}

				layerObj.layerElement.appendChild( skipButton );

				// Observe for confirmation message changes
				const observer = new MutationObserver( ( mutations ) => {
					mutations.forEach( ( mutation ) => {
						if ( layerObj.layerElement.querySelector( '.gform_confirmation_message' ) ) {
							skipButton.textContent = 'Continue';
							skipButton.classList.remove( 'hidden' );
							observer.disconnect();
						}
					} );
				} );

				observer.observe( layerObj.layerElement, { childList: true, subtree: true } );

				skipButton.addEventListener( 'click', () => {
					layerObj.show = false; // Mark layer as handled
					layerObj.layerElement.classList.add( 'hidden' );
					skipButton.remove(); // Clean up button

					// Process the next layer in the queue
					processQueue();
				} );
			} else {
				// Re-enable controls when no layers are pending
				player.controls( true );
				player.play();
			}
		};

		// Listen for the timeupdate event and enqueue layers at specific display times.
		player.on( 'timeupdate', () => {
			const currentTime = player.currentTime();

			formLayers.forEach( ( layerObj ) => {
				if (
					layerObj.show && // Only display if 'show' is true
					currentTime >= layerObj.displayTime &&
					layerObj.layerElement.classList.contains( 'hidden' )
				) {
					pendingQueue.push( layerObj ); // Add to queue
					layerObj.show = false; // Mark as queued
				}
			} );

			// If no layers are currently displayed, process the queue
			if ( pendingQueue.length > 0 && ! player.paused() ) {
				processQueue();
			}
		} );

		// Prevent video resume from external interactions
		player.on( 'play', () => {
			const isAnyLayerVisible = formLayers.some(
				( layerObj ) =>
					! layerObj.layerElement.classList.contains( 'hidden' ) && layerObj.show,
			);

			if ( isAnyLayerVisible ) {
				player.pause();
			}
		} );

		player.qualityMenu();
	} );
}
