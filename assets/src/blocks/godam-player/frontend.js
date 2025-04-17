/* global godamSettings */

/**
 * External dependencies
 */
/**
 * VideoJs dependencies
 */
import 'video.js/dist/video-js.css';
import 'videojs-contrib-ads/dist/videojs.ads.css';
import 'videojs-ima/dist/videojs.ima.css';
import videojs from 'video.js';
import 'videojs-contrib-ads';
import 'videojs-ima';
import 'videojs-contrib-quality-menu';

/**
 * FontAwesome dependencies
 */
import { library, dom } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons';

/**
 * Quill dependencies dependencies for the CTA text layer
 */
import 'quill/dist/quill.snow.css';

/**
 * Internal dependencies
 */
import GoDAM from '../../../../assets/src/images/GoDAM.png';

/**
 * Global variables
 */
const validAPIKey = window?.godamAPIKeyData?.valid_api_key;

library.add( fas );
dom.watch();

document.addEventListener( 'DOMContentLoaded', () => GODAMPlayer() );

function GODAMPlayer( videoRef = null ) {
	let videos = document.querySelectorAll( '.easydam-player.video-js' );

	if ( videoRef ) {
		videos = videoRef.querySelectorAll( '.easydam-player.video-js' );
	}

	videos.forEach( ( video ) => {
		video.classList.remove( 'vjs-hidden' );

		video.closest( '.animate-video-loading' ).classList.remove( 'animate-video-loading' );

		const adTagUrl = video.dataset.ad_tag_url;
		let isVideoClicked = false;

		const videoSetupOptions = video.dataset.options
			? JSON.parse( video.dataset.options )
			: {};

		const videoSetupControls = video.dataset.controls
			? JSON.parse( video.dataset.controls )
			: {
				controls: true,
				autoplay: false,
				preload: 'auto',
				fluid: true,
				preview: false,
			};

		const isPreviewEnabled = videoSetupOptions.preview;

		const player = videojs( video, videoSetupControls );

		video.addEventListener( 'loadedmetadata', () => {
			const playerElement = player.el_;

			const captionControlBtn = playerElement.querySelector( '.vjs-control-bar .vjs-subs-caps-button.vjs-control.vjs-hidden' );

			if ( captionControlBtn ) {
				const qualityControlBtn = playerElement.querySelector( '.vjs-control-bar .vjs-quality-menu-wrapper' );
				if ( qualityControlBtn ) {
					qualityControlBtn.style.setProperty( 'right', '80px' );
				}
			}
		} );

		// Function to move video controls
		function moveVideoControls() {
			try {
				const playerElement = player.el_;
				const newHeight = playerElement.offsetHeight;

				const skipButtons = playerElement.querySelectorAll(
					'.vjs-skip-backward-5, .vjs-skip-backward-10, .vjs-skip-backward-30, .vjs-skip-forward-5, .vjs-skip-forward-10, .vjs-skip-forward-30',
				);

				skipButtons.forEach( ( button ) => {
					button.style.setProperty( 'bottom', `${ newHeight / 2 }px` );
				} );
			} catch ( error ) {
				// Silently fail - do nothing.
			}
		}

		function handleVideoResize() {
			// if screen size if greater than 768px then skip.
			if ( window.innerWidth > 768 ) {
				return;
			}

			// Apply debounce to avoid multiple calls.
			if ( handleVideoResize.timeout ) {
				clearTimeout( handleVideoResize.timeout );
			}
			handleVideoResize.timeout = setTimeout( () => {
				moveVideoControls();
			}, 100 );
		}

		handleVideoResize();

		// On screen resize, update the video dimensions.
		window.addEventListener( 'resize', handleVideoResize );

		let isPreview = null;

		const watcher = {
			set value( newValue ) {
				if ( isPreview !== newValue ) {
					isPreview = newValue;
					handlePreviewStateChange( newValue ); // Call the function whenever the value changes
				}
			},
			get value() {
				return isPreview;
			},
		};

		function startPreview() {
			player.volume( 0 );
			player.currentTime( 0 );
			const controlBarElement = player.controlBar.el();
			if ( controlBarElement ) {
				controlBarElement.classList.add( 'hide' );
			}
			watcher.value = true;
			player.play();
		}

		function stopPreview() {
			const controlBarElement = player.controlBar.el();
			if ( controlBarElement ) {
				controlBarElement.classList.remove( 'hide' );
			}
			const muteButton = document.querySelector( '.mute-button' );
			if ( muteButton && muteButton.classList.contains( 'mute-button' ) ) {
				muteButton.classList.remove( 'mute-button' );
			}
			player.pause();
			player.currentTime( 0 );
		}

		function clearPreviewTimeout() {
			if ( previewTimeoutId ) {
				clearTimeout( previewTimeoutId );
				previewTimeoutId = null;
			}
		}

		video.addEventListener( 'click', () => {
			if ( ! isPreviewEnabled ) {
				return;
			}
			isVideoClicked = true;
			clearPreviewTimeout();
			if ( watcher.value ) {
				player.currentTime( 0 );
			}
			watcher.value = false;
			const controlBarElement = player.controlBar.el();
			if ( controlBarElement.classList.contains( 'hide' ) ) {
				controlBarElement.classList.remove( 'hide' );
			}
			const muteButton = document.querySelector( '.mute-button' );
			if ( muteButton && muteButton.classList.contains( 'mute-button' ) ) {
				muteButton.classList.remove( 'mute-button' );
			}
		} );

		let previewTimeoutId;

		video.addEventListener( 'mouseenter', () => {
			if ( ! isPreviewEnabled ) {
				return;
			}

			if ( video.currentTime > 0 || isVideoClicked ) {
				return;
			}

			startPreview();
			previewTimeoutId = setTimeout( () => {
				if ( watcher.value && isPreviewEnabled ) {
					stopPreview();
					watcher.value = false; //set isPreview to false to show layers.
				}
			}, 10000 );
		} );

		video.addEventListener( 'mouseleave', ( e ) => {
			if ( ! isPreviewEnabled ) {
				return;
			}
			if (
				! watcher.value ||
        e.relatedTarget?.parentElement?.className?.indexOf( 'easydam-player' ) !==
          -1 ||
        e.toElement?.parentElement?.className?.indexOf( 'easydam-player' ) !== -1
			) {
				return;
			}
			player.currentTime( 0 );
			player.pause();
			stopPreview();
		} );

		player.ready( function() {
			const controlBarSettings =
				videoSetupControls.controlBar;

			// Appearance settings

			// Play button position handling
			const playButton = player.getChild( 'bigPlayButton' );
			const alignments = [
				'left-align',
				'center-align',
				'right-align',
				'top-align',
				'bottom-align',
			];

			// Update classes
			playButton.removeClass( ...alignments ); // Remove all alignment classes
			if (
				alignments.includes( `${ controlBarSettings.playButtonPosition }-align` )
			) {
				playButton.addClass( `${ controlBarSettings.playButtonPosition }-align` ); // Add the selected alignment class
			}

			// Control bar and volume panel handling
			const controlBar = player.controlBar;

			if ( ! controlBarSettings.volumePanel ) {
				controlBar.removeChild( 'volumePanel' );
			}

			if ( controlBarSettings.brandingIcon || ! validAPIKey ) {
				const CustomPlayButton = videojs.getComponent( 'Button' );

				class CustomButton extends CustomPlayButton {
					constructor( p, options ) {
						super( p, options );
						this.controlText( 'Branding' );
					}
					// Set the button content
					createEl() {
						const el = super.createEl();
						el.className += ' vjs-custom-play-button';
						const img = document.createElement( 'img' );

						if ( controlBarSettings.customBrandImg?.length ) {
							img.src = controlBarSettings.customBrandImg;
						} else if ( godamSettings?.brandImage ) {
							img.src = godamSettings.brandImage;
						} else {
							img.src = GoDAM;
						}

						img.id = 'branding-icon';
						img.alt = 'Branding';
						img.className = 'branding-icon';
						el.appendChild( img );
						return el;
					}

					// Add click event for playback
					handleClick( event ) {
						event.preventDefault();
					}
				}

				// Register the component before using it
				videojs.registerComponent( 'CustomButton', CustomButton );
				controlBar.addChild( 'CustomButton', {} );
			}
		} );

		// Find and initialize layers from easydam_meta
		const layers = videoSetupOptions.layers || [];
		const formLayers = [];
		const hotspotLayers = [];

		// Function to handle `isPreview` state changes
		function handlePreviewStateChange( newValue ) {
			layers.forEach( ( layer ) => {
				if ( newValue ) {
					return;
				}
				handleLayerDisplay( layer );
			} );
		}

		const handleLayerDisplay = ( layer ) => {
			const instanceId = video.dataset.instanceId;
			const layerId = `layer-${ instanceId }-${ layer.id }`;
			const layerElement = document.querySelector( `#${ layerId }` );

			if ( ! layerElement ) {
				return;
			}

			layerElement.classList.add( 'hidden' ); // Initially hidden

			if ( layer.type === 'form' || layer.type === 'cta' || layer.type === 'poll' ) {
				if ( layer.custom_css ) {
					const styleElement = document.createElement( 'style' );
					styleElement.textContent = layer.custom_css;
					layerElement.appendChild( styleElement );
				}
				const existingLayer = formLayers.some(
					() => layer.layerElement === layerElement,
				);

				if ( ! existingLayer ) {
					formLayers.push( {
						layerElement,
						displayTime: parseFloat( layer.displayTime ),
						show: true,
						allowSkip: layer.allow_skip !== undefined ? layer.allow_skip : true,
					} );
				}
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

			// Allow closing or skipping layers
			formLayers.forEach( ( layerObj, index ) => {
				let skipButton = layerObj.layerElement.querySelector( '.skip-button' );

				// Check if skip button already exists.
				if ( ! skipButton ) {
					skipButton = document.createElement( 'button' );
					skipButton.textContent = 'Skip';
					skipButton.classList.add( 'skip-button' );

					const arrowIcon = document.createElement( 'i' );
					arrowIcon.className = 'fa-solid fa-chevron-right';
					skipButton.appendChild( arrowIcon );
				}

				if ( ! layerObj.allowSkip ) {
					skipButton.classList.add( 'hidden' );
				}

				// Observe changes in the layer's DOM for the confirmation message
				const observer = new MutationObserver( ( mutations ) => {
					mutations.forEach( () => {
						if (
							layerObj.layerElement.querySelector( '.gform_confirmation_message' ) ||
							layerObj.layerElement.querySelector( '.wpforms-confirmation-container-full' ) ||
							layerObj.layerElement.querySelector( 'form.wpcf7-form.sent' )
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
					attributes: true,
					attributeFilter: [ 'class' ],
				} );

				skipButton.addEventListener( 'click', () => {
					layerObj.show = false;
					layerObj.layerElement.classList.add( 'hidden' );
					player.controls( true );
					player.play();
					isDisplayingLayer = false;
					// Increment the current form layer.
					if ( index === currentFormLayerIndex ) {
						currentFormLayerIndex++;
					}
				} );

				layerObj.layerElement.appendChild( skipButton );
			} );
		};

		if ( ! isPreviewEnabled ) {
			layers.forEach( ( layer ) => {
				handleLayerDisplay( layer );
			} );
		}

		formLayers.sort( ( a, b ) => a.displayTime - b.displayTime );

		let currentFormLayerIndex = 0;
		let isDisplayingLayer = false;

		// Time update
		player.on( 'timeupdate', () => {
			const currentTime = player.currentTime();

			// form/cta handling only the current form layer (if any)
			if ( ! isDisplayingLayer && currentFormLayerIndex < formLayers.length ) {
				const layerObj = formLayers[ currentFormLayerIndex ];
				// If we've reached its displayTime, show it
				if (
					layerObj.show &&
          currentTime >= layerObj.displayTime &&
          layerObj.layerElement.classList.contains( 'hidden' )
				) {
					layerObj.layerElement.classList.remove( 'hidden' );
					player.pause();
					player.controls( false );
					isDisplayingLayer = true;
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
						if ( ! layerObj.layerElement.dataset?.hotspotsInitialized ) {
							createHotspots( layerObj, player );
							layerObj.layerElement.dataset.hotspotsInitialized = true;
						}
					}
				} else if ( ! layerObj.layerElement.classList.contains( 'hidden' ) ) {
					layerObj.layerElement.classList.add( 'hidden' );
				}
			} );
		} );

		// Add a flag to track the playback state before hover
		let wasPlayingBeforeHover = false;

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

				// Background color
				if ( hotspot.icon ) {
					hotspotDiv.style.backgroundColor = 'white';
				} else {
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
					iconEl.style.color = '#000';
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
					hotspotLink.textContent =
            hotspot.tooltipText || `Hotspot ${ index + 1 }`;
					tooltipDiv.textContent = '';
					tooltipDiv.appendChild( hotspotLink );
				}

				hotspotContent.appendChild( tooltipDiv );
				hotspotDiv.appendChild( hotspotContent );
				layerObj.layerElement.appendChild( hotspotDiv );

				// Pause on hover
				if ( layerObj.pauseOnHover ) {
					hotspotDiv.addEventListener( 'mouseenter', () => {
						// Check if the video is currently playing before pausing
						wasPlayingBeforeHover = ! currentPlayer.paused();
						currentPlayer.pause();
					} );
					hotspotDiv.addEventListener( 'mouseleave', () => {
						// Resume playback only if the video was playing before hover
						if ( wasPlayingBeforeHover ) {
							currentPlayer.play();
						}
					} );
				}

				requestAnimationFrame( () => {
					positionTooltip( hotspotDiv, tooltipDiv );
				} );
			} );
		}

		function positionTooltip( hotspotDiv, tooltipDiv ) {
			const hotspotRect = hotspotDiv.getBoundingClientRect();
			const tooltipRect = tooltipDiv.getBoundingClientRect();

			const viewportWidth = window.innerWidth;

			const spaceAbove = hotspotRect.top;
			if ( spaceAbove < tooltipRect.height + 10 ) {
				// Place below
				tooltipDiv.style.bottom = 'auto';
				tooltipDiv.style.top = '100%';
				tooltipDiv.classList.add( 'tooltip-bottom' );
				tooltipDiv.classList.remove( 'tooltip-top' );
			} else {
				// Place above
				tooltipDiv.style.bottom = '100%';
				tooltipDiv.style.top = 'auto';
				tooltipDiv.classList.add( 'tooltip-top' );
				tooltipDiv.classList.remove( 'tooltip-bottom' );
			}
			const spaceLeft = hotspotRect.left;
			const spaceRight = viewportWidth - hotspotRect.right;

			if ( spaceLeft < 10 ) {
				// Adjust to the right
				tooltipDiv.style.left = '0';
				tooltipDiv.style.transform = 'translateX(0)';
				tooltipDiv.classList.add( 'tooltip-left' );
				tooltipDiv.classList.remove( 'tooltip-right' );
				tooltipDiv.classList.add( 'no-arrow' );
			} else if ( spaceRight < 10 ) {
				// Adjust to the left
				tooltipDiv.style.left = 'auto';
				tooltipDiv.style.right = '0';
				tooltipDiv.style.transform = 'translateX(0)';
				tooltipDiv.classList.add( 'tooltip-right' );
				tooltipDiv.classList.remove( 'tooltip-left' );
				tooltipDiv.classList.add( 'no-arrow' );
			} else {
				// Centered horizontally
				tooltipDiv.style.left = '50%';
				tooltipDiv.style.right = 'auto';
				tooltipDiv.style.transform = 'translateX(-50%)';
				tooltipDiv.classList.remove(
					'tooltip-left',
					'tooltip-right',
					'no-arrow',
				);
			}
		}

		// Reposition hotspots on resize or fullscreen
		function updateHotspotPositions( currentPlayer, currentHotspotLayers ) {
			const videoContainer = currentPlayer.el();
			const containerWidth = videoContainer.offsetWidth;
			const containerHeight = videoContainer.offsetHeight;

			const baseWidth = 800;
			const baseHeight = 600;

			currentHotspotLayers.forEach( ( layerObj ) => {
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

					const tooltipDiv = hotspotDiv.querySelector( '.hotspot-tooltip' );
					if ( tooltipDiv ) {
						requestAnimationFrame( () => {
							positionTooltip( hotspotDiv, tooltipDiv );
						} );
					}
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
			const isAnyLayerVisible = formLayers.some(
				( layerObj ) =>
					! layerObj.layerElement.classList.contains( 'hidden' ) && layerObj.show,
			);
			if ( isAnyLayerVisible ) {
				player.pause();
			}
		} );

		if ( adTagUrl ) {
			player.ima( {
				id: 'content_video',
				adTagUrl,
			} );
		}

		try {
			player.qualityMenu();
		} catch ( error ) {
			// Silently fail - do nothing.
		}
	} );
}

window.GODAMPlayer = GODAMPlayer;
