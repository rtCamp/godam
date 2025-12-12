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
import { loadFlvPlugin, requiresFlvPlugin, loadAdsPlugins } from './utils/pluginLoader.js';

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
	async initialize() {
		// Mark as initializing to prevent double initialization
		this.video.dataset.videojsInitializing = 'true';

		try {
			this.setupVideoElement();
			await this.loadRequiredPlugins();
			this.initializePlayer();
		} finally {
			// Remove initializing flag after initialization
			delete this.video.dataset.videojsInitializing;
			delete this.video.parentElement.dataset.videojsInitializing;
		}
	}

	/**
	 * Load required plugins based on video sources and configuration
	 * IMPORTANT: This must run BEFORE player initialization to avoid
	 * videojs-contrib-ads missing the loadstart event
	 */
	async loadRequiredPlugins() {
		const sources = this.configManager.videoSetupControls?.sources || [];

		// Check if ads are configured
		const needsAds = !! (
			this.configManager.adTagUrl ||
			( this.configManager.globalAdsSettings?.enable_global_video_ads &&
				this.configManager.globalAdsSettings?.adTagUrl )
		);

		// Check if FLV plugin is needed
		const needsFlv = sources.some( ( source ) => requiresFlvPlugin( source.src || source.type ) );

		// Load plugins in parallel
		const loadPromises = [];

		if ( needsAds ) {
			loadPromises.push(
				loadAdsPlugins().catch( ( error ) => {
					// eslint-disable-next-line no-console
					console.error( 'Failed to load ads plugins:', error );
				} ),
			);
		}

		if ( needsFlv ) {
			loadPromises.push(
				loadFlvPlugin().catch( ( error ) => {
					// eslint-disable-next-line no-console
					console.error( 'Failed to load FLV plugin:', error );
				} ),
			);
		}

		// Wait for all required plugins to load
		await Promise.all( loadPromises );
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
		// Check if player already exists (safety check)
		const existingPlayer = videojs.getPlayer( this.video );
		if ( existingPlayer ) {
			// Use existing player instance (should rarely happen with proper initialization guards)
			this.player = existingPlayer;
		} else {
			// Normal initialization path
			this.player = videojs( this.video, this.configManager.videoSetupControls );
		}

		// Initialize ads manager (async - loads plugins dynamically)
		this.adsManager = new AdsManager( this.player, this.configManager );
		this.adsManager?.setupAdsIntegration().catch( ( error ) => {
			// eslint-disable-next-line no-console
			console.error( 'Ads integration failed:', error );
		} );

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

		if ( ! isInModal ) {
			const aspectRatio = this.configManager.videoSetupOptions?.aspectRatio || '16:9';
			this.player.aspectRatio( aspectRatio );
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
	 * Handles async layer setup for FontAwesome loading
	 */
	setupEventListeners() {
		this.eventsManager?.setupEventListeners();

		// Setup layers asynchronously (loads FontAwesome if needed)
		this.layersManager?.setupLayers().catch( ( error ) => {
			// eslint-disable-next-line no-console
			console.error( 'Failed to setup layers:', error );
		} );
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
