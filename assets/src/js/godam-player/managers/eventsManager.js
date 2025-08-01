/**
 * Internal dependencies
 */
import {
	createChapterMarkers,
	updateActiveChapter,
	loadChapters,
} from '../chapters.js';
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
		this.chaptersData = [];
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
	 * Set chapters data
	 *
	 * @param {Array} chaptersData - Chapters data array
	 */
	setChaptersData( chaptersData ) {
		this.chaptersData = chaptersData;
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
		const videoContainerWrapper = this.video.closest( '.godam-video-wrapper' );
		const overlay = videoContainerWrapper?.querySelector( '[data-overlay-content]' );

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
	 * Process chapters data
	 *
	 * @param {Array} chaptersData - Chapters data array
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
		this.setChaptersData( chaptersData );
	}
}
