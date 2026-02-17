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
			this.muteButton = wrapper.querySelector( '.godam-reel-pops-mute-toggle' );
			this.playButton = wrapper.querySelector( '.godam-reel-pops-play-toggle' );
			this.currentIndex = 0;
			this.rotationInterval = null;
			this.isAnimating = false;
			this.isMuted = true;

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
			this.bindMuteButton();
			this.bindPlayButton();

			// Playback fallback: some browsers block autoplay until a user gesture.
			this.container?.addEventListener( 'click', () => {
				this.playCurrentVideo();
			} );

			// Delay showing the popup based on initialDelay setting
			const initialDelaySeconds = Number.isFinite( this.config.initialDelay ) ? this.config.initialDelay : 3;
			const delayMs = Math.max( 0, initialDelaySeconds ) * 1000;

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
			videoElement.muted = this.isMuted;
			videoElement.playsInline = true;

			videoElement.play().catch( () => {
				// Swallow: user can click again to retry.
			} );

			this.syncAudioState();
			this.updatePlayButtonState( videoElement );
		}

		/**
		 * Keep audio state consistent: only active video follows mute state,
		 * all non-active videos are forced muted and paused.
		 */
		syncAudioState() {
			this.videoSlots.forEach( ( slot, i ) => {
				const videoElement = slot.querySelector( 'video' );
				if ( ! videoElement ) {
					return;
				}

				if ( i === this.currentIndex ) {
					videoElement.muted = this.isMuted;
					return;
				}

				videoElement.muted = true;
				if ( typeof videoElement.pause === 'function' ) {
					videoElement.pause();
				}
			} );
		}

		/**
		 * Get currently active video element.
		 *
		 * @return {HTMLVideoElement|null} Active video element.
		 */
		getCurrentVideoElement() {
			const activeSlot = this.videoSlots[ this.currentIndex ];
			return activeSlot ? activeSlot.querySelector( 'video' ) : null;
		}

		/**
		 * Update mute button UI.
		 */
		updateMuteButtonState() {
			if ( ! this.muteButton ) {
				return;
			}

			this.muteButton.textContent = this.isMuted ? '🔇' : '🔊';
			this.muteButton.classList.toggle( 'is-muted', this.isMuted );
			this.muteButton.setAttribute( 'aria-label', this.isMuted ? 'Unmute video' : 'Mute video' );
		}

		/**
		 * Update play button UI.
		 *
		 * @param {HTMLVideoElement|null} videoElement Video element to inspect.
		 */
		updatePlayButtonState( videoElement = null ) {
			if ( ! this.playButton ) {
				return;
			}

			const targetVideo = videoElement || this.getCurrentVideoElement();
			const isPlaying = !! targetVideo && ! targetVideo.paused;

			this.playButton.textContent = isPlaying ? '❚❚' : '▶';
			this.playButton.classList.toggle( 'is-playing', isPlaying );
			this.playButton.classList.toggle( 'is-paused', ! isPlaying );
			this.playButton.setAttribute( 'aria-label', isPlaying ? 'Pause video' : 'Play video' );
		}

		/**
		 * Bind mute button behavior.
		 */
		bindMuteButton() {
			if ( ! this.muteButton || ! this.config.showMuteButton ) {
				return;
			}

			this.updateMuteButtonState();

			this.muteButton.addEventListener( 'click', ( event ) => {
				event.preventDefault();
				event.stopPropagation();

				this.isMuted = ! this.isMuted;
				const activeVideoElement = this.getCurrentVideoElement();
				if ( activeVideoElement ) {
					activeVideoElement.muted = this.isMuted;
				}
				this.syncAudioState();

				this.updateMuteButtonState();
			} );
		}

		/**
		 * Bind play button behavior.
		 */
		bindPlayButton() {
			if ( ! this.playButton || ! this.config.showPlayButton ) {
				return;
			}

			this.updatePlayButtonState();

			this.playButton.addEventListener( 'click', ( event ) => {
				event.preventDefault();
				event.stopPropagation();

				const videoElement = this.getCurrentVideoElement();
				if ( ! videoElement ) {
					return;
				}

				if ( videoElement.paused ) {
					videoElement.muted = this.isMuted;
					videoElement.play().catch( () => {} );
				} else {
					videoElement.pause();
				}

				this.updatePlayButtonState( videoElement );
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
						firstVideo.muted = this.isMuted;
						firstVideo.play().catch( ( err ) => {
							console.warn( 'GoDAM Reel Pops: Autoplay failed', err );
						} );
						this.syncAudioState();
						this.updatePlayButtonState( firstVideo );
					}, 200 );
				}
			}
		}

		/**
		 * Apply entrance animation to the container using CSS keyframes.
		 */
		applyEntranceAnimation() {
			// Check for reduced motion preference.
			const prefersReducedMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

			if ( prefersReducedMotion ) {
				this.container.classList.add( 'reel-pops-visible' );
				return;
			}

			// Set visible resting state and trigger entrance keyframe animation.
			this.container.classList.add( 'reel-pops-visible', 'reel-pops-animate-enter' );

			// Clean up animation class when it finishes.
			const onEnd = ( event ) => {
				// Ignore bubbled events from children.
				if ( event.target !== this.container ) {
					return;
				}

				this.container.removeEventListener( 'animationend', onEnd );
				this.container.classList.remove( 'reel-pops-animate-enter' );
			};
			this.container.addEventListener( 'animationend', onEnd );
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
				console.log( 'GoDAM Reel Pops: Skipping showVideo - already animating' );
				return;
			}

			console.log( `GoDAM Reel Pops: Showing video ${ index } (animate: ${ withAnimation })` );

			const previousIndex = this.currentIndex;
			const previousSlot = this.videoSlots[ previousIndex ];
			const nextSlot = this.videoSlots[ index ];
			const previousVideoElement = previousSlot ? previousSlot.querySelector( 'video' ) : null;
			const nextVideoElement = nextSlot ? nextSlot.querySelector( 'video' ) : null;

			if ( withAnimation && previousIndex !== index ) {
				// Keyframe-based container animation:
				// 1. Play exit animation → container animates out.
				// 2. On animationend → swap video slots while hidden.
				// 3. Play enter animation → container animates back in.
				this.isAnimating = true;

				console.log( 'GoDAM Reel Pops: Starting Exit animation' );

				// Fallback safety timeout for isAnimating.
				const fallbackTimeout = setTimeout( () => {
					if ( this.isAnimating ) {
						console.error( 'GoDAM Reel Pops: Animation safety timeout reached - forcing end' );
						this.isAnimating = false;
						this.container.classList.remove( 'reel-pops-animate-exit', 'reel-pops-animate-enter' );
					}
				}, 2000 ); // Max 2 seconds for any animation sequence.

				// Step 1: Start exit animation.
				this.container.classList.add( 'reel-pops-animate-exit' );

				const onExitEnd = ( event ) => {
					// Ignore bubbled events from children - only respond to container's own animation.
					if ( event.target !== this.container ) {
						return;
					}

					this.container.removeEventListener( 'animationend', onExitEnd );
					console.log( 'GoDAM Reel Pops: Exit animation complete, swapping slots' );

					// Pause old video.
					if ( previousVideoElement && typeof previousVideoElement.pause === 'function' ) {
						previousVideoElement.pause();
					}

					// Step 2: Swap active slot (container is fully hidden via animation fill).
					previousSlot?.classList.remove( 'active' );
					nextSlot?.classList.add( 'active' );
					this.currentIndex = index;

					// Remove exit class.
					this.container.classList.remove( 'reel-pops-animate-exit' );

					// Force reflow to ensure the browser sees the class removal before re-adding.
					void this.container.offsetWidth;

					console.log( 'GoDAM Reel Pops: Starting Entrance animation' );

					// Step 3: Start entrance animation.
					this.container.classList.add( 'reel-pops-animate-enter' );

					// Play next video.
					if ( this.config.enableAutoplay && nextVideoElement && typeof nextVideoElement.play === 'function' ) {
						nextVideoElement.muted = this.isMuted;
						nextVideoElement.play().catch( () => {} );
					}
					this.syncAudioState();
					this.updateMuteButtonState();
					this.updatePlayButtonState( nextVideoElement );

					const onEnterEnd = ( event ) => {
						// Ignore bubbled events from children.
						if ( event.target !== this.container ) {
							return;
						}

						this.container.removeEventListener( 'animationend', onEnterEnd );
						this.container.classList.remove( 'reel-pops-animate-enter' );
						this.isAnimating = false;
						clearTimeout( fallbackTimeout );
						console.log( 'GoDAM Reel Pops: Entrance animation complete' );
					};
					this.container.addEventListener( 'animationend', onEnterEnd );
				};
				this.container.addEventListener( 'animationend', onExitEnd );
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
							nextVideoElement.muted = this.isMuted;
							nextVideoElement.play().catch( ( err ) => {
								console.warn( 'GoDAM Reel Pops: Video play failed', err );
							} );
							this.syncAudioState();
							this.updatePlayButtonState( nextVideoElement );
						}, 100 );
					}
				} else {
					this.syncAudioState();
					this.updatePlayButtonState( nextVideoElement );
				}

				this.updateMuteButtonState();
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
			this.videoSlots.forEach( ( slot ) => {
				const videoElement = slot.querySelector( 'video' );
				if ( videoElement && typeof videoElement.pause === 'function' ) {
					videoElement.pause();
				}
			} );

			// Add closing animation class (keyframe-based).
			this.container.classList.add( 'reel-pops-closing' );

			// Wait for animation to complete.
			const onCloseEnd = ( event ) => {
				// Ignore bubbled events from children.
				if ( event.target !== this.container ) {
					return;
				}

				this.container.removeEventListener( 'animationend', onCloseEnd );
				this.wrapper.style.display = 'none';
				this.stopRotation();

				// Save close state to localStorage if enabled.
				if ( this.config.closePersistence === 'hide_after_close' ) {
					const storageKey = `godam_reel_pops_closed_${ this.config.blockId }`;
					localStorage.setItem( storageKey, 'true' );
				}
			};
			this.container.addEventListener( 'animationend', onCloseEnd );
		}
	}

	// Initialize when DOM is ready.
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initReelPops );
	} else {
		initReelPops();
	}
}() );
