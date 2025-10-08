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
		this.videos.forEach( ( video ) => this.initializeVideo( video ) );
		this.initializeGlobalKeyboardHandler();
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
	 */
	initializeVideo( video ) {
		// Skip if already initialized (prevents re-init by external observers)
		if ( video.dataset.godamInitialized === '1' ) {
			return;
		}
		video.dataset.godamInitialized = '1';

		const playerInstance = new VideoPlayer( video, this.isDisplayingLayers );
		playerInstance.initialize();
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
		/* translators: %s: number of seconds to seek forward */
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
			this.showIndicator( player.el(), 'play-indicator', '<i class="fa-solid fa-play"></i>' );
		} else {
			player.pause();
			this.showIndicator( player.el(), 'pause-indicator', '<i class="fa-solid fa-pause"></i>' );
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
