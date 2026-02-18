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
				return;
			}

			console.log( 'GoDAM Reel Pops: Config loaded', config );

			// Check close persistence.
			const storageKey = `godam_reel_pops_closed_${ config.blockId }`;

			if ( config.closePersistence === 'hide_after_close' ) {
				const isClosed = localStorage.getItem( storageKey );
				if ( isClosed === 'true' ) {
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
			this.isClosedByUser = false;
			this.isHiddenForModal = false;
			this.wasRotationActiveBeforeModal = false;
			this.modalObserver = null;
			this.currentModalVideoId = '';
			this.isSwitchingModal = false;

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
				this.ensureModalNavigationSources();
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

			const mutedIcon = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true"><path d="M5 9v6h4l5 5V4l-5 5H5z" /><g transform="translate(17, 9)"><line x1="0" y1="0" x2="6" y2="6" stroke="currentColor" stroke-width="2" /><line x1="0" y1="6" x2="6" y2="0" stroke="currentColor" stroke-width="2" /></g></svg>';
			const unmutedIcon = '<svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true"><path d="M5 9v6h4l5 5V4l-5 5H5z" /><path d="M16 8.5a4.5 4.5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M18.8 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
			this.muteButton.innerHTML = this.isMuted ? mutedIcon : unmutedIcon;
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
			const playIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 6C8 4.8 9.3 4.1 10.4 4.9L19 10.9C20 11.6 20 12.4 19 13.1L10.4 19.1C9.3 19.9 8 19.2 8 18Z" /></svg>';
			const pauseIcon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="7" y="6" width="3.5" height="12" rx="1" /><rect x="13.5" y="6" width="3.5" height="12" rx="1" /></svg>';

			this.playButton.innerHTML = isPlaying ? pauseIcon : playIcon;
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
		 * @param {number}  index         Video index.
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
						const videoId = overlay.getAttribute( 'data-video-id' );
						const productIds = overlay.getAttribute( 'data-product-ids' ) || '';
						if ( modalId ) {
							this.openModal( modalId, videoId, productIds );
						}
					} );
				}
			} );
		}

		/**
		 * Open modal by ID.
		 *
		 * @param {string} modalId    Modal ID.
		 * @param {string} videoId    Video ID.
		 * @param {string} productIds Product IDs string.
		 */
		openModal( modalId, videoId = '', productIds = '' ) {
			const modal = modalId ? document.getElementById( modalId ) : null;
			const normalizedVideoId = String( videoId || '' ).trim();

			// Reuse existing product gallery delegated modal flow so behavior
			// (video loading, sidebar, escape, close) stays consistent.
			if ( normalizedVideoId ) {
				this.currentModalVideoId = normalizedVideoId;
				const normalizedProductIds = String( productIds || '' ).trim();
				const hasProductIds = normalizedProductIds.length > 0;
				const resolvedModal = modal || this.findModalByVideoId( normalizedVideoId );
				if ( ! resolvedModal ) {
					return;
				}

				this.ensureModalNavigationSources();
				let triggerVideo = this.getModalNavigationSourceByVideoId( normalizedVideoId );

				if ( ! triggerVideo ) {
					triggerVideo = document.createElement( 'div' );
					triggerVideo.className = 'godam-product-video-thumbnail godam-reel-pops-nav-source';
					triggerVideo.setAttribute( 'data-video-id', normalizedVideoId );
					triggerVideo.setAttribute( 'data-video-attached-product-ids', normalizedProductIds );
					triggerVideo.setAttribute( 'data-cta-enabled', hasProductIds ? 'true' : 'false' );
					triggerVideo.setAttribute( 'data-cta-display-position', 'inside' );
					triggerVideo.style.display = 'none';
					this.wrapper.appendChild( triggerVideo );
				} else {
					triggerVideo.setAttribute( 'data-video-attached-product-ids', normalizedProductIds );
					triggerVideo.setAttribute( 'data-cta-enabled', hasProductIds ? 'true' : 'false' );
				}

				const triggerButton = document.createElement( 'button' );
				triggerButton.type = 'button';
				triggerButton.className = 'godam-play-button';
				triggerButton.style.display = 'none';

				triggerVideo.insertAdjacentElement( 'afterend', triggerButton );

				triggerButton.dispatchEvent( new MouseEvent( 'click', {
					bubbles: true,
					cancelable: true,
					view: window,
				} ) );

				setTimeout( () => {
					const isOpened = resolvedModal.classList.contains( 'open' ) || resolvedModal.classList.contains( 'active' );

					if ( isOpened ) {
						resolvedModal.classList.add( 'godam-reel-pops-modal-instance' );
						this.attachModalStateObserver( resolvedModal );
						this.attachModalNavigation( resolvedModal );
						this.hideForModal();
					}

					triggerButton.remove();
				}, 50 );
				return;
			}

			if ( ! modal ) {
				return;
			}

			this.attachModalStateObserver( modal );

			// Show modal.
			modal.classList.remove( 'hidden' );
			modal.classList.add( 'active' );
			modal.classList.add( 'godam-reel-pops-modal-instance' );
			this.hideForModal();
		}

		/**
		 * Attach left/right navigation controls into an opened modal.
		 *
		 * @param {HTMLElement} modal Modal element.
		 */
		attachModalNavigation( modal ) {
			if ( ! modal || this.videoSlots.length < 2 || this.config.enableModalNavigation === false ) {
				modal?.classList.remove( 'godam-reel-pops-modal-nav-enabled' );
				modal?.querySelector( '.godam-reel-pops-modal-nav' )?.remove();
				return;
			}

			modal.classList.add( 'godam-reel-pops-modal-nav-enabled' );

			const modalContent = modal.querySelector( '.godam-woo-global-modal-content' ) || modal.querySelector( '.godam-product-modal-content' );
			if ( ! modalContent ) {
				return;
			}

			if ( modalContent.querySelector( '.godam-reel-pops-modal-nav' ) ) {
				return;
			}

			const nav = document.createElement( 'div' );
			nav.className = 'godam-reel-pops-modal-nav';

			const prevButton = document.createElement( 'button' );
			prevButton.type = 'button';
			prevButton.className = 'godam-reel-pops-modal-nav-btn prev';
			prevButton.setAttribute( 'aria-label', 'Show previous reel video' );
			prevButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18" aria-hidden="true"><path d="M14 6L8 12L14 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

			const nextButton = document.createElement( 'button' );
			nextButton.type = 'button';
			nextButton.className = 'godam-reel-pops-modal-nav-btn next';
			nextButton.setAttribute( 'aria-label', 'Show next reel video' );
			nextButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="18" height="18" aria-hidden="true"><path d="M10 6L16 12L10 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

			prevButton.addEventListener( 'click', ( event ) => {
				event.preventDefault();
				event.stopPropagation();
				this.navigateModal( -1 );
			} );

			nextButton.addEventListener( 'click', ( event ) => {
				event.preventDefault();
				event.stopPropagation();
				this.navigateModal( 1 );
			} );

			nav.appendChild( prevButton );
			nav.appendChild( nextButton );
			modalContent.appendChild( nav );
		}

		/**
		 * Navigate opened modal to next/previous Reel Pops video.
		 *
		 * @param {number} step Step direction (-1 previous, 1 next).
		 */
		navigateModal( step ) {
			if ( this.videoSlots.length < 2 || this.isSwitchingModal ) {
				return;
			}

			const activeModal = this.wrapper.querySelector( '.godam-product-modal-container.open, .godam-product-modal-container.active' );
			const activeModalVideoId = activeModal?.getAttribute( 'data-modal-video-id' ) || '';
			const baseVideoId = activeModalVideoId || this.currentModalVideoId;
			const currentModalIndex = this.getVideoIndexById( baseVideoId );
			if ( currentModalIndex < 0 ) {
				return;
			}

			const nextIndex = ( currentModalIndex + step + this.videoSlots.length ) % this.videoSlots.length;
			const nextOverlay = this.videoSlots[ nextIndex ]?.querySelector( '.godam-reel-pops-click-overlay' );
			if ( ! nextOverlay ) {
				return;
			}

			const nextModalId = nextOverlay.getAttribute( 'data-modal-id' );
			const nextVideoId = nextOverlay.getAttribute( 'data-video-id' );
			const nextProductIds = nextOverlay.getAttribute( 'data-product-ids' ) || '';
			const nextModal = ( nextModalId ? document.getElementById( nextModalId ) : null ) || this.findModalByVideoId( nextVideoId );
			if ( ! nextModal ) {
				return;
			}

			this.isSwitchingModal = true;

			const currentOpenModal = activeModal || this.wrapper.querySelector( '.godam-product-modal-container.open, .godam-product-modal-container.active' );
			this.currentModalVideoId = String( nextVideoId || '' ).trim();

			this.openModal( nextModalId, nextVideoId, nextProductIds );

			const closeWhenOpened = ( attempt = 0 ) => {
				const maxAttempts = 20;
				const isNextOpen = nextModal.classList.contains( 'open' ) || nextModal.classList.contains( 'active' );

				if ( isNextOpen ) {
					this.softCloseModal( currentOpenModal );
					setTimeout( () => {
						this.isSwitchingModal = false;
					}, 180 );
					return;
				}

				if ( attempt >= maxAttempts ) {
					this.isSwitchingModal = false;
					return;
				}

				setTimeout( () => {
					closeWhenOpened( attempt + 1 );
				}, 30 );
			};

			closeWhenOpened();
		}

		/**
		 * Soft-close modal without running full close lifecycle to prevent
		 * backdrop flicker while navigating between Reel Pops modals.
		 *
		 * @param {HTMLElement|null} modal Modal element.
		 */
		softCloseModal( modal ) {
			if ( ! modal ) {
				return;
			}

			modal.classList.remove( 'open', 'active' );
			modal.classList.add( 'hidden' );

			const htmlVideo = modal.querySelector( 'video' );
			if ( htmlVideo && typeof htmlVideo.pause === 'function' ) {
				htmlVideo.pause();
			}

			const player = modal.querySelector( '.video-js' )?.player;
			if ( player && typeof player.pause === 'function' ) {
				player.pause();
			}
		}

		/**
		 * Find a modal element by video ID inside this gallery wrapper.
		 *
		 * @param {string} videoId Video ID.
		 * @return {HTMLElement|null} Resolved modal element.
		 */
		findModalByVideoId( videoId ) {
			if ( ! videoId ) {
				return null;
			}

			return this.wrapper.querySelector(
				`.godam-product-modal-container[data-modal-video-id="${ videoId }"]:not([data-modal-timestamped]), .godam-product-modal-container[data-modal-video-id="${ videoId }"][data-modal-timestamped="0"]`,
			);
		}

		/**
		 * Ensure hidden thumbnail source items exist for product-gallery modal
		 * scroll/swipe navigation integration.
		 */
		ensureModalNavigationSources() {
			let sourcesContainer = this.wrapper.querySelector( '.godam-reel-pops-modal-sources' );
			if ( ! sourcesContainer ) {
				sourcesContainer = document.createElement( 'div' );
				sourcesContainer.className = 'godam-reel-pops-modal-sources';
				sourcesContainer.style.display = 'none';
				sourcesContainer.setAttribute( 'aria-hidden', 'true' );
				this.wrapper.appendChild( sourcesContainer );
			}

			sourcesContainer.innerHTML = '';

			this.videoSlots.forEach( ( slot ) => {
				const overlay = slot.querySelector( '.godam-reel-pops-click-overlay' );
				if ( ! overlay ) {
					return;
				}

				const videoId = String( overlay.getAttribute( 'data-video-id' ) || '' ).trim();
				if ( ! videoId ) {
					return;
				}

				const productIds = String( overlay.getAttribute( 'data-product-ids' ) || '' ).trim();
				const source = document.createElement( 'div' );
				source.className = 'godam-product-video-thumbnail godam-reel-pops-nav-source';
				source.setAttribute( 'data-video-id', videoId );
				source.setAttribute( 'data-video-attached-product-ids', productIds );
				source.setAttribute( 'data-cta-enabled', productIds.length > 0 ? 'true' : 'false' );
				source.setAttribute( 'data-cta-display-position', 'inside' );
				sourcesContainer.appendChild( source );
			} );
		}

		/**
		 * Get hidden modal navigation source by video ID.
		 *
		 * @param {string} videoId Video ID.
		 * @return {HTMLElement|null} Source element.
		 */
		getModalNavigationSourceByVideoId( videoId ) {
			if ( ! videoId ) {
				return null;
			}

			return this.wrapper.querySelector( `.godam-reel-pops-nav-source[data-video-id="${ videoId }"]` );
		}

		/**
		 * Hide Reel Pops while modal is open.
		 */
		hideForModal() {
			if ( this.isHiddenForModal || this.isClosedByUser ) {
				return;
			}

			this.wasRotationActiveBeforeModal = !! this.rotationInterval;
			this.stopRotation();

			this.videoSlots.forEach( ( slot ) => {
				const videoElement = slot.querySelector( 'video' );
				if ( videoElement && typeof videoElement.pause === 'function' ) {
					videoElement.pause();
				}
			} );

			if ( this.container ) {
				this.container.style.display = 'none';
			}
			this.isHiddenForModal = true;
		}

		/**
		 * Restore Reel Pops after modal closes.
		 */
		restoreAfterModal() {
			if ( ! this.isHiddenForModal || this.isClosedByUser || this.isSwitchingModal ) {
				return;
			}

			const hasOpenModal = !! this.wrapper.querySelector( '.godam-product-modal-container.open, .godam-product-modal-container.active' );
			if ( hasOpenModal ) {
				return;
			}

			if ( this.container ) {
				this.container.style.display = '';
			}

			if ( this.wasRotationActiveBeforeModal && this.videoSlots.length > 1 ) {
				this.startRotation();
			}

			this.playCurrentVideo();
			this.wasRotationActiveBeforeModal = false;
			this.isHiddenForModal = false;
			this.currentModalVideoId = '';
		}

		/**
		 * Observe modal class changes to detect close and restore Reel Pops.
		 *
		 * @param {HTMLElement} modal Modal element.
		 */
		attachModalStateObserver( modal ) {
			if ( this.modalObserver ) {
				this.modalObserver.disconnect();
				this.modalObserver = null;
			}

			this.modalObserver = new MutationObserver( () => {
				const isOpen = modal.classList.contains( 'open' ) || modal.classList.contains( 'active' );

				if ( ! isOpen ) {
					this.restoreAfterModal();

					if ( this.modalObserver ) {
						this.modalObserver.disconnect();
						this.modalObserver = null;
					}
				}
			} );

			this.modalObserver.observe( modal, {
				attributes: true,
				attributeFilter: [ 'class' ],
			} );
		}

		/**
		 * Resolve Reel Pops slot index from a video ID.
		 *
		 * @param {string} videoId Video ID.
		 * @return {number} Slot index or -1 if not found.
		 */
		getVideoIndexById( videoId ) {
			if ( ! videoId ) {
				return -1;
			}

			const targetId = String( videoId );
			return this.videoSlots.findIndex( ( slot ) => {
				const slotVideoId = slot.getAttribute( 'data-video-id' );
				return String( slotVideoId ) === targetId;
			} );
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
			this.isClosedByUser = true;

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
