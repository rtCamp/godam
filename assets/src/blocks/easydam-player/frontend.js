/**
 * External dependencies
 */
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import 'videojs-contrib-quality-menu';

/**
 * Internal dependencies
 */
import EasyDAM from '../../../../assets/src/images/EasyDAM.png';

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

		// Appearance settings

		const controlBarSettings =
      videoSetupOptions.easydam_meta.videoConfig.controlBar;

		console.log( 'controlBarSettings', controlBarSettings );

		// Play button position
		const playButton = player.getChild( 'bigPlayButton' );

		// List of possible alignments
		const alignments = [
			'left-align',
			'center-align',
			'right-align',
			'top-align',
			'bottom-align',
		];

		// Update classes
		playButton.removeClass( ...alignments ); // Remove all alignment classes
		if ( alignments.includes( `${ controlBarSettings.playButtonPosition }-align` ) ) {
			playButton.addClass( `${ controlBarSettings.playButtonPosition }-align` ); // Add the selected alignment class
		}

		// Control bar position

		const controlBar = player.controlBar;

		//volume toggle
		if ( ! controlBarSettings.volumePanel ) {
			player.controlBar.removeChild( 'volumePanel' );
		}

		//work upon
		if ( ! controlBarSettings.subsCapsButton ) {
			player.controlBar.removeChild( 'subsCapsButton' );
		} else {
			player.controlBar.addChild( 'subsCapsButton' );
		}

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
				if ( 0 === controlBarSettings.customBrandImg.length ) {
					img.src = EasyDAM;
				} else {
					img.src = controlBarSettings.customBrandImg;
				}
				img.id = 'branding-icon';
				img.alt = 'Branding';
				img.className = 'branding-icon';
				el.appendChild( img );
				return el;
			}

			// Add click event for playback
			handleClick() {
				event.preventDefault();
			}
		}

		videojs.registerComponent( 'CustomButton', CustomButton );

		if ( controlBarSettings.brandingIcon ) {
			player.controlBar.addChild( 'CustomButton', {} );
		}

		// Get all child components of the control bar
		const controls = controlBar.children_;

		if ( 'vertical' === controlBarSettings.controlBarPosition ) {
			controlBar.addClass( 'vjs-control-bar-vertical' );
			for ( const control of controls ) {
				control.el_.classList.add( 'vjs-control-vertical' );
				if ( control.el_.classList.contains( 'vjs-volume-panel' ) ) {
					control.el_.classList.add( 'vjs-volume-panel-vertical' );
					control.el_.classList.remove( 'vjs-volume-panel-horizontal' );
				}

				if ( control.el_.classList.contains( 'vjs-volume-horizontal' ) ) {
					control.el_.classList.add( 'vjs-volume-vertical' );
				}
			}
		}
	} );
}
