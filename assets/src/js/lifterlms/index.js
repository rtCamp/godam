/**
 * Video Completion Handler for WordPress LMS
 * Manages video completion tracking and lesson progression controls
 */

/**
 * Video Completion Handler Object
 */
const GoDAMLifterLMSIntegration = {

	/**
	 * Configuration settings
	 */
	config: {},

	/**
	 * Initialize the video completion handler
	 */
	init() {
		this.loadConfiguration();
		this.setupInitialState();
		this.bindVideoEvents();
	},

	/**
	 * Load configuration from tracking settings
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
	 */
	setupInitialState() {
		if ( this.config.require_video_completion && ! this.config.video_completed ) {
			this.toggleLessonControls( false );
		}
	},

	/**
	 * Bind video player events
	 */
	bindVideoEvents() {
		const videoContainer = document.querySelector( '.godam-video-wrapper' );

		if ( videoContainer ) {
			const videoPlayer = videoContainer.querySelector( 'video' );

			if ( videoPlayer ) {
				videoPlayer.addEventListener( 'ended', ( event ) => {
					this.handleVideoComplete( event, videoContainer, this.config );
				} );
			}
		}
	},

	/**
	 * Prevent default event behavior
	 *
	 * @param {Event} event
	 */
	preventDefaultAction( event ) {
		event.preventDefault();
	},

	/**
	 * Toggle lesson completion controls and navigation elements
	 *
	 * @param {boolean} isEnabled
	 */
	toggleLessonControls( isEnabled ) {
		const completionForm = document.querySelector( '.llms-complete-lesson-form' );
		const submitButton = document.querySelector( '.llms-complete-lesson-form button[type="submit"]' );
		const navigationLinks = document.querySelectorAll( '#llms_start_quiz, #llms-start-assignment' );

		if ( isEnabled === true ) {
			// Enable form submission
			if ( completionForm ) {
				completionForm.removeEventListener( 'submit', this.preventDefaultAction );
			}

			// Enable submit button
			if ( submitButton ) {
				submitButton.removeAttribute( 'disabled' );
			}

			// Enable navigation links
			navigationLinks.forEach( ( link ) => {
				link.classList.remove( 'llms-av-disabled' );
				link.removeEventListener( 'click', this.preventDefaultAction );
			} );
		} else {
			// Disable form submission
			if ( completionForm ) {
				completionForm.addEventListener( 'submit', this.preventDefaultAction );
			}

			// Disable submit button
			if ( submitButton ) {
				submitButton.setAttribute( 'disabled', 'disabled' );
			}

			// Disable navigation links
			navigationLinks.forEach( ( link ) => {
				link.classList.add( 'llms-av-disabled' );
				link.addEventListener( 'click', this.preventDefaultAction );
			} );
		}
	},

	/**
	 * Initialize and run countdown timer
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
	 * Handle AJAX request for video completion
	 *
	 * @param {Element} container
	 * @param {Object}  configuration
	 */
	processVideoCompletion( container, configuration ) {
		const self = this;

		const llms = window.LLMS || null;

		// Check if LLMS.Ajax is available
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
						container.insertAdjacentHTML( 'beforeend', response.html );
						self.initializeCountdown( container );
					}
				},
			} );
		} else {
			// Fallback using native fetch if LLMS.Ajax is not available.
			const formData = new FormData();
			formData.append( 'action', 'llms_av_video_ended' );
			formData.append( 'id', configuration.post_id );
			formData.append( 'nonce', configuration.nonce );

			fetch( window.ajaxurl || '/wp-admin/admin-ajax.php', {
				method: 'POST',
				body: formData,
			} )
				.then( ( response ) => response.json() )
				.then( ( data ) => {
					if ( data?.html ) {
						container.insertAdjacentHTML( 'beforeend', data.html );
						self.initializeCountdown( container );
					}
				} );
		}
	},

	/**
	 * Handle video completion event
	 *
	 * @param {Event}   event
	 * @param {Element} container
	 * @param {Object}  configuration
	 */
	handleVideoComplete( event, container, configuration ) {
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
	GoDAMLifterLMSIntegration.init();
} );

// Make available globally if needed.
window.GoDAMLifterLMSIntegration = GoDAMLifterLMSIntegration;

