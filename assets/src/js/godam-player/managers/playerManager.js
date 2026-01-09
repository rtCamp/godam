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
import { KEYBOARD_CONTROLS } from '../utils/constants.js';
import { parseDataAttribute } from '../utils/dataHelpers.js';
import { engagement } from '../engagement';

/**
 * Main GoDAM Player Manager Class
 */
export default class PlayerManager {
	constructor( videoRef = null ) {
		this.videos = this.getVideos( videoRef );
		this.isDisplayingLayers = {};
		this.keyboardHandlerInitialized = false;

		this.init();
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
	 */
	init() {
		this.initializeDisplayLayers();

		const initPromises = [];
		this.videos.forEach( ( video ) => {
			initPromises.push( this.initializeVideo( video ) );
		} );

		// Dispatch event when all players are initialized
		Promise.allSettled( initPromises ).then( () => {
			const allPlayersReadyEvent = new CustomEvent( 'godamAllPlayersReady', {
				detail: {
					players: window.GoDAMAPI ? window.GoDAMAPI.getAllPlayers() : [],
				},
			} );
			document.dispatchEvent( allPlayersReadyEvent );
		} );

		this.initializeGlobalKeyboardHandler();
		this.initializeAutoplayOnView();
		this.initEngagement = engagement();
	}

	/**
	 * Initialize display layers tracking
	 */
	initializeDisplayLayers() {
		this.videos.forEach( ( video ) => {
			this.isDisplayingLayers[ video.dataset.instanceId ] = false;
		} );
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
	 * Initialize intersection observer for autoplay-on-view
	 */
	initializeAutoplayOnView() {
		// Check if IntersectionObserver is supported
		if ( ! ( 'IntersectionObserver' in window ) ) {
			return;
		}

		// Find all videos with autoplay-on-view attribute
		const autoplayOnViewVideos = Array.from( this.videos ).filter(
			( video ) => video.dataset.autoplayOnView === 'true',
		);

		if ( autoplayOnViewVideos.length === 0 ) {
			return;
		}

		// Create intersection observer
		const observerOptions = {
			root: null, // Use viewport as root
			rootMargin: '0px',
			threshold: 0.35, // Trigger when 35% of video is visible
		};

		const observer = new IntersectionObserver( ( entries ) => {
			entries.forEach( ( entry ) => {
				if ( entry.isIntersecting ) {
					this.handleAutoplayOnView( entry.target );
					// Unobserve after playing to prevent re-triggering
					observer.unobserve( entry.target );
				}
			} );
		}, observerOptions );

		// Observe each video
		autoplayOnViewVideos.forEach( ( video ) => {
			// Check if video is already intersecting (35% visible threshold)
			const rect = video.getBoundingClientRect();
			const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
			const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

			// Calculate intersection ratio manually (matching threshold 0.35)
			const visibleTop = Math.max( 0, Math.min( rect.bottom, viewportHeight ) - Math.max( rect.top, 0 ) );
			const visibleLeft = Math.max( 0, Math.min( rect.right, viewportWidth ) - Math.max( rect.left, 0 ) );
			const visibleArea = visibleTop * visibleLeft;
			const totalArea = rect.height * rect.width;
			const intersectionRatio = totalArea > 0 ? visibleArea / totalArea : 0;

			if ( intersectionRatio >= 0.35 && rect.height > 0 && rect.width > 0 ) {
				// Video is already 35%+ visible, trigger autoplay immediately
				// Use setTimeout to ensure player initialization has started
				setTimeout( () => {
					this.handleAutoplayOnView( video );
				}, 100 );
			} else {
				// Observe for when video enters viewport
				observer.observe( video );
			}
		} );
	}

	/**
	 * Handle autoplay when video enters viewport
	 *
	 * @param {HTMLElement} videoElement - Video element that entered viewport
	 */
	handleAutoplayOnView( videoElement ) {
		// Get the VideoJS player instance
		const player = videojs.getPlayer( videoElement );

		if ( ! player ) {
			// Player not ready yet, wait for it
			const checkPlayer = setInterval( () => {
				const playerInstance = videojs.getPlayer( videoElement );
				if ( playerInstance ) {
					clearInterval( checkPlayer );
					this.playVideoWhenReady( playerInstance );
				}
			}, 100 );

			// Stop checking after 5 seconds
			setTimeout( () => clearInterval( checkPlayer ), 5000 );
			return;
		}

		this.playVideoWhenReady( player );
	}

	/**
	 * Play video when player is ready
	 *
	 * @param {Object} player - VideoJS player instance
	 */
	playVideoWhenReady( player ) {
		if ( ! player ) {
			return;
		}

		// Wait for player to be ready
		if ( player.readyState() >= 2 ) {
			// Player has enough data to play
			player.play().catch( ( error ) => {
				// Autoplay was prevented (browser policy)
				// eslint-disable-next-line no-console
				console.warn( 'Autoplay prevented:', error );
			} );
		} else {
			// Wait for loadeddata event
			const playOnReady = () => {
				player.play().catch( ( error ) => {
					// eslint-disable-next-line no-console
					console.warn( 'Autoplay prevented:', error );
				} );
				player.off( 'loadeddata', playOnReady );
			};
			player.on( 'loadeddata', playOnReady );
		}
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
		this.showIndicator( player.el(), 'backward', sprintf( '<i class="fa-solid fa-backward"></i> %s', sprintf( __( '%ds', 'godam' ), skipSeconds ) ) );
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
		this.showIndicator( player.el(), 'forward', sprintf( '%s <i class="fa-solid fa-forward"></i>', sprintf( __( '%ds', 'godam' ), skipSeconds ) ) );
	}

	/**
	 * Toggle play/pause
	 *
	 * @param {Object} player - VideoJS player instance
	 */
	togglePlayPause( player ) {
		if ( player.paused() ) {
			player.play();
			this.showIndicator( player.el(), 'play-indicator', '<span class="vjs-icon-placeholder vjs-icon-pause" aria-hidden="true"></span>' );
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
			ALLOWED_TAGS: [ 'i', 'span', 'strong', 'em' ],
			ALLOWED_ATTR: [ 'class' ],
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
