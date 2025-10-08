/**
 * Internal dependencies
 */
import { PLAYER_SKINS } from '../utils/constants.js';

/**
 * Events Manager
 * Handles video events, resize logic, and time updates
 */
export default class EventsManager {
	constructor( player, video, config ) {
		this.player = player;
		this.video = video;
		this.config = config;
		this.handleVideoResize = this.handleVideoResize.bind( this );
	}

	/**
	 * Setup event listeners
	 */
	setupEventListeners() {
		this.setupVideoResize();
		this.setupOverlayHandler();
		this.setupPlayerEvents();
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
		// This will be called by the main player
		if ( this.onPlayerConfigurationSetup ) {
			this.onPlayerConfigurationSetup();
		}
	}

	/**
	 * Set callbacks for events
	 *
	 * @param {Object} callbacks - Object containing callback functions
	 */
	setEventCallbacks( callbacks ) {
		this.onPlayerConfigurationSetup = callbacks.onPlayerConfigurationSetup;
		this.onTimeUpdate = callbacks.onTimeUpdate;
		this.onFullscreenChange = callbacks.onFullscreenChange;
		this.onPlay = callbacks.onPlay;
		this.onControlsMove = callbacks.onControlsMove;
	}

	/**
	 * Handle duration change events
	 */
	handleDurationChange() {
		// Duration change handling can be extended here if needed
	}

	/**
	 * Handle time update events
	 */
	handleTimeUpdate() {
		const currentTime = this.player.currentTime();

		// Call external time update handler
		if ( this.onTimeUpdate ) {
			this.onTimeUpdate( currentTime );
		}
	}

	/**
	 * Handle fullscreen changes
	 */
	handleFullscreenChange() {
		if ( this.onFullscreenChange ) {
			this.onFullscreenChange();
		}
	}

	/**
	 * Handle play events
	 */
	handlePlay() {
		if ( this.onPlay ) {
			this.onPlay();
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
			this.config.videoSetupOptions?.playerSkin === PLAYER_SKINS.CLASSIC ) {
			return;
		}

		// Handle control bar positioning during fullscreen
		this.handleFullscreenControlBar();

		// Check container width constraint
		const videoContainer = this.video.closest( '.godam-video-container' );
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
		if ( this.config.videoSetupOptions?.playerSkin === PLAYER_SKINS.PILLS ) {
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
			if ( this.onControlsMove ) {
				this.onControlsMove();
			}
		}, 100 );
	}

	/**
	 * Setup overlay handler
	 */
	setupOverlayHandler() {
		const videoContainerWrapper = ( this.player && this.player.el && this.player.el() ) || this.video;
		const wrapper = videoContainerWrapper && videoContainerWrapper.closest ? videoContainerWrapper.closest( '.godam-video-wrapper' ) : null;
		if ( ! wrapper ) {
			return;
		}

		const overlay = wrapper.querySelector( '[data-overlay-content]' );
		if ( ! overlay ) {
			return;
		}

		const overlayTimeRange = this.config.videoSetupOptions?.overlayTimeRange || 0;
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
	 * Initialize quality button on metadata load
	 *
	 * @param {Function} callback The callback to execute when quality levels are available.
	 */
	onQualityLevelsAvailable( callback ) {
		// Run callback when metadata is loaded.
		this.player.one( 'loadedmetadata', callback );

		// Listen for HLS playlist load, run callback when that happens.
		if ( this.player.tech_ && this.player.tech_.hls ) {
			this.player.tech_.hls.one( 'loadedplaylist', callback );
		}

		// Listen for quality levels being added, run callback when that happens.
		if ( this.player.qualityLevels ) {
			this.player.qualityLevels().one( 'addqualitylevel', callback );
		}
	}
}
