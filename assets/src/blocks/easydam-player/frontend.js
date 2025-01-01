/**
 * External dependencies
 */
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'videojs-contrib-quality-menu';
import 'quill/dist/quill.snow.css';

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

					if ( layer.custom_css ) {
						const styleElement = document.createElement( 'style' );
						styleElement.textContent = layer.custom_css;
						layerElement.appendChild( styleElement );
					}

					formLayers.push( {
						layerElement,
						displayTime: parseFloat( layer.displayTime ),
						show: true,
						allowSkip: layer.allow_skip !== undefined ? layer.allow_skip : true,
					} );
				}
			}
		} );

		let isDisplayingLayer = false;

		// Listen for the timeupdate event and display layers at specific display times.
		player.on( 'timeupdate', () => {
			const currentTime = player.currentTime();
			if ( ! isDisplayingLayer ) {
				for ( const layerObj of formLayers ) {
					if (
						layerObj.show && // Only display if 'show' is true
            currentTime >= layerObj.displayTime &&
            layerObj.layerElement.classList.contains( 'hidden' )
					) {
						// Show the layer
						layerObj.layerElement.classList.remove( 'hidden' );

						// Pause the video
						player.pause();
						player.controls( false ); // Disable player controls
						isDisplayingLayer = true; // Set flag to true to prevent further layer display.
						break; // Exit the loop after displaying the first layer
					}
				}
			}
		} );

		// Handle fullscreen mode for layers
		player.on( 'fullscreenchange', () => {
			const isFullscreen = player.isFullscreen();
			const videoContainer = player.el();

			formLayers.forEach( ( layerObj ) => {
				if ( isFullscreen ) {
					// Append layer to fullscreen container
					videoContainer.appendChild( layerObj.layerElement );
					layerObj.layerElement.classList.add( 'fullscreen-layer' );
				} else {
					layerObj.layerElement.classList.remove( 'fullscreen-layer' );
				}
			} );
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

		// Allow closing or skipping layers
		formLayers.forEach( ( layerObj ) => {
			const skipButton = document.createElement( 'button' );
			skipButton.textContent = 'Skip';
			skipButton.classList.add( 'skip-button' );

			if ( ! layerObj.allowSkip ) {
				skipButton.classList.add( 'hidden' );
			}

			// Observe changes in the layer's DOM for the confirmation message
			const observer = new MutationObserver( ( mutations ) => {
				mutations.forEach( ( mutation ) => {
					if (
						layerObj.layerElement.querySelector( '.gform_confirmation_message' )
					) {
						// Update the Skip button to Continue
						skipButton.textContent = 'Continue';
						skipButton.classList.remove( 'hidden' );
						observer.disconnect();
					}
				} );
			} );

			// Start observing the layer's element for child list changes
			observer.observe( layerObj.layerElement, {
				childList: true,
				subtree: true,
			} );

			skipButton.addEventListener( 'click', () => {
				layerObj.show = false; // Set to false to prevent re-displaying
				layerObj.layerElement.classList.add( 'hidden' );
				player.controls( true ); // Re-enable player controls
				player.play();
				isDisplayingLayer = false; // Reset flag to false for future layer display.
			} );

			layerObj.layerElement.appendChild( skipButton );
		} );

		player.qualityMenu();

		// store heatmap information
		const existingRanges = [];
		let lastTime = 0;

		player.on( 'timeupdate', function() {
			const currentTime = player.currentTime();
			const played = player.played();

			// Check if we've jumped backwards (replay)
			if ( currentTime < lastTime ) {
				// Add new range entry when user jumps back
				existingRanges.push( copyRanges( played ) );
			} else if ( existingRanges.length === 0 ) {
				existingRanges.push( copyRanges( played ) );
			} else {
				existingRanges[ existingRanges.length - 1 ] = copyRanges( played );
			}

			updateHeatmap( existingRanges );
			lastTime = currentTime;
		} );

		function copyRanges( timeRanges ) {
			const copy = [];

			for ( let i = 0; i < timeRanges.length; i++ ) {
				copy.push( [ timeRanges.start( i ), timeRanges.end( i ) ] );
			}

			return copy;
		}

		function updateHeatmap( ranges ) {
			const videoId = video.getAttribute( 'data-id' );
			const url = `/wp-json/wp/v2/media/${ videoId }`;

			const data = JSON.stringify( {
				easydam_analytics: ranges,
			} );

			fetch( url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.nonceData.nonce,
				},
				body: data,
			} )
				.then( ( response ) => {
					if ( ! response.ok ) {
						throw new Error( `HTTP error! Status: ${ response.status }` );
					}
					return response.json();
				} );
		}
	} );
}
