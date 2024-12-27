/**
 * External dependencies
 */
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'videojs-contrib-quality-menu';

document.addEventListener( 'DOMContentLoaded', () => easyDAMPlayer() );

function easyDAMPlayer() {
	const videos = document.querySelectorAll( '.easydam-player.video-js' );

	videos.forEach( ( video ) => {
		// Parse data-setup
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

		const layers = videoSetupOptions.easydam_meta?.layers || [];

		const formLayers = [];
		const hotspotLayers = [];

		// Hide all layers initially
		layers.forEach( ( layer ) => {
			const layerId = `layer-${ layer.id }`;
			const layerElement = document.querySelector( `#${ layerId }` );
			if ( ! layerElement ) {
				return;
			}

			layerElement.classList.add( 'hidden' );

			if ( layer.type === 'form' || layer.type === 'cta' ) {
				// If there's custom CSS, attach it
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
				const durationVal = layer.duration
					? parseInt( layer.duration )
					: 0;

				hotspotLayers.push( {
					layerElement,
					displayTime: parseFloat( layer.displayTime ),
					duration: durationVal,
					show: true,
					hotspots: layer.hotspots || [],
					pauseOnHover: layer.pauseOnHover || false,
				} );
			}
		} );

		// isDisplayingLayer is used only for forms/CTAs that pause the video
		let isDisplayingLayer = false;

		player.on( 'timeupdate', () => {
			const currentTime = player.currentTime();

			if ( ! isDisplayingLayer ) {
				for ( const layerObj of formLayers ) {
					if (
						layerObj.show &&
						currentTime >= layerObj.displayTime &&
						layerObj.layerElement.classList.contains( 'hidden' )
					) {
						// Show the form/CTA layer
						layerObj.layerElement.classList.remove( 'hidden' );

						// Pause the video for form/CTA
						player.pause();
						player.controls( false );
						isDisplayingLayer = true;
						break;
					}
				}
			}

			hotspotLayers.forEach( ( layerObj ) => {
				const { displayTime, duration, show } = layerObj;
				if ( ! show ) {
					return;
				}

				const endTime = displayTime + duration;
				// Show if currentTime in [displayTime, endTime)
				if (
					currentTime >= displayTime &&
					( currentTime < endTime )
				) {
					if ( layerObj.layerElement.classList.contains( 'hidden' ) ) {
						// Render the hotspots only once on first show
						layerObj.layerElement.classList.remove( 'hidden' );

						// If needed, dynamically create the hotspots
						createHotspots( layerObj, player );
					}
				} else if ( ! layerObj.layerElement.classList.contains( 'hidden' ) ) {
					layerObj.layerElement.classList.add( 'hidden' );
				}
			} );
		} );

		// A helper function to create hotspots. We'll only do this once per layer.
		function createHotspots( layerObj, currentPlayer ) {
			const videoContainer = currentPlayer.el();
			const containerWidth = videoContainer.offsetWidth;
			const containerHeight = videoContainer.offsetHeight;

			const baseWidth = 800;
			const baseHeight = 600;

			layerObj.hotspots.forEach( ( hotspot, index ) => {
				const hotspotDiv = document.createElement( 'div' );
				hotspotDiv.classList.add( 'hotspot', 'circle' );
				hotspotDiv.style.position = 'absolute';

				const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
				const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;

				const pixelX = ( fallbackPosX / baseWidth ) * containerWidth;
				const pixelY = ( fallbackPosY / baseHeight ) * containerHeight;

				hotspotDiv.style.left = `${ pixelX }px`;
				hotspotDiv.style.top = `${ pixelY }px`;

				const fallbackDiameter = hotspot.oSize?.diameter ?? hotspot.size?.diameter ?? 48;

				const pixelDiameter = ( fallbackDiameter / baseWidth ) * containerWidth;

				hotspotDiv.style.width = `${ pixelDiameter }px`;
				hotspotDiv.style.height = `${ pixelDiameter }px`;
				hotspotDiv.style.backgroundColor = hotspot.backgroundColor || '#0c80dfa6';

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

				if ( layerObj.pauseOnHover ) {
					hotspotDiv.addEventListener( 'mouseenter', () => {
						currentPlayer.pause();
					} );
				}
			} );
		}

		// Reposition hotspots on resize
		function updateHotspotPositions( currentPlayer, currentHotspotLayers ) {
			const videoContainer = currentPlayer.el();
			const containerWidth = videoContainer.offsetWidth;
			const containerHeight = videoContainer.offsetHeight;

			const baseWidth = 800;
			const baseHeight = 600;

			currentHotspotLayers.forEach( ( layerObj ) => {
				if ( ! layerObj.layerElement.classList.contains( 'hidden' ) ) {
					const hotspotDivs = layerObj.layerElement.querySelectorAll( '.hotspot' );
					hotspotDivs.forEach( ( hotspotDiv, index ) => {
						const hotspot = layerObj.hotspots[ index ];
						const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
						const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;

						const pixelX = ( fallbackPosX / baseWidth ) * containerWidth;
						const pixelY = ( fallbackPosY / baseHeight ) * containerHeight;

						hotspotDiv.style.left = `${ pixelX }px`;
						hotspotDiv.style.top = `${ pixelY }px`;

						const fallbackDiameter =
							hotspot.oSize?.diameter ??
							hotspot.size?.diameter ??
							48;
						const pixelDiameter = ( fallbackDiameter / baseWidth ) * containerWidth;

						hotspotDiv.style.width = `${ pixelDiameter }px`;
						hotspotDiv.style.height = `${ pixelDiameter }px`;
					} );
				}
			} );
		}

		window.addEventListener( 'resize', () => {
			updateHotspotPositions( player, hotspotLayers );
		} );

		// Fullscreen logic for forms
		player.on( 'fullscreenchange', () => {
			const isFullscreen = player.isFullscreen();
			const videoContainer = player.el();

			// Move form layers in/out
			formLayers.forEach( ( layerObj ) => {
				if ( isFullscreen ) {
					videoContainer.appendChild( layerObj.layerElement );
					layerObj.layerElement.classList.add( 'fullscreen-layer' );
				} else {
					layerObj.layerElement.classList.remove( 'fullscreen-layer' );
				}
			} );

			// Also re-attach hotspot layers to the container
			hotspotLayers.forEach( ( layerObj ) => {
				if ( isFullscreen && ! videoContainer.contains( layerObj.layerElement ) ) {
					videoContainer.appendChild( layerObj.layerElement );
				}
			} );
			updateHotspotPositions( player, hotspotLayers );
		} );

		// Prevent video resume if a form/CTA is visible
		player.on( 'play', () => {
			const isAnyFormVisible = formLayers.some(
				( layerObj ) =>
					! layerObj.layerElement.classList.contains( 'hidden' ) &&
					layerObj.show,
			);
			if ( isAnyFormVisible ) {
				player.pause();
			}
		} );

		// Add skip logic for forms
		formLayers.forEach( ( layerObj ) => {
			const skipButton = document.createElement( 'button' );
			skipButton.textContent = 'Skip';
			skipButton.classList.add( 'skip-button' );

			if ( ! layerObj.allowSkip ) {
				skipButton.classList.add( 'hidden' );
			}

			const observer = new MutationObserver( () => {
				if ( layerObj.layerElement.querySelector( '.gform_confirmation_message' ) ) {
					skipButton.textContent = 'Continue';
					skipButton.classList.remove( 'hidden' );
					observer.disconnect();
				}
			} );
			observer.observe( layerObj.layerElement, { childList: true, subtree: true } );

			skipButton.addEventListener( 'click', () => {
				layerObj.show = false;
				layerObj.layerElement.classList.add( 'hidden' );
				player.controls( true );
				player.play();
				isDisplayingLayer = false;
			} );

			layerObj.layerElement.appendChild( skipButton );
		} );

		player.qualityMenu();
	} );
}
