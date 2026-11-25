/**
 * External dependencies
 */
import DOMPurify from 'isomorphic-dompurify';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * VideoJs dependencies
 */
import videojs from 'video.js';
window.videojs = videojs; // Make videojs globally accessible.

/**
 * Internal dependencies
 */
import VideoPlayer from '../videoPlayer.js';
import { getLightbox } from './modalManager.js';
import { KEYBOARD_CONTROLS } from '../utils/constants.js';
import { parseDataAttribute } from '../utils/dataHelpers.js';
import { isLightboxVideo } from '../utils/lightboxTargets.js';
import { initBlurUpPlaceholders } from '../utils/blurUp.js';
import { whenPlayerReady } from '../utils/playerReady.js';
import { yieldToMain } from '../utils/scheduling.js';
import { getVisibilityManager } from './visibilityManager.js';

/**
 * Seek indicator SVG icons (no inline styles – styled via CSS class .godam-seek-icon).
 */
const BACKWARD_SEEK_INDICATOR_SVG = '<svg class="godam-seek-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="14" height="14" fill="currentColor"><path d="M459.5 440.6c9.5 7.9 22.8 9.7 34.1 4.4s18.4-16.6 18.4-29V96c0-12.4-7.2-23.7-18.4-29s-24.5-3.5-34.1 4.4L288 214.3V256v41.7L459.5 440.6zM256 352V256 128 96c0-12.4-7.2-23.7-18.4-29s-24.5-3.5-34.1 4.4l-192 160C4.2 237.5 0 246.5 0 256s4.2 18.5 11.5 24.6l192 160c9.5 7.9 22.8 9.7 34.1 4.4s18.4-16.6 18.4-29V352z"/></svg>';
const FORWARD_SEEK_INDICATOR_SVG = '<svg class="godam-seek-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="14" height="14" fill="currentColor"><path d="M52.5 440.6c-9.5 7.9-22.8 9.7-34.1 4.4S0 428.4 0 416V96C0 83.6 7.2 72.3 18.4 67s24.5-3.5 34.1 4.4L224 214.3V256v41.7L52.5 440.6zM256 352V256 128 96c0-12.4 7.2-23.7 18.4-29s24.5-3.5 34.1 4.4l192 160c7.3 6.1 11.5 15.1 11.5 24.6s-4.2 18.5-11.5 24.6l-192 160c-9.5 7.9-22.8 9.7-34.1 4.4S256 428.4 256 416V352z"/></svg>';

/**
 * Share of a video that must be on screen before autoplay-on-view starts it.
 *
 * @type {number}
 */
const AUTOPLAY_ON_VIEW_THRESHOLD = 0.35;

/**
 * One observer for every autoplay-on-view video on the page, created on first
 * use. Players start in batches as they come near the viewport, so a
 * per-batch observer would multiply with every batch.
 *
 * @type {IntersectionObserver|null}
 */
let autoplayObserver = null;

/**
 * Main GoDAM Player Manager Class
 */
export default class PlayerManager {
	/**
	 * @param {HTMLElement|null} videoRef           - Only start the players inside this element.
	 * @param {Object}           [options]          - Options.
	 * @param {boolean}          [options.autoInit] - Start the players found under `videoRef` now.
	 */
	constructor( videoRef = null, { autoInit = true } = {} ) {
		this.isDisplayingLayers = {};
		this.videos = autoInit ? this.getVideos( videoRef ) : [];

		if ( autoInit ) {
			this.init();
		}
	}

	/**
	 * Whether a video is a "Show in lightbox" player (opened in a lightbox on
	 * click) rather than initialised inline.
	 *
	 * @param {HTMLElement} video - Video element to test.
	 * @return {boolean} True when the video should play in a lightbox.
	 */
	isShowInLightbox( video ) {
		return isLightboxVideo( video );
	}

	/**
	 * Get video elements
	 *
	 * @param {HTMLElement|null} videoRef - Optional video reference element
	 * @return {NodeList} List of video elements
	 */
	getVideos( videoRef ) {
		return videoRef
			? videoRef.querySelectorAll( '.easydam-player.video-js' )
			: document.querySelectorAll( '.easydam-player.video-js' );
	}

	/**
	 * Initialize the player manager
	 *
	 * @return {Promise<void>} Resolves once every player in the batch has started.
	 */
	init() {
		this.initializeGlobalKeyboardHandler();
		initBlurUpPlaceholders();
		return this.initializeVideos( this.videos );
	}

	/**
	 * Start a batch of players.
	 *
	 * Players start one per task: each `videojs()` call is expensive, and running
	 * them back to back would form one long task that blocks input and paint.
	 * Already-started videos are skipped, so a batch can safely overlap another.
	 *
	 * Dispatches `godamAllPlayersReady` once the batch has settled.
	 *
	 * @param {Iterable<HTMLElement>} videos - `.easydam-player.video-js` elements.
	 * @return {Promise<void>} Resolves once every player in the batch has started.
	 */
	async initializeVideos( videos ) {
		const pending = Array.from( videos || [] ).filter(
			( video ) => video?.dataset?.godamInitialized !== '1',
		);

		const initPromises = [];
		for ( let index = 0; index < pending.length; index++ ) {
			if ( index > 0 ) {
				await yieldToMain();
			}

			const video = pending[ index ];
			// Another batch may have started it while this one was yielding.
			if ( video.dataset.godamInitialized === '1' ) {
				continue;
			}

			const instanceId = video.dataset.instanceId;
			if ( instanceId && ! ( instanceId in this.isDisplayingLayers ) ) {
				this.isDisplayingLayers[ instanceId ] = false;
			}

			initPromises.push( this.initializeVideo( video ) );

			// Show-in-lightbox players also initialise inline; a click just opens
			// them in a lightbox instead of playing in place. The lightbox is
			// page-wide, so it is only created once a page actually needs it.
			if ( this.isShowInLightbox( video ) ) {
				getLightbox().register( video );
			}
		}

		this.observeAutoplayOnView( pending );

		await Promise.allSettled( initPromises );

		document.dispatchEvent(
			new CustomEvent( 'godamAllPlayersReady', {
				detail: {
					players: window.GoDAMAPI ? window.GoDAMAPI.getAllPlayers() : [],
				},
			} ),
		);
	}

	/**
	 * Initialize players that were added to the DOM after construction (e.g.
	 * markup rendered by a page builder such as WPBakery's inline editor).
	 *
	 * Only elements that are not already initialized are started:
	 * `initializeVideo()` is guarded by `data-godam-initialized`.
	 *
	 * @return {Promise<void>} Resolves once the new players have started.
	 */
	initializePendingVideos() {
		initBlurUpPlaceholders();
		return this.initializeVideos( document.querySelectorAll( '.easydam-player.video-js' ) );
	}

	/**
	 * Initialize individual video
	 *
	 * @param {HTMLElement} video - Video element to initialize
	 * @return {Promise} Promise that resolves when initialization is complete
	 */
	initializeVideo( video ) {
		// Skip if already initialized (prevents re-init by external observers)
		if ( video.dataset.godamInitialized === '1' ) {
			return Promise.resolve();
		}
		video.dataset.godamInitialized = '1';

		const playerInstance = new VideoPlayer( video, this.isDisplayingLayers );
		// Handle async initialization (plugins loaded dynamically)
		return playerInstance.initialize().catch( ( error ) => {
			// eslint-disable-next-line no-console
			console.error( 'Failed to initialize video player:', error );
		} );
	}

	/**
	 * Initialize global keyboard handler
	 */
	initializeGlobalKeyboardHandler() {
		if ( window.godamKeyboardHandlerInitialized ) {
			return;
		}

		window.godamKeyboardHandlerInitialized = true;
		document.addEventListener( 'keydown', ( event ) => this.handleGlobalKeyboard( event ) );
	}

	/**
	 * Start autoplay-on-view videos once enough of them is on screen.
	 *
	 * Every batch shares one page-level observer. A video already on screen is
	 * reported by the observer straight away, so no manual geometry check is
	 * needed.
	 *
	 * @param {Array<HTMLElement>} videos - Videos from the batch just started.
	 */
	observeAutoplayOnView( videos ) {
		const autoplayVideos = videos.filter( ( video ) => video.dataset.autoplayOnView === 'true' );
		if ( autoplayVideos.length === 0 ) {
			return;
		}

		if ( ! ( 'IntersectionObserver' in window ) ) {
			autoplayVideos.forEach( ( video ) => this.handleAutoplayOnView( video ) );
			return;
		}

		if ( ! autoplayObserver ) {
			autoplayObserver = new IntersectionObserver(
				( entries ) => {
					entries.forEach( ( entry ) => {
						if ( entry.isIntersecting && entry.intersectionRatio >= AUTOPLAY_ON_VIEW_THRESHOLD ) {
							// Unobserve after playing to prevent re-triggering
							autoplayObserver.unobserve( entry.target );
							this.handleAutoplayOnView( entry.target );
						}
					} );
				},
				{ root: null, rootMargin: '0px', threshold: AUTOPLAY_ON_VIEW_THRESHOLD },
			);
		}

		autoplayVideos.forEach( ( video ) => {
			if ( video.dataset.godamAutoplayObserved === '1' ) {
				return;
			}
			video.dataset.godamAutoplayObserved = '1';
			// The `<video>` stays in place as Video.js's tech element, and its
			// container is already visible because the player has started.
			autoplayObserver.observe( video );
		} );
	}

	/**
	 * Handle autoplay when video enters viewport
	 *
	 * @param {HTMLElement} video - GoDAM `<video>` element that entered the viewport.
	 */
	handleAutoplayOnView( video ) {
		whenPlayerReady( video ).then( ( player ) => this.playVideoWhenReady( player ) );
	}

	/**
	 * Play video when player is ready
	 *
	 * @param {Object} player - VideoJS player instance
	 */
	playVideoWhenReady( player ) {
		if ( ! player || player.isDisposed?.() ) {
			return;
		}

		// Force muted state before attempting play for iOS compatibility
		player.muted( true );

		const attemptPlay = () => {
			const playPromise = player.play();
			if ( playPromise !== undefined ) {
				playPromise.catch( ( error ) => {
					// Autoplay was prevented (browser policy)
					// eslint-disable-next-line no-console
					console.debug( 'Autoplay blocked', error );
				} );
			}
		};

		// With `preload="none"` nothing loads until playback is requested, so
		// waiting for `loadeddata` would wait forever: ask to play straight away.
		if ( player.readyState() >= 2 || player.preload() === 'none' ) {
			attemptPlay();
			return;
		}

		// Wait for loadeddata event
		player.one( 'loadeddata', attemptPlay );
	}

	/**
	 * Handle global keyboard events
	 *
	 * @param {KeyboardEvent} event - Keyboard event object
	 */
	handleGlobalKeyboard( event ) {
		if ( this.shouldSkipKeyboardEvent( event ) ) {
			return;
		}

		const activePlayer = this.findActivePlayer();
		if ( ! activePlayer ) {
			return;
		}

		const activeVideo = activePlayer.el_.querySelector( 'video' );
		const activeVideoInstanceId = activeVideo.dataset.instanceId;

		if ( this.isDisplayingLayers[ activeVideoInstanceId ] ) {
			return;
		}

		this.handleKeyboardAction( event, activePlayer, activeVideo );
	}

	/**
	 * Check if keyboard event should be skipped
	 *
	 * @param {KeyboardEvent} event - Keyboard event object
	 * @return {boolean} True if event should be skipped
	 */
	shouldSkipKeyboardEvent( event ) {
		// Let native browser shortcuts (Cmd+F, Ctrl+F, Ctrl+arrows, etc.) pass
		// through untouched. The player only handles unmodified keystrokes, so a
		// modified key must never be captured or preventDefault()-ed.
		if ( event.metaKey || event.ctrlKey || event.altKey ) {
			return true;
		}

		const skipTags = [ 'INPUT', 'TEXTAREA' ];
		return skipTags.includes( event.target.tagName ) || event.target.isContentEditable;
	}

	/**
	 * Find the most appropriate active player
	 *
	 * @return {Object|null} Active VideoJS player instance or null
	 */
	findActivePlayer() {
		// First priority: player that contains the active element
		for ( const playerEl of document.querySelectorAll( '.easydam-player.video-js' ) ) {
			if ( playerEl.contains( playerEl.ownerDocument.activeElement ) ) {
				return videojs.getPlayer( playerEl );
			}
		}

		// Second priority: visible player if no player has focus
		for ( const playerEl of document.querySelectorAll( '.easydam-player.video-js' ) ) {
			const doc = playerEl.ownerDocument;
			if ( doc.activeElement === doc.body && this.isPlayerVisible( playerEl ) ) {
				return videojs.getPlayer( playerEl );
			}
		}

		return null;
	}

	/**
	 * Check if player is visible in viewport
	 *
	 * @param {HTMLElement} playerEl - Player element to check
	 * @return {boolean} True if player is visible
	 */
	isPlayerVisible( playerEl ) {
		const rect = playerEl.getBoundingClientRect();
		const doc = playerEl.ownerDocument;

		return rect.top >= 0 &&
			rect.left >= 0 &&
			rect.bottom <= ( window.innerHeight || doc.documentElement.clientHeight ) &&
			rect.right <= ( window.innerWidth || doc.documentElement.clientWidth );
	}

	/**
	 * Handle keyboard actions for video controls
	 *
	 * @param {KeyboardEvent} event        - Keyboard event object
	 * @param {Object}        activePlayer - VideoJS player instance
	 * @param {HTMLElement}   activeVideo  - Active video element
	 */
	handleKeyboardAction( event, activePlayer, activeVideo ) {
		const key = event.key.toLowerCase();
		const actions = {
			[ KEYBOARD_CONTROLS.FULLSCREEN ]: () => this.toggleFullscreen( activePlayer ),
			[ KEYBOARD_CONTROLS.SEEK_BACKWARD ]: () => this.seekBackward( activePlayer, activeVideo ),
			[ KEYBOARD_CONTROLS.SEEK_FORWARD ]: () => this.seekForward( activePlayer, activeVideo ),
			[ KEYBOARD_CONTROLS.PLAY_PAUSE ]: () => this.togglePlayPause( activePlayer ),
			[ KEYBOARD_CONTROLS.PLAY_PAUSE_ALT ]: () => this.togglePlayPause( activePlayer ),
		};

		const action = actions[ key ];
		if ( action ) {
			event.preventDefault();
			// Keyboard shortcuts are the visitor controlling this player.
			getVisibilityManager().markInteraction( activePlayer );
			action();
		}
	}

	/**
	 * Toggle fullscreen
	 *
	 * @param {Object} player - VideoJS player instance
	 */
	toggleFullscreen( player ) {
		if ( player.isFullscreen() ) {
			player.exitFullscreen();
		} else {
			player.requestFullscreen();
		}
	}

	/**
	 * Seek backward
	 *
	 * @param {Object}      player       - VideoJS player instance
	 * @param {HTMLElement} videoElement - Video element with configuration
	 */
	seekBackward( player, videoElement ) {
		const skipSettings = this.getSkipButtonSettings( videoElement );
		const skipSeconds = skipSettings.backward;

		player.currentTime( Math.max( 0, player.currentTime() - skipSeconds ) );
		/* translators: %d: number of seconds to seek backward */
		const backwardLabel = sprintf( __( '%ds', 'godam' ), skipSeconds );
		this.showIndicator( player.el(), 'backward', `${ BACKWARD_SEEK_INDICATOR_SVG } ${ backwardLabel }` );
	}

	/**
	 * Seek forward
	 *
	 * @param {Object}      player       - VideoJS player instance
	 * @param {HTMLElement} videoElement - Video element with configuration
	 */
	seekForward( player, videoElement ) {
		const skipSettings = this.getSkipButtonSettings( videoElement );
		const skipSeconds = skipSettings.forward;

		player.currentTime( player.currentTime() + skipSeconds );
		/* translators: %d: number of seconds to seek forward */
		const forwardLabel = sprintf( __( '%ds', 'godam' ), skipSeconds );
		this.showIndicator( player.el(), 'forward', `${ forwardLabel } ${ FORWARD_SEEK_INDICATOR_SVG }` );
	}

	/**
	 * Toggle play/pause
	 *
	 * @param {Object} player - VideoJS player instance
	 */
	togglePlayPause( player ) {
		if ( player.paused() ) {
			player.play();
			this.showIndicator( player.el(), 'play-indicator', '<span class="vjs-icon-placeholder vjs-icon-play" aria-hidden="true"></span>' );
		} else {
			player.pause();
			this.showIndicator( player.el(), 'pause-indicator', '<span class="vjs-icon-placeholder vjs-icon-pause" aria-hidden="true"></span>' );
		}
	}

	/**
	 * Show visual indicator with sanitized HTML
	 *
	 * @param {HTMLElement} playerEl  - Player element
	 * @param {string}      className - CSS class name for indicator
	 * @param {string}      html      - HTML content for indicator (will be sanitized)
	 */
	showIndicator( playerEl, className, html ) {
		// Remove any existing indicators first
		playerEl.querySelectorAll( '.vjs-seek-indicator' ).forEach( ( el ) => el.remove() );

		const indicator = document.createElement( 'div' );
		indicator.className = `vjs-seek-indicator ${ className }`;

		// Sanitize HTML content with DOMPurify before setting innerHTML
		const sanitizedHtml = DOMPurify.sanitize( html, {
			ALLOWED_TAGS: [ 'i', 'span', 'strong', 'em', 'svg', 'path' ],
			ALLOWED_ATTR: [ 'class', 'xmlns', 'viewBox', 'width', 'height', 'fill', 'fill-rule', 'clip-rule', 'd' ],
			KEEP_CONTENT: true,
		} );

		indicator.innerHTML = sanitizedHtml;
		playerEl.appendChild( indicator );
		setTimeout( () => indicator.remove(), 500 );
	}

	/**
	 * Get skip button settings from video element
	 *
	 * @param {HTMLElement} videoElement - Video element with data attributes
	 * @return {Object} Skip button configuration
	 */
	getSkipButtonSettings( videoElement ) {
		const controls = parseDataAttribute( videoElement, 'controls', {} );

		// Default skip button settings.
		const defaultSkipButtons = {
			forward: 10,
			backward: 10,
		};

		// Return skip button settings or defaults.
		return controls?.controlBar?.skipButtons || defaultSkipButtons;
	}
}
