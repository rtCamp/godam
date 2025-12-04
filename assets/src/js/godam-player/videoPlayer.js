/**
 * External dependencies
 */
import videojs from 'video.js';

/**
 * Internal dependencies
 */
import ConfigurationManager from './managers/configurationManager.js';
import ControlsManager from './managers/controlsManager.js';
import PreviewManager from './managers/previewManager.js';
import LayersManager from './managers/layersManager.js';
import EventsManager from './managers/eventsManager.js';
import ChaptersManager from './managers/chaptersManager.js';
import AdsManager from './managers/adsManager.js';
import HoverManager from './managers/hoverManager.js';
import ShareManager from './managers/shareManager.js';
import MenuButtonHoverManager from './managers/menuButtonHover.js';

/**
 * Refactored Video Player Class
 * Main orchestrator that coordinates between different managers
 */
export default class GodamVideoPlayer {
	constructor( video, isDisplayingLayers ) {
		this.video = video;
		this.isDisplayingLayers = isDisplayingLayers;
		this.currentPlayerVideoInstanceId = video.dataset.instanceId;
		this.player = null;

		// Initialize managers
		this.configManager = new ConfigurationManager( video );
		this.controlsManager = null;
		this.previewManager = null;
		this.layersManager = null;
		this.eventsManager = null;
		this.chaptersManager = null;
		this.adsManager = null;
		this.hoverManager = null;
		this.shareManager = null;
	}

	/**
	 * Initialize the video player
	 */
	initialize() {
		this.setupVideoElement();
		this.initializePlayer();
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
		this.player = videojs( this.video, this.configManager.videoSetupControls );

		// Initialize ads manager
		this.adsManager = new AdsManager( this.player, this.configManager );
		this.adsManager?.setupAdsIntegration();

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
			this.setupQualitySelector();

			// Now that managers are initialized, we can safely access them
			this.setupEventListeners();
			new MenuButtonHoverManager( this.player );

			// Emit custom event for external developers
			const playerReadyEvent = new CustomEvent( 'godamPlayerReady', {
				detail: {
					attachmentId: this.video.dataset.id,
					videoElement: this.video,
					player: this.player,
				},
			} );
			document.dispatchEvent( playerReadyEvent );
		} );
	}

	/**
	 * Handle aspect ratio setup for non-modal players
	 */
	handleAspectRatioSetup() {
		const isInModal = this.video.closest( '.godam-modal' ) !== null;

		const currentAspectRatio = this.configManager.videoSetupOptions?.aspectRatio || '16:9';

		if ( ! isInModal ) {
			if ( currentAspectRatio === 'responsive' ) {
				// Add a flag to prevent multiple executions.
				const aspectRatioHandled = false;

				const handleResponsiveAspectRatio = () => {
					if ( aspectRatioHandled ) {
						return; // Prevent multiple executions.
					}

					const width = this.video?.videoWidth;
					const height = this.video?.videoHeight;

					function getSimplifiedAspectRatio( w, h ) {
						const gcd = ( a, b ) => ( b === 0 ? a : gcd( b, a % b ) );
						const divisor = gcd( w, h );
						return ( w / divisor ) + ':' + ( h / divisor );
					}

					// Check if dimensions are valid.
					if ( ! width || ! height || width === 0 || height === 0 ) {
						// Try to get dimensions from the player.
						const playerWidth = this.player.videoWidth();
						const playerHeight = this.player.videoHeight();

						if ( playerWidth && playerHeight && playerWidth > 0 && playerHeight > 0 ) {
							const aspectRatio = getSimplifiedAspectRatio( playerWidth, playerHeight );

							// Apply the aspect ratio logic here.
							const aspectRatioOrientation = {
								'1:1': 'landscape',
								'4:3': 'landscape',
								'3:2': 'landscape',
								'5:4': 'landscape',
								'16:9': 'landscape',
								'21:9': 'landscape',
								'9:16': 'portrait',
								'2:3': 'portrait',
								'3:4': 'portrait',
							};

							const aspectRatioClass = aspectRatioOrientation[ aspectRatio ];

							const godamProductModalContainer = document.querySelector( '.godam-product-modal-container.open' ) || document.querySelector( '.godam-woocommerce-featured-video-modal-container.open' );

							if ( godamProductModalContainer ) {
								const videoContainer = godamProductModalContainer.querySelector( '.video-container' );

								if ( videoContainer ) {
									videoContainer.classList.add( `is-${ aspectRatioClass ? aspectRatioClass : 'portrait' }` );
								}

								const sidebarContainer = godamProductModalContainer.querySelector( '.godam-product-sidebar' );
								if ( sidebarContainer ) {
									sidebarContainer.classList.add( `is-${ aspectRatioClass ? aspectRatioClass : 'portrait' }` );
								}
							}

							this.player.aspectRatio( aspectRatio );
							return;
						}

						// If still no valid dimensions, use a default aspect ratio.
						this.player.aspectRatio( '16:9' );
						return;
					}

					// Original logic for when dimensions are valid.
					const aspectRatio = getSimplifiedAspectRatio( width, height );

					const aspectRatioOrientation = {
						'1:1': 'landscape', // or "portrait" - square can go either way.
						'4:3': 'landscape',
						'3:2': 'landscape',
						'5:4': 'landscape',
						'16:9': 'landscape',
						'21:9': 'landscape',
						'9:16': 'portrait',
						'2:3': 'portrait',
						'3:4': 'portrait',
					};

					const aspectRatioClass = aspectRatioOrientation[ aspectRatio ];

					const godamProductModalContainer = document.querySelector( '.godam-product-modal-container.open' ) || document.querySelector( '.godam-woocommerce-featured-video-modal-container.open' );

					if ( godamProductModalContainer ) {
						const videoContainer = godamProductModalContainer.querySelector( '.video-container' );

						if ( videoContainer ) {
							videoContainer.classList.add( `is-${ aspectRatioClass ? aspectRatioClass : 'portrait' }` );
						}

						const sidebarContainer = godamProductModalContainer.querySelector( '.godam-product-sidebar' );
						if ( sidebarContainer ) {
							sidebarContainer.classList.add( `is-${ aspectRatioClass ? aspectRatioClass : 'portrait' }` );
						}
					}

					this.player.aspectRatio( aspectRatio );
				};

				// Add the event listener to both the video element and the player.
				this.video.addEventListener( 'loadedmetadata', handleResponsiveAspectRatio );
				this.player.on( 'loadedmetadata', handleResponsiveAspectRatio );

				// Also try other events that might fire on mobile.
				this.video.addEventListener( 'loadeddata', handleResponsiveAspectRatio );
				this.player.on( 'loadeddata', handleResponsiveAspectRatio );

				// Add a timeout to handle cases where loadedmetadata never fires.
				const timeoutId = setTimeout( () => {
					if ( ! aspectRatioHandled ) {
						handleResponsiveAspectRatio();
					}
				}, 5000 ); // 5 second timeout.

				// Clear timeout when metadata loads.
				const clearTimeoutOnMetadata = () => {
					clearTimeout( timeoutId );
					handleResponsiveAspectRatio();
				};

				this.video.addEventListener( 'loadedmetadata', clearTimeoutOnMetadata );
				this.player.on( 'loadedmetadata', clearTimeoutOnMetadata );
			} else {
				this.player.aspectRatio( currentAspectRatio );
			}
		} else {
			this.player.aspectRatio( currentAspectRatio );
		}
	}

	/**
	 * Initialize all managers
	 */
	initializeManagers() {
		// Initialize controls manager
		this.controlsManager = new ControlsManager( this.player, this.video, this.configManager );

		// Initialize preview manager
		this.previewManager = new PreviewManager( this.player, this.video, this.configManager );

		// Initialize layers manager
		this.layersManager = new LayersManager(
			this.player,
			this.video,
			this.configManager,
			this.isDisplayingLayers,
			this.currentPlayerVideoInstanceId,
		);

		// Initialize events manager
		this.eventsManager = new EventsManager( this.player, this.video, this.configManager );

		// Initialize chapters manager
		this.chaptersManager = new ChaptersManager( this.player, this.video );

		// Initialize hover and share managers (existing)
		this.hoverManager = new HoverManager( this.player, this.video );
		this.shareManager = new ShareManager( this.player, this.video, this.configManager.videoSetupOptions );

		// Set up cross-manager communication
		this.setupManagerCommunication();

		// Attach managers to player for external access
		this.player.hoverManager = this.hoverManager;
		this.player.shareManager = this.shareManager;
	}

	/**
	 * Setup communication between managers
	 */
	setupManagerCommunication() {
		// Set up event callbacks
		this.eventsManager.setEventCallbacks( {
			onPlayerConfigurationSetup: () => this.controlsManager.setupPlayerConfiguration(),
			onTimeUpdate: ( currentTime ) => this.handleTimeUpdate( currentTime ),
			onFullscreenChange: () => this.layersManager.handleFullscreenChange(),
			onPlay: () => this.layersManager.handlePlay(),
			onControlsMove: () => this.controlsManager.moveVideoControls(),
		} );

		// Set up preview state change callback
		if ( this.previewManager.getPreviewWatcher() ) {
			this.previewManager.setPreviewStateChangeCallback(
				( newValue ) => this.layersManager.handlePreviewStateChange( newValue ),
			);
		}
	}

	/**
	 * Setup captions button styling
	 */
	setupCaptionsButton() {
		this.controlsManager.setupCaptionsButton();
	}

	/**
	 * Initialize chapters
	 */
	initializeChapters() {
		this.chaptersManager.initialize();
	}

	/**
	 * Setup event listeners
	 */
	setupEventListeners() {
		this.eventsManager?.setupEventListeners();
		this.layersManager?.setupLayers();
	}

	/**
	 * Handle time update events (coordinating between managers)
	 *
	 * @param {number} currentTime - Current video time in seconds
	 */
	handleTimeUpdate( currentTime ) {
		// Handle form layers
		this.layersManager.handleFormLayersTimeUpdate( currentTime );

		// Handle hotspot layers
		this.layersManager.handleHotspotLayersTimeUpdate( currentTime );

		// Handle WooCommerce layers
		this.layersManager.handleWooCommerceLayersTimeUpdate( currentTime );
	}

	/**
	 * If quality selector button is not present, render it.
	 */
	renderQualitySelectorButton() {
		if ( this.player.qualityLevels && this.player.qualityLevels().length > 0 ) {
			// Avoid adding the button multiple times.
			if ( typeof this.player.hlsQualitySelector === 'function' ) {
				this.player.hlsQualitySelector();
			} else if ( typeof this.player.qualityMenuButton === 'function' ) {
				this.player.qualityMenuButton();
			}

			// Refresh control bar.
			this.player.controlBar.show();
			if ( this.player.qualityLevels ) {
				this.player.qualityLevels().trigger( 'change' );
			}
		}
	}

	/**
	 * Setup quality selector button in control bar.
	 */
	setupQualitySelector() {
		// Force load. Required.
		if ( this.player.readyState() === 0 ) {
			this.player.load();
		}

		// Try to render immediately.
		this.renderQualitySelectorButton();

		/**
		 * Check if quality button is already present.
		 * If not, wait for quality levels to be available and then render it.
		 */
		if ( ! this.hasQualitySelectorButton() ) {
			this.eventsManager.onQualityLevelsAvailable( () => this.renderQualitySelectorButton() );
		}
	}

	/**
	 * Check if quality button has been created
	 */
	hasQualitySelectorButton() {
		return !! ( this.player.controlBar.getChild( 'QualityMenuButton' ) || this.player.controlBar.getChild( 'SettingsButton' ) );
	}
}
