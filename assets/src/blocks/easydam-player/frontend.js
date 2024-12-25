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
		const hotspotLayers = [];

		// Hide all the layers initially.
		layers.forEach( ( layer ) => {
			const layerId = `layer-${ layer.id }`;
			const layerElement = document.querySelector( `#${ layerId }` );

			if ( layerElement ) {
				layerElement.classList.add( 'hidden' ); // Initially hidden

				if ( layer.type === 'form' || layer.type === 'cta' ) {
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
				} else if ( layer.type === 'hotspot' ) {
					hotspotLayers.push( {
						layerElement,
						displayTime: parseFloat( layer.displayTime ),
						show: true,
						allowSkip: true,
						hotspots: layer.hotspots || [], // Store hotspots
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
			if ( ! isDisplayingLayer ) {
				for ( const layerObj of hotspotLayers ) {
					if (
						layerObj.show &&
						currentTime >= layerObj.displayTime &&
						layerObj.layerElement.classList.contains( 'hidden' )
					) {
						// Display the hotspot layer
						layerObj.layerElement.classList.remove( 'hidden' );

						const videoContainer = player.el();
						const containerWidth = videoContainer.offsetWidth;
						const containerHeight = videoContainer.offsetHeight;

						const baseWidth = 800;
						const baseHeight = 600;

						// Dynamically render hotspots inside the layer element
						layerObj.hotspots.forEach( ( hotspot, index ) => {
							// Inside your loop that creates each hotspot:
							const hotspotDiv = document.createElement( 'div' );
							hotspotDiv.classList.add( 'hotspot', 'circle' );
							hotspotDiv.style.position = 'absolute';
							// For each hotspot in layerObj.hotspots:
							const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
							const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;

							const pixelX = ( fallbackPosX / baseWidth ) * containerWidth;
							const pixelY = ( fallbackPosY / baseHeight ) * containerHeight;

							hotspotDiv.style.left = `${ pixelX }px`;
							hotspotDiv.style.top = `${ pixelY }px`;
							hotspotDiv.style.width = `${ hotspot.size.width }px`;
							hotspotDiv.style.height = `${ hotspot.size.height }px`;

							const hotspotContent = document.createElement( 'div' );
							hotspotContent.classList.add( 'hotspot-content' );

							const tooltipDiv = document.createElement( 'div' );
							tooltipDiv.classList.add( 'hotspot-tooltip' );
							tooltipDiv.textContent = hotspot.tooltipText || `Hotspot ${ index + 1 }`;

							if ( hotspot.link ) {
								const hotspotLink = document.createElement( 'a' );
								hotspotLink.href = hotspot.link;
								hotspotLink.target = '_blank';
								hotspotLink.textContent = hotspot.tooltipText || `Hotspot ${ index + 1 }`;
								tooltipDiv.textContent = '';
								tooltipDiv.appendChild( hotspotLink );
							}

							hotspotContent.appendChild( tooltipDiv );

							hotspotDiv.appendChild( hotspotContent );

							layerObj.layerElement.appendChild( hotspotDiv );
						} );

						// Add a skip button for the hotspot layer
						const skipButton = document.createElement( 'button' );
						skipButton.textContent = 'Skip';
						skipButton.classList.add( 'skip-button' );

						if ( ! layerObj.allowSkip ) {
							skipButton.classList.add( 'hidden' );
						}

						skipButton.addEventListener( 'click', () => {
							layerObj.show = false;
							layerObj.layerElement.classList.add( 'hidden' );
							player.controls( true );
							player.play();
							isDisplayingLayer = false;
						} );

						layerObj.layerElement.appendChild( skipButton );

						// Pause the video and disable controls
						player.pause();
						player.controls( false );
						isDisplayingLayer = true;
						break;
					}
				}
			}
		} );

		function updateHotspotPositions( currentPlayer, currentHotspotLayers ) {
			const videoContainer = currentPlayer.el();
			const containerWidth = videoContainer.offsetWidth;
			const containerHeight = videoContainer.offsetHeight;

			const baseWidth = 800;
			const baseHeight = 600;

			currentHotspotLayers.forEach( ( layerObj ) => {
				if ( ! layerObj.layerElement.classList.contains( 'hidden' ) ) {
					layerObj.layerElement.querySelectorAll( '.hotspot' ).forEach( ( hotspotDiv, index ) => {
						const hotspot = layerObj.hotspots[ index ];
						const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
						const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;

						const pixelX = ( fallbackPosX / baseWidth ) * containerWidth;
						const pixelY = ( fallbackPosY / baseHeight ) * containerHeight;

						hotspotDiv.style.left = `${ pixelX }px`;
						hotspotDiv.style.top = `${ pixelY }px`;
					} );
				}
			} );
		}

		window.addEventListener( 'resize', () => {
			updateHotspotPositions( player, hotspotLayers );
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

			hotspotLayers.forEach( ( layerObj ) => {
				videoContainer.appendChild( layerObj.layerElement );
			} );
		} );

		// Prevent video resume from external interactions
		player.on( 'play', () => {
			const isAnyLayerVisible = formLayers.some(
				( layerObj ) => ! layerObj.layerElement.classList.contains( 'hidden' ) && layerObj.show,
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
					if ( layerObj.layerElement.querySelector( '.gform_confirmation_message' ) ) {
						// Update the Skip button to Continue
						skipButton.textContent = 'Continue';
						skipButton.classList.remove( 'hidden' );
						observer.disconnect();
					}
				} );
			} );

			// Start observing the layer's element for child list changes
			observer.observe( layerObj.layerElement, { childList: true, subtree: true } );

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
	} );
}
