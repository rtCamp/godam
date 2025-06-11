/* global godamSettings, wpforms */

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
import Share from '../../../../assets/src/images/share.svg';
import CopyIcon from '../../../../assets/src/images/clipboard.svg';
import Facebook from '../../../../assets/src/images/facebook.svg';
import LinkedIn from '../../../../assets/src/images/linkedin.svg';
import Reddit from '../../../../assets/src/images/reddit.svg';
import Telegram from '../../../../assets/src/images/telegram.svg';
import Twitter from '../../../../assets/src/images/twitter-x.svg';
import Whatsapp from '../../../../assets/src/images/whatsapp.svg';
import Complete from '../../../../assets/src/images/check.svg';
import DOMPurify from 'isomorphic-dompurify';
import SettingsButton from './masterSettings';
import {
	createChapterMarkers,
	updateActiveChapter,
	loadChapters,
} from './chapters.js'; // Adjust path as needed

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

	const isDisplayingLayers = {};

	videos.forEach( ( video ) => {
		isDisplayingLayers[ video.dataset.instanceId ] = false;
	} );

	videos.forEach( ( video ) => {
		video.classList.remove( 'vjs-hidden' );

		const currentPlayerVideoInstanceId = video.dataset.instanceId;

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

		if ( ! ( 'controlBar' in videoSetupControls ) ) {
			videoSetupControls.controlBar = {
				playToggle: true,
				volumePanel: true,
				currentTimeDisplay: true,
				timeDivider: true,
				durationDisplay: true,
				fullscreenToggle: true,
				subsCapsButton: true,
				skipButtons: {
					forward: 10,
					backward: 10,
				},
			};
		}

		const isPreviewEnabled = videoSetupOptions?.preview;

		const player = videojs( video, videoSetupControls );

		video.addEventListener( 'loadedmetadata', () => {
			const playerElement = player.el_;

			const captionControlBtn = playerElement.querySelector( '.vjs-control-bar .vjs-subs-caps-button.vjs-control.vjs-hidden' );

			if ( captionControlBtn ) {
				const qualityControlBtn = playerElement.querySelector( '.vjs-control-bar .vjs-quality-menu-wrapper' );
				if ( qualityControlBtn ) {
					qualityControlBtn.classList.add( 'mobile-right-80' );
				}
			}
		} );

		const getChaptersData = () => {
			if (
				videoSetupOptions?.chapters &&
				Array.isArray( videoSetupOptions.chapters ) &&
				videoSetupOptions.chapters.length > 0
			) {
				const seenTimes = new Set();

				// First filter out invalid entries
				const filteredChapters = videoSetupOptions.chapters.filter( ( chapter ) => {
					const time = parseFloat( chapter.startTime );

					// Conditions to discard
					if (
						! chapter.startTime || // empty string or undefined
						isNaN( time ) ||
						time < 0 ||
						seenTimes.has( time )
					) {
						return false;
					}

					seenTimes.add( time );
					return true;
				} );

				// Now convert to your format
				return filteredChapters.map( ( chapter ) => ( {
					startTime: parseFloat( chapter.startTime ) || 0,
					text: chapter.text || 'Chapter',
					originalTime: chapter.originalTime,
					endTime: null,
				} ) );
			}
		};

		// Helper function to format seconds to MM:SS or HH:MM:SS
		function formatTimeFromSeconds( seconds ) {
			if ( seconds >= 3600 ) {
				const hours = Math.floor( seconds / 3600 );
				const mins = Math.floor( ( seconds % 3600 ) / 60 );
				const secs = Math.floor( seconds % 60 );
				return `${ hours }:${ mins.toString().padStart( 2, '0' ) }:${ secs.toString().padStart( 2, '0' ) }`;
			}
			const mins = Math.floor( seconds / 60 );
			const secs = Math.floor( seconds % 60 );
			return `${ mins }:${ secs.toString().padStart( 2, '0' ) }`;
		}

		const initializeChapters = ( chaptersData ) => {
			if ( ! chaptersData || chaptersData?.length === 0 ) {
				console.log( 'No chapters data available' );
				return;
			}

			// Sort chapters by start time
			chaptersData.sort( ( a, b ) => a.startTime - b.startTime );

			// Calculate end times
			for ( let i = 0; i < chaptersData?.length; i++ ) {
				if ( i < chaptersData.length - 1 ) {
					chaptersData[ i ].endTime = chaptersData[ i + 1 ].startTime;
				} else {
					// Last chapter - end time will be set to video duration when available
					chaptersData[ i ].endTime = null;
				}
			}

			console.log( 'Initializing chapters:', chaptersData );

			// Load chapters using the chapters.js module
			loadChapters( player, chaptersData );

			return chaptersData;
		};

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
				controlBarElement?.classList.add( 'hide' );
			}
			watcher.value = true;
			player.play();
		}

		function stopPreview() {
			const controlBarElement = player.controlBar.el();
			if ( controlBarElement ) {
				controlBarElement?.classList.remove( 'hide' );
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
			if ( controlBarElement?.classList.contains( 'hide' ) ) {
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

		player.jobId = '';

		const Button = videojs.getComponent( 'Button' );

		class GodamShareButton extends Button {
			buildCSSClass() {
				return `godam-share-button ${ super.buildCSSClass() }`;
			}

			// Set the button content
			createEl() {
				const el = super.createEl();
				const img = document.createElement( 'img' );

				img.src = Share;

				img.id = 'share-icon';
				img.alt = 'Share';
				img.className = 'share-icon';
				el.appendChild( img );
				return el;
			}

			copyToClipboard( inputId ) {
				const input = document.getElementById( inputId );
				const button = input.nextElementSibling; // assuming button is right after input

				const setSuccessStyle = () => {
					button.style.backgroundColor = '#4caf50'; // green background
					button.querySelector( 'img' ).src = Complete;
				};

				const resetStyle = () => {
					button.style.backgroundColor = 'transparent'; // reset background
					button.querySelector( 'img' ).src = CopyIcon;
				};

				// Common feedback function to handle success
				const doFeedback = () => {
					setSuccessStyle();
					setTimeout( resetStyle, 2000 ); // revert after 2 seconds
				};

				if ( navigator.clipboard && navigator.clipboard.writeText ) {
					navigator.clipboard
						.writeText( input.value )
						.then( () => {
							doFeedback(); // Use the common feedback function
						} )
						.catch( () => {
							// silently fail
						} );
				} else {
					input.select();
					input.setSelectionRange( 0, 99999 ); // for mobile
					try {
						document.execCommand( 'copy' );
						doFeedback(); // Use the common feedback function
					} catch ( err ) {
						// silently fail
					}
				}
			}

			// Add click event for playback
			handleClick( event ) {
				event.preventDefault();
				const shareModal = document.createElement( 'div' );
				const videoContainer = this.player().el_.closest(
					'.easydam-video-container',
				);
				if ( videoContainer ) {
					videoContainer.appendChild( shareModal );
				}
				shareModal.className = 'share-modal-container';
				const html = `
				<div class="share-modal-message">
					<div class="share-modal-header">
						<h2>Share Media</h2>
						<p>Copy the links below to share the selected media files.</p>
					</div>

					<div class="share-buttons">
						<a class="facebook social-icon" target="blank"><img src=${ Facebook } alt='Facebook icon' height={24} width={24}</a>
						<a class="twitter social-icon" target="blank"><img src=${ Twitter } alt='Twitter icon' height={24} width={24}</a>
						<a class="linkedin social-icon" target="blank"><img src=${ LinkedIn } alt='Linkedin icon' height={24} width={24}</a>
						<a class="reddit social-icon" target="blank"><img src=${ Reddit } alt='Reddit icon' height={24} width={24}</a>
						<a class="whatsapp social-icon" target="blank"><img src=${ Whatsapp } alt='Whatsapp icon' height={24} width={24}</a>
						<a class="telegram social-icon" target="blank"><img src=${ Telegram } alt='Telegram icon' height={24} width={24}</a>
					</div>
					
					<div class='share-input-container'>
						<label>Page Link</label>
						<div class="share-modal-input-group">
							<input id="page-link" type="text" value="${ window.godamData.api_base }/web/video/${ this.player().jobId }" readonly />
							<button id="copy-page-link" class="copy-button">
								<img src=${ CopyIcon } alt='copy icon' height=${ 24 } width=${ 24 }>
							</button>
						</div>
					</div>

					<div class='share-input-container'>
						<label>Embed</label>
						<div class="share-modal-input-group">
							<input id="embed-code" type="text" value='<iframe src="${ window.godamData.api_base }/web/embed/${ this.player().jobId }"></iframe>' readonly />
							<button id="copy-embed-code" class="copy-button">
								<img src=${ CopyIcon } alt='copy icon' height=${ 24 } width=${ 24 }>
							</button>
						</div>
					</div>

					<div class="share-modal-footer">
						<button id="cancel-button">Cancel</button>
					</div>
				</div>
			`;

				shareModal.innerHTML = DOMPurify.sanitize( html );

				shareModal
					.querySelector( '#copy-page-link' )
					.addEventListener( 'click', () => this.copyToClipboard( 'page-link' ) );

				shareModal
					.querySelector( '#copy-embed-code' )
					.addEventListener( 'click', () => this.copyToClipboard( 'embed-code' ) );

				shareModal
					.querySelector( '#cancel-button' )
					.addEventListener( 'click', function() {
						const cancelButton = shareModal.querySelector( '#cancel-button' );
						cancelButton.closest( '.share-modal-container' ).remove();
					} );

				const link = encodeURI(
					`${ window.godamData.api_base }/web/video/${ this.player().jobId }`,
				);
				const msg = encodeURIComponent( 'Check out this video!' );

				const fb = document.querySelector( '.facebook' );
				fb.href = `https://www.facebook.com/share.php?u=${ link }`;

				const twitter = document.querySelector( '.twitter' );
				twitter.href = `http://twitter.com/share?&url=${ link }&text=${ msg }`;

				const linkedIn = document.querySelector( '.linkedin' );
				linkedIn.href = `https://www.linkedin.com/sharing/share-offsite/?url=${ link }&text=${ msg }`;

				const reddit = document.querySelector( '.reddit' );
				reddit.href = `http://www.reddit.com/submit?url=${ link }&title=${ msg }`;

				const whatsapp = document.querySelector( '.whatsapp' );
				whatsapp.href = `https://api.whatsapp.com/send?text=${ msg }: ${ link }`;

				const telegram = document.querySelector( '.telegram' );
				telegram.href = `https://telegram.me/share/url?url=${ link }&text=${ msg }`;
			}
		}

		// Register the new component
		videojs.registerComponent( 'GodamShareButton', GodamShareButton );

		// FIXED: Store chapters data at player level
		let chaptersData = [];

		// Add the button to the control bar after the player is ready
		player.ready( function() {
			player.jobId = video.dataset.job_id; // Store the result when it's available
			const videoContainer = player.el().closest( '.easydam-video-container' );
			if ( videoContainer && player.jobId !== '' ) {
				const shareButton = new GodamShareButton( player );
				const buttonEl = shareButton.createEl();
				buttonEl.addEventListener(
					'click',
					shareButton.handleClick.bind( shareButton ),
				);
				videoContainer.appendChild( buttonEl );
			}

			// FIXED: Initialize chapters after player is ready
			chaptersData = getChaptersData();
			if ( chaptersData && chaptersData.length > 0 ) {
				initializeChapters( chaptersData );
			}
		} );

		console.log( chaptersData, 'chaptersData' );

		player.ready( function() {
			const controlBarSettings = videoSetupControls?.controlBar;

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
				alignments.includes( `${ controlBarSettings?.playButtonPosition }-align` )
			) {
				playButton.addClass( `${ controlBarSettings?.playButtonPosition }-align` ); // Add the selected alignment class
			}

			// Control bar and volume panel handling
			const controlBar = player.controlBar;

			if ( ! controlBarSettings?.volumePanel ) {
				controlBar.removeChild( 'volumePanel' );
			}

			videojs.registerComponent( 'SettingsButton', SettingsButton );
			controlBar.addChild( 'SettingsButton', {} );

			document.querySelectorAll( '.vjs-settings-button' ).forEach( ( button ) => {
				button.querySelector( '.vjs-icon-placeholder' ).classList.add( 'vjs-icon-cog' );
			} );

			if ( controlBarSettings?.brandingIcon || ! validAPIKey ) {
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

						if ( controlBarSettings?.customBrandImg?.length ) {
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

		// FIXED: Create markers when duration becomes available
		player.on( 'durationchange', () => {
			const duration = player.duration();
			if ( ! duration || duration === Infinity || ! chaptersData?.length ) {
				return;
			}

			// Drop chapters beyond duration
			chaptersData = chaptersData.filter( ( ch ) => ch.startTime < duration );

			// Set endTime for the last valid chapter
			chaptersData[ chaptersData.length - 1 ].endTime = duration;

			createChapterMarkers( player, chaptersData );
		} );

		player.on( 'timeupdate', () => {
			if ( chaptersData && chaptersData.length > 0 ) {
				updateActiveChapter( player.currentTime(), chaptersData );
			}
		} );

		// Find and initialize layers from easydam_meta
		const layers = videoSetupOptions?.layers || [];
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

			if ( typeof wpforms !== 'undefined' ) {
				wpforms.scrollToError = function() {};
				wpforms.animateScrollTop = function() {};
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

				let skipText = '';
				if ( 'form' === layer.type ) {
					skipText = 'Skip Form';
				} else if ( 'cta' === layer.type ) {
					skipText = 'Skip';
				} else if ( 'poll' === layer.type ) {
					skipText = 'Skip Poll';
				} else {
					skipText = 'Skip';
				}

				if ( ! existingLayer ) {
					formLayers.push( {
						layerElement,
						displayTime: parseFloat( layer.displayTime ),
						show: true,
						allowSkip: layer.allow_skip !== undefined ? layer.allow_skip : true,
						skipText,
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
			formLayers.forEach( ( layerObj ) => {
				let skipButton = layerObj.layerElement.querySelector( '.skip-button' );

				// Check if skip button already exists.
				if ( ! skipButton ) {
					skipButton = document.createElement( 'button' );
					skipButton.textContent = layerObj.skipText;
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
					isDisplayingLayers[ currentPlayerVideoInstanceId ] = false;
					// Increment the current form layer.
					if ( layerObj === formLayers[ currentFormLayerIndex ] ) {
						currentFormLayerIndex++;
					}
				} );

				layerObj.layerElement.appendChild( skipButton );
			} );
		};

		if ( ! isPreviewEnabled ) {
			layers.forEach( ( layer ) => {
				if ( layer.type === 'form' ) {
					if ( window.godamPluginDependencies?.gravityforms && layer.form_type === 'gravity' ) {
						handleLayerDisplay( layer );
					} else if ( window.godamPluginDependencies?.wpforms && layer.form_type === 'wpforms' ) {
						handleLayerDisplay( layer );
					} else if ( window.godamPluginDependencies?.cf7 && layer.form_type === 'cf7' ) {
						handleLayerDisplay( layer );
					}
				} else if ( layer.type === 'poll' ) {
					if ( window.godamPluginDependencies?.wp_polls ) {
						handleLayerDisplay( layer );
					}
				} else {
					handleLayerDisplay( layer );
				}
			} );
		}

		formLayers.sort( ( a, b ) => a.displayTime - b.displayTime );

		let currentFormLayerIndex = 0;
		isDisplayingLayers[ currentPlayerVideoInstanceId ] = false;

		// Time update
		player.on( 'timeupdate', () => {
			const currentTime = player.currentTime();

			// form/cta handling only the current form layer (if any)
			if ( ! isDisplayingLayers[ currentPlayerVideoInstanceId ] && currentFormLayerIndex < formLayers.length ) {
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
					isDisplayingLayers[ currentPlayerVideoInstanceId ] = true;
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

		if ( ! window.godamKeyboardHandlerInitialized ) {
			// Flag to prevent multiple initializations
			window.godamKeyboardHandlerInitialized = true;

			document.addEventListener( 'keydown', ( event ) => {
				// Skip if we're in a form field or input element to avoid interfering with typing
				if ( event.target.tagName === 'INPUT' ||
					event.target.tagName === 'TEXTAREA' ||
					event.target.isContentEditable ) {
					return;
				}

				// Find the most appropriate player to control
				let activePlayer = null;

				// First priority: player that contains the active element
				document.querySelectorAll( '.easydam-player.video-js' ).forEach( ( playerEl ) => {
					const vjsPlayer = videojs.getPlayer( playerEl );
					if ( playerEl.contains( playerEl.ownerDocument.activeElement ) ) {
						activePlayer = vjsPlayer;
					}
				} );

				// Second priority: visible player if no player has focus
				document
					.querySelectorAll( '.easydam-player.video-js' )
					.forEach( ( playerEl ) => {
						const doc = playerEl.ownerDocument;

						// Only proceed if no activePlayer and body has focus
						if ( ! activePlayer && doc.activeElement === doc.body ) {
							const rect = playerEl.getBoundingClientRect();
							const isVisible =
              rect.top >= 0 &&
              rect.left >= 0 &&
              rect.bottom <=
                ( window.innerHeight || doc.documentElement.clientHeight ) &&
              rect.right <=
                ( window.innerWidth || doc.documentElement.clientWidth );

							if ( isVisible ) {
								const vjsPlayer = videojs.getPlayer( playerEl );
								if ( vjsPlayer ) {
									activePlayer = vjsPlayer;
								}
							}
						}
					} );

				// If no active player was found, exit
				if ( ! activePlayer ) {
					return;
				}

				const element = activePlayer.el_;

				const activeVideo = element.querySelector( 'video' );
				const activeVideoInstanceId = activeVideo.dataset.instanceId;

				if ( isDisplayingLayers[ activeVideoInstanceId ] ) {
					return;
				}

				const key = event.key.toLowerCase();
				switch ( key ) {
					case 'f':
						// Toggle fullscreen
						event.preventDefault();
						if ( activePlayer.isFullscreen() ) {
							activePlayer.exitFullscreen();
						} else {
							activePlayer.requestFullscreen();
						}
						break;

					case 'arrowleft':
						// Seek backward 5 seconds
						event.preventDefault();
						activePlayer.currentTime( Math.max( 0, activePlayer.currentTime() - 5 ) );

						// Show a visual indicator for seeking backward
						showIndicator( activePlayer.el(), 'backward', '<i class="fa-solid fa-backward"></i> 5s' );
						break;

					case 'arrowright':
						// Seek forward 5 seconds
						event.preventDefault();
						activePlayer.currentTime( activePlayer.currentTime() + 5 );

						// Show a visual indicator for seeking forward
						showIndicator( activePlayer.el(), 'forward', '5s <i class="fa-solid fa-forward"></i>' );
						break;

					case ' ':
					case 'spacebar': // Added explicit 'spacebar' case for broader browser compatibility
						// Toggle play/pause
						event.preventDefault(); // prevent page scroll
						if ( activePlayer.paused() ) {
							activePlayer.play();

							// Visual indicator for play
							showIndicator( activePlayer.el(), 'play-indicator', '<i class="fa-solid fa-play"></i>' );
						} else {
							activePlayer.pause();

							// Visual indicator for pause
							showIndicator( activePlayer.el(), 'pause-indicator', '<i class="fa-solid fa-pause"></i>' );
						}
						break;
				}
			} );
		}

		// Helper function to show indicators
		function showIndicator( playerEl, className, html ) {
			// Remove any existing indicators first
			playerEl.querySelectorAll( '.vjs-seek-indicator' ).forEach( ( el ) => el.remove() );

			const indicator = document.createElement( 'div' );
			indicator.className = `vjs-seek-indicator ${ className }`;
			indicator.innerHTML = html;
			playerEl.appendChild( indicator );
			setTimeout( () => indicator.remove(), 500 );
		}

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
	} );
}

window.GODAMPlayer = GODAMPlayer;
