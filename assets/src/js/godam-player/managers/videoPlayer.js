/**
 * External dependencies
 */

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * VideoJs dependencies
 */
import videojs from 'video.js';

/**
 * Internal dependencies
 */
import GoDAM from '../../../../../assets/src/images/GoDAM.png';
import SettingsButton from '../masterSettings.js';
import {
	createChapterMarkers,
	updateActiveChapter,
	loadChapters,
} from '../chapters.js';

import HoverManager from './hoverManager.js';
import ShareManager from './shareManager.js';

/**
 * Constants
 */
const PLAYER_SKINS = {
	DEFAULT: 'Default',
	MINIMAL: 'Minimal',
	PILLS: 'Pills',
	CLASSIC: 'Classic',
};

const FORM_TYPES = {
	GRAVITY: 'gravity',
	WPFORMS: 'wpforms',
	EVEREST: 'everestforms',
	CF7: 'cf7',
	JETPACK: 'jetpack',
	SUREFORMS: 'sureforms',
	FORMINATOR: 'forminator',
	FLUENT: 'fluentforms',
	NINJA: 'ninjaforms',
};

const LAYER_TYPES = {
	FORM: 'form',
	CTA: 'cta',
	POLL: 'poll',
	HOTSPOT: 'hotspot',
};

/**
 * Individual Video Player Class
 */
export default class GodamVideoPlayer {
	constructor( video, isDisplayingLayers ) {
		this.video = video;
		this.isDisplayingLayers = isDisplayingLayers;
		this.currentPlayerVideoInstanceId = video.dataset.instanceId;
		this.player = null;
		this.chaptersData = [];
		this.formLayers = [];
		this.hotspotLayers = [];
		this.currentFormLayerIndex = 0;
		this.isVideoClicked = false;
		this.isPreview = null;
		this.previewTimeoutId = null;
		this.wasPlayingBeforeHover = false;

		this.setupConfiguration();
	}

	/**
	 * Setup video configuration
	 */
	setupConfiguration() {
		this.globalAdsSettings = this.parseDataAttribute( 'global_ads_settings', {} );
		this.adTagUrl = this.video.dataset.ad_tag_url;
		this.videoSetupOptions = this.parseDataAttribute( 'options', {} );
		this.videoSetupControls = this.parseDataAttribute( 'controls', this.getDefaultControls() );
		this.isPreviewEnabled = this.videoSetupOptions?.preview;

		this.ensureControlBarDefaults();
	}

	/**
	 * Parse data attribute safely
	 *
	 * @param {string} attribute    - Data attribute to parse
	 * @param {*}      defaultValue - Default value if parsing fails
	 * @return {*} Parsed value or default
	 */
	parseDataAttribute( attribute, defaultValue ) {
		try {
			return this.video.dataset[ attribute ] ? JSON.parse( this.video.dataset[ attribute ] ) : defaultValue;
		} catch {
			return defaultValue;
		}
	}

	/**
	 * Get default control configuration
	 */
	getDefaultControls() {
		return {
			controls: true,
			autoplay: false,
			preload: 'auto',
			fluid: true,
			preview: false,
		};
	}

	/**
	 * Ensure control bar has default settings
	 */
	ensureControlBarDefaults() {
		if ( ! ( 'controlBar' in this.videoSetupControls ) ) {
			this.videoSetupControls.controlBar = {
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
	}

	/**
	 * Initialize the video player
	 */
	initialize() {
		this.setupVideoElement();
		this.initializePlayer();
		this.setupEventListeners();
	}

	/**
	 * Setup video element
	 */
	setupVideoElement() {
		this.video.classList.remove( 'vjs-hidden' );

		const loadingElement = this.video.closest( '.animate-video-loading' );
		if ( loadingElement ) {
			loadingElement.classList.remove( 'animate-video-loading' );
		}
	}

	/**
	 * Initialize VideoJS player
	 */
	initializePlayer() {
		this.player = videojs( this.video, this.videoSetupControls );
		this.setupAspectRatio();
		this.setupPlayerReady();
	}

	/**
	 * Setup aspect ratio based on context
	 */
	setupAspectRatio() {
		const isInModal = this.video.closest( '.godam-modal' ) !== null;

		if ( isInModal ) {
			const aspectRatio = window.innerWidth < 420 ? '9:16' : '16:9';
			this.player.aspectRatio( aspectRatio );
		}
	}

	/**
	 * Setup player ready callback
	 */
	setupPlayerReady() {
		this.player.ready( () => {
			this.handleAspectRatioSetup();
			this.initializeManagers();
			this.setupCaptionsButton();
			this.player.jobId = this.video.dataset.job_id;
			this.initializeChapters();
		} );
	}

	/**
	 * Handle aspect ratio setup for non-modal players
	 */
	handleAspectRatioSetup() {
		const isInModal = this.video.closest( '.godam-modal' ) !== null;

		if ( ! isInModal ) {
			const aspectRatio = this.videoSetupOptions?.aspectRatio || '16:9';
			this.player.aspectRatio( aspectRatio );
		}
	}

	/**
	 * Initialize hover and share managers
	 */
	initializeManagers() {
		const hoverManager = new HoverManager( this.player, this.video );
		const shareManager = new ShareManager( this.player, this.video, this.videoSetupOptions );
		this.player.hoverManager = hoverManager;
		this.player.shareManager = shareManager;
	}

	/**
	 * Setup captions button styling
	 */
	setupCaptionsButton() {
		const captionsButton = this.player.el().querySelector( '.vjs-subs-caps-button' );
		const durationElement = this.player.el().querySelector( '.vjs-duration' );

		if ( captionsButton?.classList.contains( 'vjs-hidden' ) && durationElement ) {
			durationElement.classList.add( 'right-80' );
		}
	}

	/**
	 * Initialize chapters
	 */
	initializeChapters() {
		this.chaptersData = this.getChaptersData();
		if ( this.chaptersData?.length > 0 ) {
			this.processChaptersData( this.chaptersData );
		}
	}

	/**
	 * Get chapters data from video options
	 */
	getChaptersData() {
		const chapters = this.videoSetupOptions?.chapters;

		if ( ! Array.isArray( chapters ) || chapters.length === 0 ) {
			return [];
		}

		const seenTimes = new Set();

		// Filter out invalid entries
		const filteredChapters = chapters.filter( ( chapter ) => {
			const time = parseFloat( chapter.startTime );

			if ( ! chapter.startTime || isNaN( time ) || time < 0 || seenTimes.has( time ) ) {
				return false;
			}

			seenTimes.add( time );
			return true;
		} );

		// Convert to required format
		return filteredChapters.map( ( chapter ) => ( {
			startTime: parseFloat( chapter.startTime ) || 0,
			text: chapter.text || __( 'Chapter', 'godam' ),
			originalTime: chapter.originalTime,
			endTime: null,
		} ) );
	}

	/**
	 * Process chapters data
	 *
	 * @param {string} chaptersData - JSON string containing chapters data
	 */
	processChaptersData( chaptersData ) {
		// Sort chapters by start time
		chaptersData.sort( ( a, b ) => a.startTime - b.startTime );

		// Calculate end times
		chaptersData.forEach( ( chapter, index ) => {
			if ( index < chaptersData.length - 1 ) {
				chapter.endTime = chaptersData[ index + 1 ].startTime;
			} else {
				chapter.endTime = null; // Will be set to video duration when available
			}
		} );

		// Load chapters using the chapters.js module
		loadChapters( this.player, chaptersData );
	}

	/**
	 * Setup event listeners
	 */
	setupEventListeners() {
		this.setupVideoResize();
		this.setupPreviewHandlers();
		this.setupOverlayHandler();
		this.setupPlayerEvents();
		this.setupLayers();
		this.setupAdsIntegration();
	}

	/**
	 * Move video controls based on player skin
	 */
	moveVideoControls() {
		try {
			const playerElement = this.player.el_;
			const newHeight = playerElement.offsetHeight;
			const newWidth = playerElement.offsetWidth;

			const skipButtons = playerElement.querySelectorAll(
				'.vjs-skip-backward-5, .vjs-skip-backward-10, .vjs-skip-backward-30, .vjs-skip-forward-5, .vjs-skip-forward-10, .vjs-skip-forward-30',
			);

			const playButton = playerElement.querySelector( '.vjs-play-control' );

			if ( this.videoSetupOptions?.playerSkin === PLAYER_SKINS.PILLS ) {
				this.setupPillsControlLayout( playerElement, playButton, skipButtons, newWidth, newHeight );
			} else {
				this.setupStandardControlLayout( playButton, skipButtons, newWidth, newHeight );
			}
		} catch {
			// Silently fail
		}
	}

	/**
	 * Setup Pills control layout
	 *
	 * @param {HTMLElement} playerElement - Player element
	 * @param {HTMLElement} playButton    - Play button element
	 * @param {Array}       skipButtons   - Array of skip button elements
	 * @param {number}      newWidth      - New width value
	 * @param {number}      newHeight     - New height value
	 */
	setupPillsControlLayout( playerElement, playButton, skipButtons, newWidth, newHeight ) {
		let controlWrapper = playerElement.querySelector( '.godam-central-controls' );

		if ( ! controlWrapper ) {
			controlWrapper = document.createElement( 'div' );
			controlWrapper.className = 'godam-central-controls';
			playButton.parentNode.insertBefore( controlWrapper, playButton );

			// Move controls into wrapper
			const skipBack = playerElement.querySelectorAll(
				'.vjs-skip-backward-5, .vjs-skip-backward-10, .vjs-skip-backward-30',
			);
			const skipForward = playerElement.querySelectorAll(
				'.vjs-skip-forward-5, .vjs-skip-forward-10, .vjs-skip-forward-30',
			);

			skipBack.forEach( ( btn ) => controlWrapper.appendChild( btn ) );
			controlWrapper.appendChild( playButton );
			skipForward.forEach( ( btn ) => controlWrapper.appendChild( btn ) );
		}

		// Position the wrapper
		controlWrapper.style.position = 'absolute';
		controlWrapper.style.left = `${ newWidth / 4 }px`;
		controlWrapper.style.bottom = `${ ( newHeight / 2 ) - 15 }px`;
		controlWrapper.style.width = `${ ( newWidth / 2 ) - 15 }px`;
		playButton.style.setProperty( 'left', `${ ( newWidth / 4 ) - 28 }px` );
	}

	/**
	 * Setup standard control layout
	 *
	 * @param {HTMLElement} playButton  - Play button element
	 * @param {Array}       skipButtons - Array of skip button elements
	 * @param {number}      newWidth    - New width value
	 * @param {number}      newHeight   - New height value
	 */
	setupStandardControlLayout( playButton, skipButtons, newWidth, newHeight ) {
		if ( this.videoSetupOptions?.playerSkin === PLAYER_SKINS.MINIMAL ) {
			playButton.style.setProperty( 'bottom', `${ ( newHeight / 2 ) + 4 }px` );
			skipButtons.forEach( ( button ) => {
				button.style.setProperty( 'bottom', `${ ( newHeight / 2 ) - 5 }px` );
			} );
		}

		if ( this.videoSetupOptions?.playerSkin !== PLAYER_SKINS.DEFAULT ) {
			playButton.style.setProperty( 'bottom', `${ newHeight / 2 }px` );
			playButton.style.setProperty( 'left', `${ ( newWidth / 2 ) - 20 }px` );
		}

		if ( this.videoSetupOptions?.playerSkin !== PLAYER_SKINS.MINIMAL ) {
			skipButtons.forEach( ( button ) => {
				button.style.setProperty( 'bottom', `${ newHeight / 2 }px` );
			} );
		}
	}

	/**
	 * Setup video resize handling
	 */
	setupVideoResize() {
		this.handleVideoResize();
		this.player.on( 'resize', () => this.handleVideoResize() );
		window.addEventListener( 'resize', () => this.handleVideoResize() );
		this.player.on( 'fullscreenchange', () => this.handleVideoResize() );
	}

	/**
	 * Handle video resize events
	 */
	handleVideoResize() {
		// Skip if video is fullscreen or classic skin
		if ( ! this.player ||
			typeof this.player.isFullscreen !== 'function' ||
			this.videoSetupOptions?.playerSkin === PLAYER_SKINS.CLASSIC ) {
			return;
		}

		// Handle control bar positioning during fullscreen
		this.handleFullscreenControlBar();

		// Check container width constraint
		const videoContainer = this.video.closest( '.easydam-video-container' );
		if ( videoContainer?.offsetWidth > 480 ) {
			return;
		}

		// Apply debounce to avoid multiple calls
		this.debounceResize();
	}

	/**
	 * Handle control bar positioning in fullscreen
	 */
	handleFullscreenControlBar() {
		if ( this.videoSetupOptions?.playerSkin === PLAYER_SKINS.PILLS ) {
			const controlBarEl = this.player.controlBar?.el_;
			if ( controlBarEl ) {
				if ( this.player.isFullscreen() ) {
					controlBarEl.style.setProperty( 'position', 'absolute' );
					controlBarEl.style.setProperty( 'margin', '0 auto' );
				} else {
					controlBarEl.style.removeProperty( 'position' );
					controlBarEl.style.removeProperty( 'margin' );
				}
			}
		}
	}

	/**
	 * Debounce resize events
	 */
	debounceResize() {
		if ( this.handleVideoResize.timeout ) {
			clearTimeout( this.handleVideoResize.timeout );
		}
		this.handleVideoResize.timeout = setTimeout( () => {
			this.moveVideoControls();
		}, 100 );
	}

	/**
	 * Setup preview handlers
	 */
	setupPreviewHandlers() {
		if ( ! this.isPreviewEnabled ) {
			return;
		}

		this.setupPreviewWatcher();
		this.setupPreviewEventListeners();
	}

	/**
	 * Setup preview state watcher
	 */
	setupPreviewWatcher() {
		const self = this;
		const watcher = {
			set value( newValue ) {
				if ( self.isPreview !== newValue ) {
					self.isPreview = newValue;
					self.handlePreviewStateChange( newValue );
				}
			},
			get value() {
				return self.isPreview;
			},
		};

		this.previewWatcher = watcher;
	}

	/**
	 * Handle preview state changes
	 *
	 * @param {boolean} newValue - New preview state value
	 */
	handlePreviewStateChange( newValue ) {
		this.formLayers.forEach( ( layer ) => {
			if ( ! newValue ) {
				this.handleLayerDisplay( layer );
			}
		} );
	}

	/**
	 * Setup preview event listeners
	 */
	setupPreviewEventListeners() {
		this.video.addEventListener( 'click', () => this.handleVideoClick() );
		this.video.addEventListener( 'mouseenter', () => this.handleVideoMouseEnter() );
		this.video.addEventListener( 'mouseleave', ( e ) => this.handleVideoMouseLeave( e ) );
	}

	/**
	 * Handle video click for preview
	 */
	handleVideoClick() {
		this.isVideoClicked = true;
		this.clearPreviewTimeout();

		if ( this.previewWatcher.value ) {
			this.player.currentTime( 0 );
		}

		this.previewWatcher.value = false;
		this.removeControlBarHide();
		this.removeMuteButton();
	}

	/**
	 * Handle video mouse enter for preview
	 */
	handleVideoMouseEnter() {
		if ( this.video.currentTime > 0 || this.isVideoClicked ) {
			return;
		}

		this.startPreview();
		this.previewTimeoutId = setTimeout( () => {
			if ( this.previewWatcher.value && this.isPreviewEnabled ) {
				this.stopPreview();
				this.previewWatcher.value = false;
			}
		}, 10000 );
	}

	/**
	 * Handle video mouse leave for preview
	 *
	 * @param {Event} e - Mouse event object
	 */
	handleVideoMouseLeave( e ) {
		const relatedElement = e.relatedTarget || e.toElement;
		const hasEasydamPlayer = relatedElement?.parentElement?.className?.indexOf( 'easydam-player' ) !== -1;

		if ( ! this.previewWatcher.value || hasEasydamPlayer ) {
			return;
		}

		this.player.currentTime( 0 );
		this.player.pause();
		this.stopPreview();
	}

	/**
	 * Start preview mode
	 */
	startPreview() {
		this.player.volume( 0 );
		this.player.currentTime( 0 );

		const controlBarElement = this.player.controlBar.el();
		controlBarElement?.classList.add( 'hide' );

		this.previewWatcher.value = true;
		this.player.play();
	}

	/**
	 * Stop preview mode
	 */
	stopPreview() {
		this.removeControlBarHide();
		this.removeMuteButton();
		this.player.pause();
		this.player.currentTime( 0 );
	}

	/**
	 * Remove control bar hide class
	 */
	removeControlBarHide() {
		const controlBarElement = this.player.controlBar.el();
		controlBarElement?.classList.remove( 'hide' );
	}

	/**
	 * Remove mute button styling
	 */
	removeMuteButton() {
		const muteButton = document.querySelector( '.mute-button' );
		muteButton?.classList.remove( 'mute-button' );
	}

	/**
	 * Clear preview timeout
	 */
	clearPreviewTimeout() {
		if ( this.previewTimeoutId ) {
			clearTimeout( this.previewTimeoutId );
			this.previewTimeoutId = null;
		}
	}

	/**
	 * Setup overlay handler
	 */
	setupOverlayHandler() {
		const videoContainerWrapper = this.video.closest( '.godam-video-wrapper' );
		const overlay = videoContainerWrapper?.querySelector( '[data-overlay-content]' );

		if ( ! overlay ) {
			return;
		}

		const overlayTimeRange = this.videoSetupOptions?.overlayTimeRange || 0;
		let overlayHidden = false;

		const hideOverlay = () => {
			if ( overlayHidden ) {
				return;
			}
			overlayHidden = true;
			overlay.style.opacity = '0';
			setTimeout( () => {
				overlay.style.display = 'none';
			}, 300 );
		};

		if ( overlayTimeRange > 0 ) {
			this.player.on( 'timeupdate', () => {
				const currentTime = this.player.currentTime();
				if ( currentTime >= overlayTimeRange && ! overlayHidden ) {
					hideOverlay();
				}
			} );
		} else {
			let hasPlayedOnce = false;
			const hideOnFirstPlay = () => {
				if ( ! hasPlayedOnce ) {
					hasPlayedOnce = true;
					hideOverlay();
				}
			};
			this.player.one( 'play', hideOnFirstPlay );
		}
	}

	/**
	 * Setup player events
	 */
	setupPlayerEvents() {
		this.player.ready( () => this.setupPlayerConfiguration() );
		this.player.on( 'durationchange', () => this.handleDurationChange() );
		this.player.on( 'timeupdate', () => this.handleTimeUpdate() );
		this.player.on( 'fullscreenchange', () => this.handleFullscreenChange() );
		this.player.on( 'play', () => this.handlePlay() );
	}

	/**
	 * Setup player configuration
	 */
	setupPlayerConfiguration() {
		this.setupControlBarConfiguration();
		this.setupCustomButtons();
	}

	/**
	 * Handle duration change events
	 */
	handleDurationChange() {
		const duration = this.player.duration();
		if ( ! duration || duration === Infinity || ! this.chaptersData?.length ) {
			return;
		}

		// Filter chapters beyond duration
		this.chaptersData = this.chaptersData.filter( ( ch ) => ch.startTime < duration );

		// Set endTime for the last valid chapter
		if ( this.chaptersData.length > 0 ) {
			this.chaptersData[ this.chaptersData.length - 1 ].endTime = duration;
			createChapterMarkers( this.player, this.chaptersData );
		}
	}

	/**
	 * Handle time update events
	 */
	handleTimeUpdate() {
		const currentTime = this.player.currentTime();

		// Update chapters
		if ( this.chaptersData?.length > 0 ) {
			updateActiveChapter( currentTime, this.chaptersData );
		}

		// Handle form layers
		this.handleFormLayersTimeUpdate( currentTime );

		// Handle hotspot layers
		this.handleHotspotLayersTimeUpdate( currentTime );
	}

	/**
	 * Handle form layers time update
	 *
	 * @param {number} currentTime - Current video time in seconds
	 */
	handleFormLayersTimeUpdate( currentTime ) {
		if ( this.isDisplayingLayers[ this.currentPlayerVideoInstanceId ] ||
			this.currentFormLayerIndex >= this.formLayers.length ) {
			return;
		}

		const layerObj = this.formLayers[ this.currentFormLayerIndex ];

		if ( layerObj.show &&
			currentTime >= layerObj.displayTime &&
			layerObj.layerElement.classList.contains( 'hidden' ) ) {
			layerObj.layerElement.classList.remove( 'hidden' );
			this.player.pause();
			this.player.controls( false );
			this.isDisplayingLayers[ this.currentPlayerVideoInstanceId ] = true;
		}
	}

	/**
	 * Handle hotspot layers time update
	 *
	 * @param {number} currentTime - Current video time in seconds
	 */
	handleHotspotLayersTimeUpdate( currentTime ) {
		this.hotspotLayers.forEach( ( layerObj ) => {
			if ( ! layerObj.show ) {
				return;
			}

			const endTime = layerObj.displayTime + layerObj.duration;
			const isActive = currentTime >= layerObj.displayTime && currentTime < endTime;

			if ( isActive ) {
				if ( layerObj.layerElement.classList.contains( 'hidden' ) ) {
					layerObj.layerElement.classList.remove( 'hidden' );
					if ( ! layerObj.layerElement.dataset?.hotspotsInitialized ) {
						this.createHotspots( layerObj );
						layerObj.layerElement.dataset.hotspotsInitialized = true;
					}
				}
			} else if ( ! layerObj.layerElement.classList.contains( 'hidden' ) ) {
				layerObj.layerElement.classList.add( 'hidden' );
			}
		} );
	}

	/**
	 * Setup control bar configuration
	 */
	setupControlBarConfiguration() {
		const controlBarSettings = this.videoSetupControls?.controlBar;

		this.setupPlayButtonPosition( controlBarSettings );
		this.setupControlBarComponents( controlBarSettings );
		this.setupCustomPlayButton( controlBarSettings );
	}

	/**
	 * Setup play button position
	 *
	 * @param {Object} controlBarSettings - Control bar settings object
	 */
	setupPlayButtonPosition( controlBarSettings ) {
		const playButton = this.player.getChild( 'bigPlayButton' );
		const alignments = [
			'left-align',
			'center-align',
			'right-align',
			'top-align',
			'bottom-align',
		];

		playButton.removeClass( ...alignments );

		const position = controlBarSettings?.playButtonPosition;
		if ( position && alignments.includes( `${ position }-align` ) ) {
			playButton.addClass( `${ position }-align` );
		}
	}

	/**
	 * Setup control bar components
	 *
	 * @param {Object} controlBarSettings - Control bar settings object
	 */
	setupControlBarComponents( controlBarSettings ) {
		const controlBar = this.player.controlBar;

		if ( ! controlBarSettings?.volumePanel ) {
			controlBar.removeChild( 'volumePanel' );
		}

		this.setupSettingsButton( controlBar );
	}

	/**
	 * Setup settings button
	 *
	 * @param {Object} controlBar - VideoJS control bar component
	 */
	setupSettingsButton( controlBar ) {
		if ( ! controlBar.getChild( 'SettingsButton' ) ) {
			if ( ! videojs.getComponent( 'SettingsButton' ) ) {
				videojs.registerComponent( 'SettingsButton', SettingsButton );
			}
			controlBar.addChild( 'SettingsButton', {} );
		}

		document.querySelectorAll( '.vjs-settings-button' ).forEach( ( button ) => {
			const icon = button.querySelector( '.vjs-icon-placeholder' );
			icon?.classList.add( 'vjs-icon-cog' );
		} );
	}

	/**
	 * Setup custom play button
	 *
	 * @param {Object} controlBarSettings - Control bar settings object
	 */
	setupCustomPlayButton( controlBarSettings ) {
		if ( ! controlBarSettings?.customPlayBtnImg ) {
			return;
		}

		const playButtonElement = this.player.getChild( 'bigPlayButton' );
		const imgElement = document.createElement( 'img' );

		imgElement.src = controlBarSettings.customPlayBtnImg;
		imgElement.alt = __( 'Custom Play Button', 'godam' );
		imgElement.style.cursor = 'pointer';

		// Copy classes from original button
		playButtonElement.el_.classList.forEach( ( cls ) => {
			imgElement.classList.add( cls );
		} );
		imgElement.classList.add( 'custom-play-image' );

		// Add click handler
		imgElement.addEventListener( 'click', () => {
			const videoPlayer = imgElement.closest( '.easydam-player' );
			const videoElement = videoPlayer?.querySelector( 'video' );
			videoElement?.play();
		} );

		// Replace the original button
		playButtonElement.el_.parentNode.replaceChild( imgElement, playButtonElement.el_ );
	}

	/**
	 * Setup custom buttons
	 */
	setupCustomButtons() {
		const controlBarSettings = this.videoSetupControls?.controlBar;

		if ( controlBarSettings?.brandingIcon || ! window?.godamAPIKeyData?.validApiKey ) {
			this.setupBrandingButton( controlBarSettings );
		}
	}

	/**
	 * Setup branding button
	 *
	 * @param {Object} controlBarSettings - Control bar settings object
	 */
	setupBrandingButton( controlBarSettings ) {
		const CustomPlayButton = videojs.getComponent( 'Button' );
		const controlBar = this.player.controlBar;

		class CustomButton extends CustomPlayButton {
			constructor( p, options ) {
				super( p, options );
				this.controlText( __( 'Branding', 'godam' ) );
			}

			createEl() {
				const el = super.createEl();
				el.className += ' vjs-custom-play-button';
				const img = document.createElement( 'img' );

				if ( controlBarSettings?.customBrandImg?.length ) {
					img.src = controlBarSettings.customBrandImg;
				} else if ( window.godamSettings?.brandImage ) {
					img.src = window.godamSettings.brandImage;
				} else {
					img.src = GoDAM;
				}

				img.id = 'branding-icon';
				img.alt = __( 'Branding', 'godam' );
				img.className = 'branding-icon';
				el.appendChild( img );
				return el;
			}

			handleClick( event ) {
				event.preventDefault();
			}
		}

		if ( ! controlBar.getChild( 'CustomButton' ) ) {
			if ( ! videojs.getComponent( 'CustomButton' ) ) {
				videojs.registerComponent( 'CustomButton', CustomButton );
			}
			controlBar.addChild( 'CustomButton', {} );
		}
	}

	/**
	 * Handle fullscreen changes
	 */
	handleFullscreenChange() {
		const isFullscreen = this.player.isFullscreen();
		const videoContainer = this.player.el();

		this.formLayers.forEach( ( layerObj ) => {
			if ( isFullscreen ) {
				videoContainer.appendChild( layerObj.layerElement );
				layerObj.layerElement.classList.add( 'fullscreen-layer' );
			} else {
				layerObj.layerElement.classList.remove( 'fullscreen-layer' );
			}
		} );

		this.hotspotLayers.forEach( ( layerObj ) => {
			if ( isFullscreen && ! videoContainer.contains( layerObj.layerElement ) ) {
				videoContainer.appendChild( layerObj.layerElement );
			}
		} );

		this.updateHotspotPositions();
	}

	/**
	 * Handle play events
	 */
	handlePlay() {
		const isAnyLayerVisible = this.formLayers.some(
			( layerObj ) => ! layerObj.layerElement.classList.contains( 'hidden' ) && layerObj.show,
		);

		if ( isAnyLayerVisible ) {
			this.player.pause();
		}
	}

	/**
	 * Setup layers
	 */
	setupLayers() {
		const layers = this.videoSetupOptions?.layers || [];

		if ( ! this.isPreviewEnabled ) {
			layers.forEach( ( layer ) => this.processLayer( layer ) );
		}

		this.formLayers.sort( ( a, b ) => a.displayTime - b.displayTime );
		this.currentFormLayerIndex = 0;
		this.isDisplayingLayers[ this.currentPlayerVideoInstanceId ] = false;
	}

	/**
	 * Process individual layer
	 *
	 * @param {Object} layer - Layer configuration object
	 */
	processLayer( layer ) {
		const shouldProcess = this.shouldProcessLayer( layer );

		if ( shouldProcess ) {
			this.handleLayerDisplay( layer );
		}
	}

	/**
	 * Check if layer should be processed based on dependencies
	 *
	 * @param {Object} layer - Layer configuration object
	 * @return {boolean} True if layer should be processed
	 */
	shouldProcessLayer( layer ) {
		const dependencies = window.godamPluginDependencies;

		const layerTypeChecks = {
			[ LAYER_TYPES.FORM ]: () => this.checkFormDependency( layer.form_type, dependencies ),
			[ LAYER_TYPES.POLL ]: () => dependencies?.wpPolls,
			[ LAYER_TYPES.CTA ]: () => true,
			[ LAYER_TYPES.HOTSPOT ]: () => true,
		};

		const checker = layerTypeChecks[ layer.type ];
		return checker ? checker() : true;
	}

	/**
	 * Check form dependency
	 *
	 * @param {string} formType     - Type of form to check
	 * @param {Array}  dependencies - Array of dependency objects
	 * @return {boolean} True if form dependency is satisfied
	 */
	checkFormDependency( formType, dependencies ) {
		const formChecks = {
			[ FORM_TYPES.GRAVITY ]: dependencies?.gravityforms,
			[ FORM_TYPES.WPFORMS ]: dependencies?.wpforms,
			[ FORM_TYPES.EVEREST ]: dependencies?.everestForms,
			[ FORM_TYPES.CF7 ]: dependencies?.cf7,
			[ FORM_TYPES.JETPACK ]: dependencies?.jetpack,
			[ FORM_TYPES.SUREFORMS ]: dependencies?.sureforms,
			[ FORM_TYPES.FORMINATOR ]: dependencies?.forminator,
			[ FORM_TYPES.FLUENT ]: dependencies?.fluentForms,
			[ FORM_TYPES.NINJA ]: dependencies?.ninjaForms,
		};

		return formChecks[ formType ] || false;
	}

	/**
	 * Handle layer display setup
	 *
	 * @param {Object} layer - Layer configuration object
	 */
	handleLayerDisplay( layer ) {
		const instanceId = this.video.dataset.instanceId;
		const layerId = `layer-${ instanceId }-${ layer.id }`;
		const layerElement = document.querySelector( `#${ layerId }` );

		if ( ! layerElement ) {
			return;
		}

		this.setupLayerEnvironment();
		layerElement.classList.add( 'hidden' );

		if ( this.isFormOrCTAOrPoll( layer.type ) ) {
			this.setupFormLayer( layer, layerElement );
		} else if ( layer.type === LAYER_TYPES.HOTSPOT ) {
			this.setupHotspotLayer( layer, layerElement );
		}
	}

	/**
	 * Setup layer environment
	 */
	setupLayerEnvironment() {
		if ( typeof window.wpforms !== 'undefined' ) {
			window.wpforms.scrollToError = () => {};
			window.wpforms.animateScrollTop = () => {};
		}
	}

	/**
	 * Check if layer is form, CTA, or poll
	 *
	 * @param {string} layerType - Type of layer to check
	 * @return {boolean} True if layer is form-based
	 */
	isFormOrCTAOrPoll( layerType ) {
		return [ LAYER_TYPES.FORM, LAYER_TYPES.CTA, LAYER_TYPES.POLL ].includes( layerType );
	}

	/**
	 * Setup form layer
	 *
	 * @param {Object}      layer        - Layer configuration object
	 * @param {HTMLElement} layerElement - Layer DOM element
	 */
	setupFormLayer( layer, layerElement ) {
		if ( layer.custom_css ) {
			const styleElement = document.createElement( 'style' );
			styleElement.textContent = layer.custom_css;
			layerElement.appendChild( styleElement );
		}

		const skipText = this.getSkipText( layer.type );
		const allowSkip = layer.allow_skip !== undefined ? layer.allow_skip : true;

		const existingLayer = this.formLayers.some(
			( existingLayerObj ) => existingLayerObj.layerElement === layerElement,
		);

		if ( ! existingLayer ) {
			const layerObj = {
				layerElement,
				displayTime: parseFloat( layer.displayTime ),
				show: true,
				allowSkip,
				skipText,
			};

			this.formLayers.push( layerObj );
			this.setupFormLayerSkipButton( layerObj );
		}
	}

	/**
	 * Get skip text based on layer type
	 *
	 * @param {string} layerType - Type of layer
	 * @return {string} Skip button text
	 */
	getSkipText( layerType ) {
		const skipTexts = {
			[ LAYER_TYPES.FORM ]: __( 'Skip Form', 'godam' ),
			[ LAYER_TYPES.CTA ]: __( 'Skip', 'godam' ),
			[ LAYER_TYPES.POLL ]: __( 'Skip Poll', 'godam' ),
		};

		return skipTexts[ layerType ] || __( 'Skip', 'godam' );
	}

	/**
	 * Setup hotspot layer
	 *
	 * @param {Object}      layer        - Layer configuration object
	 * @param {HTMLElement} layerElement - Layer DOM element
	 */
	setupHotspotLayer( layer, layerElement ) {
		const layerObj = {
			layerElement,
			displayTime: parseFloat( layer.displayTime ),
			duration: layer.duration ? parseInt( layer.duration ) : 0,
			show: true,
			hotspots: layer.hotspots || [],
			pauseOnHover: layer.pauseOnHover || false,
		};

		this.hotspotLayers.push( layerObj );
	}

	/**
	 * Setup form layer skip button
	 *
	 * @param {Object} layerObj - Layer object containing element and configuration
	 */
	setupFormLayerSkipButton( layerObj ) {
		let skipButton = layerObj.layerElement.querySelector( '.skip-button' );

		if ( ! skipButton ) {
			skipButton = this.createSkipButton( layerObj.skipText );
		}

		if ( ! layerObj.allowSkip ) {
			skipButton.classList.add( 'hidden' );
		}

		this.setupFormObserver( layerObj, skipButton );
		this.setupSkipButtonHandler( layerObj, skipButton );

		layerObj.layerElement.appendChild( skipButton );
	}

	/**
	 * Create skip button
	 *
	 * @param {string} skipText - Text to display on the skip button
	 * @return {HTMLElement} Created skip button element
	 */
	createSkipButton( skipText ) {
		const skipButton = document.createElement( 'button' );
		skipButton.textContent = skipText;
		skipButton.classList.add( 'skip-button' );

		const arrowIcon = document.createElement( 'i' );
		arrowIcon.className = 'fa-solid fa-chevron-right';
		skipButton.appendChild( arrowIcon );

		return skipButton;
	}

	/**
	 * Setup form observer for confirmation messages
	 *
	 * @param {Object}      layerObj   - Layer object containing element and configuration
	 * @param {HTMLElement} skipButton - Skip button element
	 */
	setupFormObserver( layerObj, skipButton ) {
		const observer = new MutationObserver( () => {
			if ( this.hasConfirmationMessage( layerObj.layerElement ) ) {
				skipButton.textContent = __( 'Continue', 'godam' );
				skipButton.classList.remove( 'hidden' );
				observer.disconnect();
			}
		} );

		observer.observe( layerObj.layerElement, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: [ 'class' ],
		} );
	}

	/**
	 * Check for confirmation messages in various form types
	 *
	 * @param {HTMLElement} element - Form element to check for confirmation messages
	 * @return {boolean} True if confirmation message is found
	 */
	hasConfirmationMessage( element ) {
		const confirmationSelectors = [
			'.gform_confirmation_message',
			'.wpforms-confirmation-container-full',
			'form.wpcf7-form.sent',
			'.srfm-success-box.srfm-active',
			'.ff-message-success',
			'.contact-form-success',
			'.forminator-success.forminator-show',
			'.everest-forms-notice--success',
		];

		// Check for standard selectors
		if ( confirmationSelectors.some( ( selector ) => element.querySelector( selector ) ) ) {
			return true;
		}

		// Special cases
		const wpPollsForm = element.querySelector( '.wp-polls-form' );
		const wpPollsAnswer = element.querySelector( '.wp-polls-answer' );
		if ( ! wpPollsForm && wpPollsAnswer ) {
			return true;
		}

		const nfResponse = element.querySelector( '.nf-response-msg' );
		if ( nfResponse && nfResponse.innerHTML !== '' ) {
			return true;
		}

		return false;
	}

	/**
	 * Setup skip button click handler
	 *
	 * @param {Object}      layerObj   - Layer object containing element and configuration
	 * @param {HTMLElement} skipButton - Skip button element
	 */
	setupSkipButtonHandler( layerObj, skipButton ) {
		skipButton.addEventListener( 'click', () => {
			layerObj.show = false;
			layerObj.layerElement.classList.add( 'hidden' );
			this.player.controls( true );
			this.player.play();
			this.isDisplayingLayers[ this.currentPlayerVideoInstanceId ] = false;

			if ( layerObj === this.formLayers[ this.currentFormLayerIndex ] ) {
				this.currentFormLayerIndex++;
			}
		} );
	}

	/**
	 * Setup ads integration
	 */
	setupAdsIntegration() {
		if ( this.adTagUrl ) {
			this.player.ima( {
				id: 'content_video',
				adTagUrl: this.adTagUrl,
			} );
		} else if ( this.globalAdsSettings?.enable_global_video_ads && this.globalAdsSettings?.adTagUrl ) {
			this.player.ima( {
				id: 'content_video',
				adTagUrl: this.globalAdsSettings.adTagUrl,
			} );
		}
	}

	/**
	 * Create hotspots for a layer
	 *
	 * @param {Object} layerObj - Layer object containing hotspots and configuration
	 */
	createHotspots( layerObj ) {
		const videoContainer = this.player.el();
		const containerWidth = videoContainer?.offsetWidth;
		const containerHeight = videoContainer?.offsetHeight;

		const baseWidth = 800;
		const baseHeight = 600;

		layerObj.hotspots.forEach( ( hotspot, index ) => {
			const hotspotDiv = this.createHotspotElement( hotspot, index, containerWidth, containerHeight, baseWidth, baseHeight );

			if ( layerObj.pauseOnHover ) {
				this.setupHotspotHoverEvents( hotspotDiv );
			}

			layerObj.layerElement.appendChild( hotspotDiv );

			const tooltipDiv = hotspotDiv.querySelector( '.hotspot-tooltip' );
			if ( tooltipDiv ) {
				requestAnimationFrame( () => {
					this.positionTooltip( hotspotDiv, tooltipDiv );
				} );
			}
		} );
	}

	/**
	 * Create hotspot element
	 *
	 * @param {Object} hotspot         - Hotspot configuration object
	 * @param {number} index           - Index of the hotspot
	 * @param {number} containerWidth  - Width of the video container
	 * @param {number} containerHeight - Height of the video container
	 * @param {number} baseWidth       - Base width for calculations
	 * @param {number} baseHeight      - Base height for calculations
	 * @return {HTMLElement} Created hotspot element
	 */
	createHotspotElement( hotspot, index, containerWidth, containerHeight, baseWidth, baseHeight ) {
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
		const fallbackDiameter = hotspot.oSize?.diameter ?? hotspot.size?.diameter ?? 48;
		const pixelDiameter = ( fallbackDiameter / baseWidth ) * containerWidth;
		hotspotDiv.style.width = `${ pixelDiameter }px`;
		hotspotDiv.style.height = `${ pixelDiameter }px`;

		// Background color
		hotspotDiv.style.backgroundColor = hotspot.icon ? 'white' : ( hotspot.backgroundColor || '#0c80dfa6' );

		// Create content
		const hotspotContent = this.createHotspotContent( hotspot, index );
		hotspotDiv.appendChild( hotspotContent );

		return hotspotDiv;
	}

	/**
	 * Create hotspot content
	 *
	 * @param {Object} hotspot - Hotspot configuration object
	 * @param {number} index   - Index of the hotspot
	 * @return {HTMLElement} Created content element
	 */
	createHotspotContent( hotspot, index ) {
		const hotspotContent = document.createElement( 'div' );
		hotspotContent.classList.add( 'hotspot-content' );
		hotspotContent.style.position = 'relative';
		hotspotContent.style.width = '100%';
		hotspotContent.style.height = '100%';

		if ( hotspot.icon ) {
			const iconEl = this.createHotspotIcon( hotspot.icon );
			hotspotContent.appendChild( iconEl );
		} else {
			hotspotContent.classList.add( 'no-icon' );
		}

		const tooltipDiv = this.createHotspotTooltip( hotspot, index );
		hotspotContent.appendChild( tooltipDiv );

		return hotspotContent;
	}

	/**
	 * Create hotspot icon
	 *
	 * @param {string} icon - Icon configuration or path
	 * @return {HTMLElement} Created icon element
	 */
	createHotspotIcon( icon ) {
		const iconEl = document.createElement( 'i' );
		iconEl.className = `fa-solid fa-${ icon }`;
		iconEl.style.width = '50%';
		iconEl.style.height = '50%';
		iconEl.style.fontSize = '1.6em';
		iconEl.style.display = 'flex';
		iconEl.style.alignItems = 'center';
		iconEl.style.justifyContent = 'center';
		iconEl.style.margin = 'auto';
		iconEl.style.color = '#000';

		return iconEl;
	}

	/**
	 * Create hotspot tooltip
	 *
	 * @param {Object} hotspot - Hotspot configuration object
	 * @param {number} index   - Index of the hotspot
	 * @return {HTMLElement} Created tooltip element
	 */
	createHotspotTooltip( hotspot, index ) {
		const tooltipDiv = document.createElement( 'div' );
		tooltipDiv.classList.add( 'hotspot-tooltip' );
		/* translators: %d: hotspot number */
		tooltipDiv.textContent = hotspot.tooltipText || sprintf( __( 'Hotspot %d', 'godam' ), index + 1 );

		if ( hotspot.link ) {
			const hotspotLink = document.createElement( 'a' );
			hotspotLink.href = hotspot.link;
			hotspotLink.target = '_blank';
			/* translators: %d: hotspot number */
			hotspotLink.textContent = hotspot.tooltipText || sprintf( __( 'Hotspot %d', 'godam' ), index + 1 );
			tooltipDiv.textContent = '';
			tooltipDiv.appendChild( hotspotLink );
		}

		return tooltipDiv;
	}

	/**
	 * Setup hotspot hover events
	 *
	 * @param {HTMLElement} hotspotDiv - The hotspot element to add hover events to
	 */
	setupHotspotHoverEvents( hotspotDiv ) {
		hotspotDiv.addEventListener( 'mouseenter', () => {
			this.wasPlayingBeforeHover = ! this.player.paused();
			this.player.pause();
		} );

		hotspotDiv.addEventListener( 'mouseleave', () => {
			if ( this.wasPlayingBeforeHover ) {
				this.player.play();
			}
		} );
	}

	/**
	 * Position tooltip relative to hotspot
	 *
	 * @param {HTMLElement} hotspotDiv - The hotspot element for positioning reference
	 * @param {HTMLElement} tooltipDiv - The tooltip element to position
	 */
	positionTooltip( hotspotDiv, tooltipDiv ) {
		const hotspotRect = hotspotDiv.getBoundingClientRect();
		const tooltipRect = tooltipDiv.getBoundingClientRect();
		const viewportWidth = window.innerWidth;

		// Vertical positioning
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

		// Horizontal positioning
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
			tooltipDiv.classList.remove( 'tooltip-left', 'tooltip-right', 'no-arrow' );
		}
	}

	/**
	 * Update hotspot positions on resize
	 */
	updateHotspotPositions() {
		const videoContainer = this.player.el();
		const containerWidth = videoContainer?.offsetWidth;
		const containerHeight = videoContainer?.offsetHeight;

		const baseWidth = 800;
		const baseHeight = 600;

		this.hotspotLayers.forEach( ( layerObj ) => {
			const hotspotDivs = layerObj.layerElement.querySelectorAll( '.hotspot' );
			hotspotDivs.forEach( ( hotspotDiv, index ) => {
				const hotspot = layerObj.hotspots[ index ];

				// Recalc position
				const fallbackPosX = hotspot.oPosition?.x ?? hotspot.position.x;
				const fallbackPosY = hotspot.oPosition?.y ?? hotspot.position.y;
				const pixelX = ( fallbackPosX / baseWidth ) * containerWidth;
				const pixelY = ( fallbackPosY / baseHeight ) * containerHeight;
				hotspotDiv.style.left = `${ pixelX }px`;
				hotspotDiv.style.top = `${ pixelY }px`;

				// Recalc size
				const fallbackDiameter = hotspot.oSize?.diameter ?? hotspot.size?.diameter ?? 48;
				const pixelDiameter = ( fallbackDiameter / baseWidth ) * containerWidth;
				hotspotDiv.style.width = `${ pixelDiameter }px`;
				hotspotDiv.style.height = `${ pixelDiameter }px`;

				const tooltipDiv = hotspotDiv.querySelector( '.hotspot-tooltip' );
				if ( tooltipDiv ) {
					requestAnimationFrame( () => {
						this.positionTooltip( hotspotDiv, tooltipDiv );
					} );
				}
			} );
		} );
	}
}
