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

			// Now that managers are initialized, we can safely access them
			this.setupEventListeners();
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

		// Initialize ads manager
		this.adsManager = new AdsManager( this.player, this.configManager );

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
		this.adsManager?.setupAdsIntegration();
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
}
