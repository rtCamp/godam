/**
 * GoDAM Reel Pops - Frontend Runtime
 *
 * Handles animations, rotation, close persistence, and modal integration.
 * Videos are pre-rendered server-side by the shortcode.
 */

/* global GODAMPlayer */
/* eslint-disable no-console */

( function() {
	'use strict';

	/**
	 * Initialize all reel pops instances on the page.
	 */
	function initReelPops() {
		const wrappers = document.querySelectorAll( '.godam-reel-pops-wrapper' );

		console.log( 'Reel pops is loading' );

		if ( wrappers.length === 0 ) {
			console.log( 'GoDAM Reel Pops: No wrappers found on page' );
			return;
		}

		console.log( `GoDAM Reel Pops: Initializing ${ wrappers.length } instance(s)` );

		wrappers.forEach( ( wrapper ) => {
			const configData = wrapper.getAttribute( 'data-reel-pops-config' );
			if ( ! configData ) {
				console.warn( 'GoDAM Reel Pops: No config data found for wrapper', wrapper );
				return;
			}

			let config;
			try {
				config = JSON.parse( configData );
			} catch ( e ) {
				console.error( 'GoDAM Reel Pops: Invalid config data', e );
				console.error( 'GoDAM Reel Pops: Config string:', configData.substring( 0, 200 ), '...' );
				return;
			}

			console.log( 'GoDAM Reel Pops: Config loaded', config );

			// Check close persistence.
			const storageKey = `godam_reel_pops_closed_${ config.blockId }`;

			if ( config.closePersistence === 'hide_after_close' ) {
				const isClosed = localStorage.getItem( storageKey );
				if ( isClosed === 'true' ) {
					console.log( 'GoDAM Reel Pops: Skipping - previously closed by user' );
					return; // Don't show if user closed it.
				}
			} else if ( config.closePersistence === 'show_again' ) {
				// Clear any existing flag to ensure it shows.
				localStorage.removeItem( storageKey );
			}

			// Initialize the popup.
			const reelPop = new ReelPopInstance( wrapper, config );
			reelPop.init();
		} );
	}

	/**
	 * ReelPopInstance class - manages a single reel popup instance.
	 */
	class ReelPopInstance {
		constructor( wrapper, config ) {
			this.wrapper = wrapper;
			this.config = config;
			this.container = wrapper.querySelector( '.godam-reel-pops-container' );
			this.videoSlotsContainer = wrapper.querySelector( '.godam-reel-pops-video-slots' );
			this.closeButton = wrapper.querySelector( '.godam-reel-pops-close' );
			this.currentIndex = 0;
			this.rotationInterval = null;
			this.isAnimating = false;

			// Get all pre-rendered video slots.
			this.videoSlots = this.videoSlotsContainer ?
				Array.from( this.videoSlotsContainer.querySelectorAll( '.godam-reel-pops-video-slot' ) ) :
				[];
		}

		/**
		 * Initialize the reel popup.
		 */
		init() {
			if ( ! this.container || this.videoSlots.length === 0 ) {
				console.warn( 'GoDAM Reel Pops: Invalid container or no video slots found', {
					container: this.container,
					videoSlotsCount: this.videoSlots.length,
				} );
				return;
			}

			console.log( 'GoDAM Reel Pops: Initializing instance', {
				blockId: this.config.blockId,
				videoCount: this.videoSlots.length,
				autoplay: this.config.enableAutoplay,
				initialDelay: this.config.initialDelay,
			} );

			// Bind close button.
			this.closeButton?.addEventListener( 'click', () => this.close() );

			// Playback fallback: some browsers block autoplay until a user gesture.
			this.container?.addEventListener( 'click', () => {
				this.playCurrentVideo();
			} );

			// Delay showing the popup based on initialDelay setting
			const delayMs = ( this.config.initialDelay || 3 ) * 1000;

			setTimeout( () => {
				// Show the wrapper (hidden by default).
				console.log( 'GoDAM Reel Pops: Showing wrapper after initial delay' );
				this.wrapper.style.display = 'block';

				// Show first video immediately.
				this.showVideo( 0, false );
				// Try to start playback as soon as it becomes visible.
				this.playCurrentVideo();

				// Initialize all GODAMPlayer instances in video slots.
				setTimeout( () => {
					this.initializePlayers();
				}, 100 );

				// Apply entrance animation after a brief delay to ensure DOM is ready.
				setTimeout( () => {
					this.applyEntranceAnimation();
				}, 150 );

				// Start rotation if multiple videos.
				if ( this.videoSlots.length > 1 ) {
					this.startRotation();
				}

				// Bind modal click overlays.
				this.bindModalTriggers();
			}, delayMs );
		}

		/**
		 * Attempt to play the currently active slot's video.
		 */
		playCurrentVideo() {
			const activeSlot = this.videoSlots[ this.currentIndex ];
			if ( ! activeSlot ) {
				return;
			}

			const videoElement = activeSlot.querySelector( 'video' );
			if ( ! videoElement || typeof videoElement.play !== 'function' ) {
				return;
			}

			// Ensure autoplay-eligible flags are set.
			videoElement.muted = true;
			videoElement.playsInline = true;

			videoElement.play().catch( () => {
				// Swallow: user can click again to retry.
			} );
		}

		/**
		 * Initialize Video.js players for all video elements.
		 */
		initializePlayers() {
			if ( typeof videojs === 'undefined' ) {
				console.warn( 'GoDAM Reel Pops: Video.js not loaded' );
				return;
			}

			console.log( 'GoDAM Reel Pops: Players already initialized via inline scripts' );

			// Play first video if autoplay enabled
			if ( this.config.enableAutoplay && this.videoSlots.length > 0 ) {
				const firstVideo = this.videoSlots[ 0 ].querySelector( 'video' );
				if ( firstVideo ) {
					setTimeout( () => {
						firstVideo.play().catch( ( err ) => {
							console.warn( 'GoDAM Reel Pops: Autoplay failed', err );
						} );
					}, 200 );
				}
			}
		}

		/**
		 * Apply entrance animation to the container.
		 */
		applyEntranceAnimation() {
			// Check for reduced motion preference.
			const prefersReducedMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

			if ( prefersReducedMotion ) {
				this.container.classList.add( 'reel-pops-visible' );
				return;
			}

			// Add initial hidden state class based on animation type.
			const animType = this.config.animation;
			this.container.classList.add( `reel-pops-enter-${ animType }` );

			// Trigger animation on next frame.
			requestAnimationFrame( () => {
				requestAnimationFrame( () => {
					this.container.classList.add( 'reel-pops-visible' );
				} );
			} );
		}

		/**
		 * Show video by index with smooth cross-fade.
		 *
		 * @param {number} index Video index.
		 * @param {boolean} withAnimation Whether to show transition animation.
		 */
		showVideo( index, withAnimation = true ) {
			if ( index < 0 || index >= this.videoSlots.length ) {
				console.warn( 'GoDAM Reel Pops: Invalid video index', index );
				return;
			}

			if ( this.isAnimating && withAnimation ) {
				return;
			}

			console.log( `GoDAM Reel Pops: Showing video ${ index }` );

			const previousIndex = this.currentIndex;
			const previousSlot = this.videoSlots[ previousIndex ];
			const nextSlot = this.videoSlots[ index ];
			const previousVideoElement = previousSlot ? previousSlot.querySelector( 'video' ) : null;
			const nextVideoElement = nextSlot ? nextSlot.querySelector( 'video' ) : null;

			if ( withAnimation && previousIndex !== index ) {
				// Sequential animation:
				// 1) bounce-out the current slot
				// 2) after it finishes, switch active slot + bounce-in the next
				const enterMs = 460;
				const exitMs = 360;
				this.isAnimating = true;

				previousSlot?.classList.remove( 'reel-pops-slot-enter', 'reel-pops-slot-exit' );
				nextSlot?.classList.remove( 'reel-pops-slot-enter', 'reel-pops-slot-exit' );

				// Ensure next is hidden until we start the enter animation.
				nextSlot?.classList.remove( 'active' );

				if ( previousSlot ) {
					previousSlot.classList.add( 'reel-pops-slot-exit' );
				}

				setTimeout( () => {
					// Finish exit: hide old slot + pause old video.
					if ( previousSlot ) {
						previousSlot.classList.remove( 'active' );
						previousSlot.classList.remove( 'reel-pops-slot-exit' );
					}
					if ( previousVideoElement && typeof previousVideoElement.pause === 'function' ) {
						previousVideoElement.pause();
					}

					// Start enter: show next slot and animate in.
					if ( nextSlot ) {
						nextSlot.classList.add( 'active', 'reel-pops-slot-enter' );
					}
					this.currentIndex = index;

					if ( this.config.enableAutoplay && nextVideoElement && typeof nextVideoElement.play === 'function' ) {
						setTimeout( () => {
							nextVideoElement.play().catch( ( err ) => {
								console.warn( 'GoDAM Reel Pops: Video play failed', err );
							} );
						}, 50 );
					}

					setTimeout( () => {
						nextSlot?.classList.remove( 'reel-pops-slot-enter' );
						this.isAnimating = false;
					}, enterMs );
				}, exitMs );
			} else {
				// No animation - instant switch (for first load)
				if ( previousVideoElement && typeof previousVideoElement.pause === 'function' ) {
					previousVideoElement.pause();
				}

				this.videoSlots.forEach( ( slot, i ) => {
					if ( i === index ) {
						slot.classList.add( 'active' );
					} else {
						slot.classList.remove( 'active' );
					}
				} );
				this.currentIndex = index;

				// Play the new video if autoplay is enabled
				if ( this.config.enableAutoplay ) {
					if ( nextVideoElement && typeof nextVideoElement.play === 'function' ) {
						setTimeout( () => {
							nextVideoElement.play().catch( ( err ) => {
								console.warn( 'GoDAM Reel Pops: Video play failed', err );
							} );
						}, 100 );
					}
				}
			}
		}

		/**
		 * Bind modal triggers on click overlays.
		 */
		bindModalTriggers() {
			this.videoSlots.forEach( ( slot ) => {
				const overlay = slot.querySelector( '.godam-reel-pops-click-overlay' );
				if ( overlay ) {
					overlay.addEventListener( 'click', ( event ) => {
						event.preventDefault();
						event.stopPropagation();

						const modalId = overlay.getAttribute( 'data-modal-id' );
						if ( modalId ) {
							this.openModal( modalId );
						}
					} );
				}
			} );
		}

		/**
		 * Open modal by ID.
		 *
		 * @param {string} modalId Modal ID.
		 */
		openModal( modalId ) {
			const modal = document.getElementById( modalId );
			if ( ! modal ) {
				return;
			}

			// Use existing modal functionality (initVideoModal from modal.js).
			if ( typeof window.initVideoModal === 'function' ) {
				window.initVideoModal( modal );
			}

			// Show modal.
			modal.classList.remove( 'hidden' );
			modal.classList.add( 'active' );
		}

		/**
		 * Start video rotation timer.
		 */
		startRotation() {
			const intervalMs = this.config.durationSeconds * 1000;

			this.rotationInterval = setInterval( () => {
				this.rotateToNext();
			}, intervalMs );
		}

		/**
		 * Stop video rotation timer.
		 */
		stopRotation() {
			if ( this.rotationInterval ) {
				clearInterval( this.rotationInterval );
				this.rotationInterval = null;
			}
		}

		/**
		 * Rotate to the next video.
		 */
		rotateToNext() {
			const nextIndex = ( this.currentIndex + 1 ) % this.videoSlots.length;
			this.showVideo( nextIndex );
		}

		/**
		 * Close the reel popup.
		 */
		close() {
			// Add closing animation class.
			this.container.classList.add( 'reel-pops-closing' );

			// Wait for animation to complete.
			setTimeout( () => {
				this.wrapper.style.display = 'none';
				this.stopRotation();

				// Save close state to localStorage if enabled.
				if ( this.config.closePersistence === 'hide_after_close' ) {
					const storageKey = `godam_reel_pops_closed_${ this.config.blockId }`;
					localStorage.setItem( storageKey, 'true' );
				}
			}, this.config.animationDuration || 500 );
		}
	}

	// Initialize when DOM is ready.
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initReelPops );
	} else {
		initReelPops();
	}
}() );
