/**
 * External dependencies
 */
import videojs from 'video.js';

/**
 * Internal dependencies
 */
// Initialize layer registry early so add-ons can register custom layers
import './utils/layer-registry-init.js';

import ConfigurationManager from './managers/configurationManager.js';
import ControlsManager from './managers/controlsManager.js';
import PreviewManager from './managers/previewManager.js';
import LayersManager from './managers/layersManager.js';
import EventsManager from './managers/eventsManager.js';
import AdsManager from './managers/adsManager.js';
import HoverManager from './managers/hoverManager.js';
import MenuButtonHoverManager from './managers/menuButtonHover.js';
import TranscriptManager from './managers/transcriptManager.js';
import { getVisibilityManager, resolveOutOfViewMode, resolvePauseOnTabHidden } from './managers/visibilityManager.js';
import { loadFlvPlugin, requiresFlvPlugin, loadAdsPlugins } from './utils/pluginLoader.js';
import { runWhenIdleOrPlay } from './utils/scheduling.js';

/**
 * Features a player only needs once it is on screen and about to play. Each is
 * its own chunk, downloaded the first time a video uses it.
 */
const loadChaptersManager = () =>
	import( /* webpackChunkName: "player-chapters" */ './managers/chaptersManager.js' );
const loadShareManager = () =>
	import( /* webpackChunkName: "player-share" */ './managers/shareManager.js' );
const loadTranscriptPanelManager = () =>
	import( /* webpackChunkName: "player-transcript-panel" */ './managers/transcriptPanelManager.js' );

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
		this.transcriptManager = null;
		this.transcriptPanelManager = null;
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
			if ( this.video.parentElement ) {
				delete this.video.parentElement.dataset.videojsInitializing;
			}
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
				// Ads are optional and loadAdsPlugins() already warns once when
				// the chunk is blocked (e.g. by an ad blocker). Swallow here so a
				// blocked ad script doesn't reject Promise.all and halt init.
				loadAdsPlugins().catch( () => {} ),
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

		const parentContainer = this.video.closest( '.godam-video-wrapper' );

		let placeholder, originalVideoContainer;

		if ( parentContainer ) {
			placeholder = parentContainer.querySelector( '.godam-video-placeholder' );
			originalVideoContainer = parentContainer.querySelector( '.easydam-video-container' );
		}

		if ( placeholder ) {
			placeholder.classList.add( 'hidden' );
		}

		if ( originalVideoContainer ) {
			originalVideoContainer.classList.remove( 'loading' );
		}

		// Preserve legacy behavior: remove any animate-video-loading class
		// from the closest relevant container so loading styles are cleared
		// after initialization. This supports both the new placeholder-based
		// loading UI and older markup that still uses .animate-video-loading.
		const loadingContainer =
			this.video.closest( '.animate-video-loading' ) ||
			parentContainer ||
			originalVideoContainer;
		if ( loadingContainer && loadingContainer.classList ) {
			loadingContainer.classList.remove( 'animate-video-loading' );
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
		this.adsManager?.setupAdsIntegration().catch( () => {
			// Ads are optional (the ads chunk is commonly blocked by ad
			// blockers); pluginLoader already warns once. Don't surface a hard
			// error — playback is unaffected.
		} );

		this.setupAspectRatio();
		this.setupPlayerReady();
	}

	/**
	 * Whether the player loads no media until the visitor presses play.
	 *
	 * Balanced videos use `preload: 'none'`: the poster image is already on
	 * screen, so nothing is downloaded, and no manifest or segment is parsed on
	 * the main thread, before playback is requested. Priority videos use
	 * `preload: 'metadata'`.
	 *
	 * @return {boolean} True when media loading waits for play.
	 */
	isPreloadDeferred() {
		return this.configManager.videoSetupControls?.preload === 'none';
	}

	/**
	 * Setup aspect ratio based on context
	 */
	setupAspectRatio() {
		const isInModal = this.video.closest( '.godam-modal' ) !== null;

		if ( isInModal ) {
			const aspectRatio = window.innerWidth < 420 ? '9:16' : '16:9';
			// Check if aspect ratio is valid x:y format
			if ( ! /^\d+:\d+$/.test( aspectRatio ) ) {
				// eslint-disable-next-line no-console
				console.warn( `Invalid aspect ratio format: "${ aspectRatio }". Falling back to "16:9".` );
			} else {
				this.player.aspectRatio( aspectRatio );
			}
		}
	}

	/**
	 * Detect and set aspect ratio from video metadata
	 */
	detectAndSetAspectRatio() {
		const videoElement = this.player.el().querySelector( 'video' );
		if ( ! videoElement ) {
			return;
		}

		const setAspectRatioFromDimensions = () => {
			const width = videoElement.videoWidth;
			const height = videoElement.videoHeight;

			if ( width && height ) {
				const calculatedAspectRatio = `${ width }:${ height }`;
				this.player.aspectRatio( calculatedAspectRatio );
			}
		};

		// Try to get dimensions immediately if already loaded
		if ( videoElement.videoWidth && videoElement.videoHeight ) {
			setAspectRatioFromDimensions();
		} else {
			// Wait for metadata to load
			videoElement.addEventListener( 'loadedmetadata', setAspectRatioFromDimensions, { once: true } );
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
			this.setupQualitySelector();
			this.setupDefaultSubtitle();

			// Now that managers are initialized, we can safely access them
			this.setupEventListeners();
			this.setupVisibilityHandling();

			// Work the visitor doesn't need before playback runs in a later task.
			runWhenIdleOrPlay( this.player, () => this.initializeDeferredFeatures() );

			this.video.dataset.godamReady = '1';

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
	 * Pause or mute the player when it leaves the visitor's view, per the
	 * out-of-view settings rendered as `data-out-of-view` and
	 * `data-out-of-view-tab-hidden` (see visibilityManager.js).
	 */
	setupVisibilityHandling() {
		const visibilityManager = getVisibilityManager();
		const entry = visibilityManager.register( this.player, {
			mode: resolveOutOfViewMode( this.video ),
			pauseOnTabHidden: resolvePauseOnTabHidden( this.video ),
			isPreview: () => !! this.hoverManager?.isPreviewActive?.(),
		} );

		if ( entry ) {
			this.player.one( 'dispose', () => visibilityManager.unregister( this.player ) );
		}
	}

	/**
	 * Handle aspect ratio setup for non-modal players
	 */
	handleAspectRatioSetup() {
		const isInModal = this.video.closest( '.godam-modal' ) !== null;

		if ( ! isInModal ) {
			const currentAspectRatio = this.configManager.videoSetupOptions?.aspectRatio || '16:9';

			// Handle responsive aspect ratio - detect from video dimensions
			if ( currentAspectRatio === 'responsive' ) {
				this.detectAndSetAspectRatio();
			} else if ( /^\d+:\d+$/.test( currentAspectRatio ) ) {
				// Valid x:y format
				this.player.aspectRatio( currentAspectRatio );
			} else {
				// Invalid format - fall back to 16:9
				// eslint-disable-next-line no-console
				console.warn( `Invalid aspect ratio format: "${ currentAspectRatio }". Falling back to "16:9".` );
				this.player.aspectRatio( '16:9' );
			}
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

		// Initialize hover manager
		this.hoverManager = new HoverManager( this.player, this.video );

		// Set up cross-manager communication
		this.setupManagerCommunication();

		// Attach managers to player for external access
		this.player.hoverManager = this.hoverManager;
	}

	/**
	 * Set up the features a player doesn't need before it plays: chapters, the
	 * share button, the AI transcript, the transcript panel and the menu hover
	 * behaviour. Runs once the browser is idle or the visitor starts playback,
	 * whichever comes first, so starting a player stays a short task.
	 */
	initializeDeferredFeatures() {
		const options = this.configManager.videoSetupOptions || {};
		const report = ( feature ) => ( error ) => {
			// eslint-disable-next-line no-console
			console.error( `GoDAM: failed to set up ${ feature }:`, error );
		};

		new MenuButtonHoverManager( this.player );
		this.initializeTranscript();

		if ( Array.isArray( options.chapters ) && options.chapters.length > 0 ) {
			loadChaptersManager()
				.then( ( { default: ChaptersManager } ) => {
					if ( this.player.isDisposed() ) {
						return;
					}
					this.chaptersManager = new ChaptersManager( this.player, this.video );
					this.chaptersManager.initialize();
				} )
				.catch( report( 'chapters' ) );
		}

		if ( options.showShareBtn ) {
			loadShareManager()
				.then( ( { default: ShareManager } ) => {
					if ( this.player.isDisposed() ) {
						return;
					}
					this.shareManager = new ShareManager( this.player, this.video, options );
					this.player.shareManager = this.shareManager;
				} )
				.catch( report( 'the share button' ) );
		}

		if ( options.showTranscription !== false ) {
			loadTranscriptPanelManager()
				.then( ( { default: TranscriptPanelManager } ) => {
					if ( this.player.isDisposed() ) {
						return;
					}
					// Reads its own config (`showTranscription`, `showShareBtn`) and
					// resolves the transcript independently, so it works regardless of
					// subtitle state.
					this.transcriptPanelManager = new TranscriptPanelManager( this.player, this.video, options );
					this.player.transcriptPanelManager = this.transcriptPanelManager;
				} )
				.catch( report( 'the transcript panel' ) );
		}
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
			onVideoResize: () => this.layersManager.handleVideoResize(),
			onPlay: () => this.layersManager.handlePlay(),
			onControlsMove: () => this.controlsManager.moveVideoControls(),
			onControlsReset: () => this.controlsManager.resetVideoControls(),
		} );

		const previewWatcher = this.previewManager.getPreviewWatcher();

		// Suppress layers while an uncommitted hover preview ("Start Preview",
		// or the muted preview of a `preview="true"` video) is playing – the
		// preview is meant to show playback, not layers.
		this.layersManager.setSuppressionCheck(
			() => this.hoverManager?.isPreviewActive() === true || previewWatcher?.value === true,
		);

		// A `preview="true"` video mounts its layers when real playback starts.
		if ( previewWatcher ) {
			this.previewManager.setPreviewStateChangeCallback(
				( isPreviewing ) => this.layersManager.handlePreviewStateChange( isPreviewing ),
			);
			// Playback started without clicking the video (the big play button,
			// the keyboard, GoDAMAPI) never ends a preview, but is real playback too.
			this.player.on( 'play', () => {
				if ( previewWatcher.value !== true ) {
					this.layersManager.handlePreviewStateChange( false );
				}
			} );
		}
	}

	/**
	 * Setup captions button styling
	 */
	setupCaptionsButton() {
		this.controlsManager.setupCaptionsButton();
	}

	/**
	 * Initialize AI-generated transcript loading.
	 * Fetches transcript from GoDAM API and adds it as a text track.
	 */
	initializeTranscript() {
		this.transcriptManager = new TranscriptManager(
			this.player,
			this.video,
			this.configManager,
		);

		// Load transcript asynchronously (non-blocking)
		this.transcriptManager.initialize().catch( ( error ) => {
			// eslint-disable-next-line no-console
			console.debug( 'Failed to initialize transcript:', error );
		} );

		// Attach to player for external access
		this.player.transcriptManager = this.transcriptManager;
	}

	/**
	 * When "Show caption" is enabled, turn on the first available
	 * subtitle/caption track by default. Re-checks as tracks are added (the
	 * AI transcript track loads asynchronously) and never overrides a track
	 * the viewer has already enabled.
	 */
	setupDefaultSubtitle() {
		if ( ! this.configManager.videoSetupOptions?.showCaption ) {
			return;
		}

		const textTracks = this.player.textTracks();
		if ( ! textTracks ) {
			return;
		}

		// Auto-enable at most once. After the first track is turned on (or one is
		// already showing), a viewer who turns captions back off must be respected
		// even when a late-loading track (the async AI transcript) fires `addtrack`.
		let hasAutoEnabled = false;
		const enableFirstSubtitle = () => {
			if ( hasAutoEnabled ) {
				return;
			}
			const subtitleTracks = [];
			for ( let i = 0; i < textTracks.length; i++ ) {
				const track = textTracks[ i ];
				if ( track.kind === 'subtitles' || track.kind === 'captions' ) {
					// A subtitle track is already active — respect the viewer's choice.
					if ( track.mode === 'showing' ) {
						hasAutoEnabled = true;
						return;
					}
					subtitleTracks.push( track );
				}
			}
			if ( subtitleTracks.length > 0 ) {
				subtitleTracks[ 0 ].mode = 'showing';
				hasAutoEnabled = true;
			}
		};

		enableFirstSubtitle();
		textTracks.addEventListener( 'addtrack', enableFirstSubtitle );
		// Avoid leaking the listener on SPA / infinite-scroll teardowns.
		this.player.one( 'dispose', () => textTracks.removeEventListener( 'addtrack', enableFirstSubtitle ) );
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
		// Every mounted layer: core, add-on (WooCommerce, etc.) and GoDAMAPI layers.
		this.layersManager.handleTimeUpdate( currentTime );
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
		if ( this.isPreloadDeferred() ) {
			this.player.one( 'loadedmetadata', () => this.renderQualitySelectorButton() );
			if ( ! this.hasQualitySelectorButton() ) {
				this.eventsManager.onQualityLevelsAvailable( () => this.renderQualitySelectorButton() );
			}
			return;
		}

		// Start loading when nothing has started yet, so the quality levels appear.
		// Video.js has usually begun loading already (preload is not 'none'), and a
		// second load() would re-source the player and fetch the media again.
		const NETWORK_EMPTY = 0;
		if ( this.player.readyState() === 0 && this.player.networkState() === NETWORK_EMPTY ) {
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
