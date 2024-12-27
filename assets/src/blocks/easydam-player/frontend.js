/**
 * External dependencies
 */
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'videojs-contrib-quality-menu';
import { library, dom } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';

library.add( fas );

dom.watch();

document.addEventListener( 'DOMContentLoaded', () => easyDAMPlayer() );

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
		const formLayers = [];
		const hotspotLayers = [];

		// Hide all layers initially.
		layers.forEach( ( layer ) => {
			const layerId = `layer-${ layer.id }`;
			const layerElement = document.querySelector( `#${ layerId }` );

			if ( ! layerElement ) {
				return;
			}
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
					duration: layer.duration ? parseInt( layer.duration ) : 0,
					show: true,
					hotspots: layer.hotspots || [],
					pauseOnHover: layer.pauseOnHover || false,
				} );
			}
		} );

		let isDisplayingLayer = false;

		// Time update
		player.on( 'timeupdate', () => {
			const currentTime = player.currentTime();

			// form/cta handling
			if ( ! isDisplayingLayer ) {
				for ( const layerObj of formLayers ) {
					if (
						layerObj.show &&
						currentTime >= layerObj.displayTime &&
						layerObj.layerElement.classList.contains( 'hidden' )
					) {
						layerObj.layerElement.classList.remove( 'hidden' );
						player.pause();
						player.controls( false );
						isDisplayingLayer = true;
						break;
					}
				}
			}

			// hotspot handling
			hotspotLayers.forEach( ( layerObj ) => {
				if ( ! layerObj.show ) {
					return;
				}

				const endTime = layerObj.displayTime + layerObj.duration;
				const isActive =
					currentTime >= layerObj.displayTime && currentTime < endTime;

				if ( isActive ) {
					if ( layerObj.layerElement.classList.contains( 'hidden' ) ) {
						// first time show
						layerObj.layerElement.classList.remove( 'hidden' );
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
				// Create the outer div
				const hotspotDiv = document.createElement( 'div' );
				hotspotDiv.classList.add( 'hotspot', 'circle' );
				hotspotDiv.style.position = 'absolute';

				// Positioning
				const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
				const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;
				const pixelX = ( fallbackPosX / baseWidth ) * containerWidth;
				const pixelY = ( fallbackPosY / baseHeight ) * containerHeight;

				hotspotDiv.style.left = `${ pixelX }px`;
				hotspotDiv.style.top = `${ pixelY }px`;

				// Sizing
				const fallbackDiameter =
					hotspot.oSize?.diameter ?? hotspot.size?.diameter ?? 48;
				const pixelDiameter = ( fallbackDiameter / baseWidth ) * containerWidth;
				hotspotDiv.style.width = `${ pixelDiameter }px`;
				hotspotDiv.style.height = `${ pixelDiameter }px`;

				// If there's an icon, we might want a white background
				if ( hotspot.icon ) {
					// Provide a white background or custom
					hotspotDiv.style.backgroundColor = 'white';
				} else {
					// fallback background color
					hotspotDiv.style.backgroundColor =
						hotspot.backgroundColor || '#0c80dfa6';
				}

				// Inner content
				const hotspotContent = document.createElement( 'div' );
				hotspotContent.classList.add( 'hotspot-content' );
				hotspotContent.style.position = 'relative';
				hotspotContent.style.width = '100%';
				hotspotContent.style.height = '100%';

				if ( hotspot.icon ) {
					const iconEl = document.createElement( 'i' );
					iconEl.className = `fa-solid fa-${ hotspot.icon }`;
					iconEl.style.width = '50%';
					iconEl.style.height = '50%';
					iconEl.style.fontSize = '1.6em';
					iconEl.style.display = 'flex';
					iconEl.style.alignItems = 'center';
					iconEl.style.justifyContent = 'center';
					iconEl.style.margin = 'auto';
					hotspotContent.appendChild( iconEl );
				} else {
					hotspotContent.classList.add( 'no-icon' );
				}

				// Tooltip
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
					hotspotDiv.addEventListener( 'mouseleave', () => {
						currentPlayer.play();
					} );
				}
			} );
		}

		// Reposition hotspots on resize or fullscreen
		function updateHotspotPositions( currentPlayer, currentHotspotLayers ) {
			const videoContainer = currentPlayer.el();
			const containerWidth = videoContainer.offsetWidth;
			const containerHeight = videoContainer.offsetHeight;

			const baseWidth = 800;
			const baseHeight = 600;

			currentHotspotLayers.forEach( ( layerObj ) => {
				if ( layerObj.layerElement.classList.contains( 'hidden' ) ) {
					return;
				}
				const hotspotDivs = layerObj.layerElement.querySelectorAll( '.hotspot' );
				hotspotDivs.forEach( ( hotspotDiv, index ) => {
					const hotspot = layerObj.hotspots[ index ];
					// Recalc pos
					const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
					const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;
					const pixelX = ( fallbackPosX / baseWidth ) * containerWidth;
					const pixelY = ( fallbackPosY / baseHeight ) * containerHeight;
					hotspotDiv.style.left = `${ pixelX }px`;
					hotspotDiv.style.top = `${ pixelY }px`;

					// Recalc size
					const fallbackDiameter =
						hotspot.oSize?.diameter ?? hotspot.size?.diameter ?? 48;
					const pixelDiameter = ( fallbackDiameter / baseWidth ) * containerWidth;
					hotspotDiv.style.width = `${ pixelDiameter }px`;
					hotspotDiv.style.height = `${ pixelDiameter }px`;
				} );
			} );
		}

		window.addEventListener( 'resize', () => {
			updateHotspotPositions( player, hotspotLayers );
		} );

		player.on( 'fullscreenchange', () => {
			const isFullscreen = player.isFullscreen();
			const videoContainer = player.el();

			formLayers.forEach( ( layerObj ) => {
				if ( isFullscreen ) {
					videoContainer.appendChild( layerObj.layerElement );
					layerObj.layerElement.classList.add( 'fullscreen-layer' );
				} else {
					layerObj.layerElement.classList.remove( 'fullscreen-layer' );
				}
			} );

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

		// Allow closing or skipping layers
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
