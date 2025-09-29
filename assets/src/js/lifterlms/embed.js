/**
 * Video Completion Handler for WordPress LMS
 * Manages video completion tracking and lesson progression controls
 *
 * @since 1.4.0
 *
 * @package
 */

/**
 * External dependencies
 */
import DOMPurify from 'isomorphic-dompurify';

/**
 * Internal dependencies
 */
import { GODAM_API_BASE } from '../../../../pages/godam/utils';

/**
 * Video Completion Handler Object
 */
const GoDAMLifterLMSEmbedIntegration = {

	/**
	 * Configuration settings
	 *
	 * @since 1.4.0
	 */
	config: {},

	/**
	 * Storage key prefix for localStorage
	 *
	 * @since 1.4.0
	 */
	storagePrefix: 'godam_llms_video_progress_',

	player: null,

	/**
	 * Initialize the video completion handler
	 *
	 * @since 1.4.0
	 */
	init() {
		const host = new URL( GODAM_API_BASE ).host;

		const godamIframe = document.querySelector( `.llms-av-embed iframe[src*="${ host }"]` );

		if ( ! godamIframe ) {
			return;
		}
		this.loadConfiguration();
		this.setupInitialState();
		this.bindVideoEvents( godamIframe );
	},

	/**
	 * Load configuration from tracking settings
	 *
	 * @since 1.4.0
	 */
	loadConfiguration() {
		this.config = {};
		const trackingData = window.llms?.tracking?.getSettings() || null;

		if ( trackingData?.av ) {
			this.config = trackingData.av;
		}
	},

	/**
	 * Set up initial state based on video completion requirements
	 *
	 * @since 1.4.0
	 */
	setupInitialState() {
		if ( this.config.require_video_completion && ! this.config.video_completed ) {
			this.toggleLessonControls( false );
		}
	},

	/**
	 * Bind video player events
	 *
	 * @since 1.4.0
	 *
	 * @param {Element} godamIframe
	 */
	bindVideoEvents( godamIframe ) {
		const videoContainer = document.querySelector( '.llms-av-embed' );

		// Check if iframe contains class 'rtgodam-llms-autoplay'.
		if ( godamIframe && godamIframe.classList.contains( 'rtgodam-llms-autoplay' ) ) {
			// Set config to have autoplay enabled.
			this.config.autoplay = true;
		}

		if ( godamIframe ) {
			const godamPlayer = new window.GoDAMPlayer( godamIframe, {
				allowedOrigins: [ '*' ],
			} );

			if ( godamPlayer ) {
				this.player = godamPlayer;

				godamPlayer.on( 'timeupdate', ( event ) => {
					this.handleVideoProgress( event, this.config );
				} );

				godamPlayer.on( 'ended', ( event ) => {
					this.handleVideoComplete( event, videoContainer, this.config );
				} );

				godamPlayer.on( 'ready', ( event ) => {
					this.handleVideoLoaded( event, this.config );
				} );
			}
		}
	},

	/**
	 * Get storage key for current post
	 *
	 * @since 1.4.0
	 *
	 * @param {Object} configuration
	 */
	getStorageKey( configuration ) {
		return this.storagePrefix + configuration.post_id;
	},

	/**
	 * Store video progress in localStorage
	 *
	 * @since 1.4.0
	 *
	 * @param {number} currentTime
	 * @param {Object} configuration
	 */
	storeVideoProgress( currentTime, configuration ) {
		try {
			const storageKey = this.getStorageKey( configuration );
			const progressData = {
				currentTime: Math.floor( currentTime ),
				timestamp: Date.now(),
				postId: configuration.post_id,
			};
			localStorage.setItem( storageKey, JSON.stringify( progressData ) );
		} catch ( error ) {
			// We are not throwing an error here currently.
			return null;
		}
	},

	/**
	 * Get stored video progress from localStorage
	 *
	 * @since 1.4.0
	 *
	 * @param {Object} configuration
	 */
	getStoredProgress( configuration ) {
		try {
			const storageKey = this.getStorageKey( configuration );
			const stored = localStorage.getItem( storageKey );
			return stored ? JSON.parse( stored ) : null;
		} catch ( error ) {
			// We are not throwing an error here currently.
			return null;
		}
	},

	/**
	 * Remove stored video progress from localStorage
	 *
	 * @since 1.4.0
	 *
	 * @param {Object} configuration
	 */
	removeStoredProgress( configuration ) {
		try {
			const storageKey = this.getStorageKey( configuration );
			localStorage.removeItem( storageKey );
		} catch ( error ) {
			// We are not throwing an error here currently.
			return null;
		}
	},

	/**
	 * Handle video loaded event to restore progress
	 *
	 * @since 1.4.0
	 *
	 * @param {Event}  event
	 * @param {Object} configuration
	 */
	handleVideoLoaded( event, configuration ) {
		const storedProgress = this.getStoredProgress( configuration );

		if ( storedProgress && storedProgress.currentTime > 0 ) {
			this.player.seek( storedProgress.currentTime );
		}

		if ( this.config.autoplay && this.player ) {
			this.player.setMuted( true ).then( () => {
				this.player.play();
			} );
		}
	},

	/**
	 * Prevent default event behavior
	 *
	 * @since 1.4.0
	 *
	 * @param {Event} event
	 */
	preventDefaultAction( event ) {
		event.preventDefault();
	},

	/**
	 * Toggle lesson completion controls and navigation elements
	 *
	 * @since 1.4.0
	 *
	 * @param {boolean} isEnabled
	 */
	toggleLessonControls( isEnabled ) {
		const completionForm = document.querySelector( '.llms-complete-lesson-form' );
		const submitButton = document.querySelector( '.llms-complete-lesson-form button[type="submit"]' );
		const navigationLinks = document.querySelectorAll( '#llms_start_quiz, #llms-start-assignment' );

		if ( isEnabled === true ) {
			// Enable form submission.
			if ( completionForm ) {
				completionForm.removeEventListener( 'submit', this.preventDefaultAction );
			}

			// Enable submit button.
			if ( submitButton ) {
				submitButton.removeAttribute( 'disabled' );
			}

			// Enable navigation links.
			navigationLinks.forEach( ( link ) => {
				link.classList.remove( 'llms-av-disabled' );
				link.removeEventListener( 'click', this.preventDefaultAction );
			} );
		} else {
			// Disable form submission.
			if ( completionForm ) {
				completionForm.addEventListener( 'submit', this.preventDefaultAction );
			}

			// Disable submit button.
			if ( submitButton ) {
				submitButton.setAttribute( 'disabled', 'disabled' );
			}

			// Disable navigation links.
			navigationLinks.forEach( ( link ) => {
				link.classList.add( 'llms-av-disabled' );
				link.addEventListener( 'click', this.preventDefaultAction );
			} );
		}
	},

	/**
	 * Initialize and run countdown timer
	 *
	 * @since 1.4.0
	 *
	 * @param {Element} container
	 */
	initializeCountdown( container ) {
		const timerElement = container.querySelector( '.llms-av-pv--seconds' );
		let remainingTime;

		if ( ! timerElement ) {
			return null;
		}

		const countdownInterval = setInterval( function() {
			remainingTime = parseInt( timerElement.textContent ) - 1;

			if ( remainingTime === 1 ) {
				const closestLink = timerElement.closest( 'a' );
				if ( closestLink ) {
					closestLink.click();
				}
			}

			if ( remainingTime >= 0 ) {
				timerElement.textContent = remainingTime;
			}
		}, 1000 );

		return countdownInterval;
	},

	/**
	 * Handle video progress updates
	 *
	 * @since 1.4.0
	 *
	 * @param {Event}  event
	 * @param {Object} configuration
	 */
	handleVideoProgress( event, configuration ) {
		const currentTime = event.currentTime;

		// Only store progress if video has been playing for at least 1 second.
		// and hasn't reached the end.
		if ( currentTime > 1 && currentTime < event.duration - 1 ) {
			// Throttle storage updates to every 1 seconds to avoid excessive writes.
			if ( ! this.lastProgressUpdate || Date.now() - this.lastProgressUpdate > 1000 ) {
				this.storeVideoProgress( currentTime, configuration );
				this.lastProgressUpdate = Date.now();
			}
		}
	},

	/**
	 * Handle AJAX request for video completion
	 *
	 * @since 1.4.0
	 *
	 * @param {Element} container
	 * @param {Object}  configuration
	 */
	processVideoCompletion( container, configuration ) {
		const self = this;

		const llms = window.LLMS || null;

		// Check if LLMS.Ajax is available.
		if ( typeof llms !== 'undefined' && llms.Ajax ) {
			llms.Ajax.call( {
				data: {
					action: 'llms_av_video_ended',
					id: configuration.post_id,
					nonce: configuration.nonce,
				},
				beforeSend() {
					if ( llms.Spinner ) {
						llms.Spinner.start( container );
					}
				},
				error() {
					if ( llms.Spinner ) {
						llms.Spinner.stop( container );
					}
				},
				success( response ) {
					if ( llms.Spinner ) {
						llms.Spinner.stop( container );
					}
					if ( response?.html ) {
						const cleanHtml = DOMPurify.sanitize( response.html );
						container.insertAdjacentHTML( 'beforeend', cleanHtml );
						self.manageCountdown( self.initializeCountdown( container ) );
					}
				},
			} );
		} else {
			// Fallback using native fetch if LLMS.Ajax is not available.
			const formData = new FormData();
			formData.append( 'action', 'llms_av_video_ended' );
			formData.append( 'id', configuration.post_id );
			formData.append( 'nonce', configuration.nonce );

			fetch( window.ajaxurl ?? '', {
				method: 'POST',
				body: formData,
			} )
				.then( ( response ) => response.json() )
				.then( ( data ) => {
					if ( data?.html ) {
						const cleanHtml = DOMPurify.sanitize( data.html );
						container.insertAdjacentHTML( 'beforeend', cleanHtml );
						self.manageCountdown( self.initializeCountdown( container ) );
					}
				} );
		}
	},

	/**
	 * Manage countdown timer for video completion
	 *
	 * @since 1.4.0
	 *
	 * @param {any} countdown
	 */
	manageCountdown( countdown ) {
		const stopCountdownBtn = document.querySelector( '.llms-av-pv--btn-stop-countdown' );
		stopCountdownBtn.addEventListener( 'click', () => {
			if ( countdown ) {
				clearInterval( countdown );
			}
			document.querySelector( '.llms-av-pv' ).remove();
		} );
	},

	/**
	 * Handle video completion event
	 *
	 * @since 1.4.0
	 *
	 * @param {Event}   event
	 * @param {Element} container
	 * @param {Object}  configuration
	 */
	handleVideoComplete( event, container, configuration ) {
		// Remove stored progress since video is completed.
		this.removeStoredProgress( configuration );

		// Process completion via AJAX.
		this.processVideoCompletion( container, configuration );

		// Enable lesson completion controls.
		this.toggleLessonControls( true );
	},
};

/**
 * Initialize when document is ready.
 */
document.addEventListener( 'DOMContentLoaded', function() {
	GoDAMLifterLMSEmbedIntegration.init();
} );

// Make available globally if needed.
window.GoDAMLifterLMSEmbedIntegration = GoDAMLifterLMSEmbedIntegration;
