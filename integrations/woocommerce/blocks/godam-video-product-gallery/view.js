/**
 * GoDAM Video Product Gallery - Frontend Runtime
 *
 * Handles custom video controls, carousel navigation, and interactions.
 */

( function() {
	'use strict';

	/**
	 * Initialize all video product galleries on the page.
	 */
	function initGalleries() {
		const galleries = document.querySelectorAll( '.godam-video-product-gallery' );

		if ( galleries.length === 0 ) {
			return;
		}

		galleries.forEach( ( gallery ) => {
			if ( gallery.dataset.initialized === 'true' ) {
				return;
			}
			new VideoProductGallery( gallery );
			gallery.dataset.initialized = 'true';
		} );
	}

	/**
	 * VideoProductGallery class - manages a single gallery instance.
	 */
	class VideoProductGallery {
		constructor( element ) {
			this.element = element;
			this.layout = element.dataset.layout || 'carousel';
			this.autoplay = element.dataset.autoplay === 'true';
			this.container = element.querySelector( '.godam-video-product-gallery__container' );
			this.items = element.querySelectorAll( '.godam-video-product-gallery-item' );
			this.prevBtn = element.querySelector( '.godam-video-product-gallery__nav--prev' );
			this.nextBtn = element.querySelector( '.godam-video-product-gallery__nav--next' );
			this.players = [];
			this.init();
		}

		init() {
			if ( this.layout === 'carousel' ) {
				this.initCarousel();
			}
			this.items.forEach( ( item, index ) => {
				this.players[ index ] = new VideoPlayer( item );
			} );

			if ( this.autoplay ) {
				this.initAutoplay();
			}

			this.initAddToCart();
		}

		/**
		 * Use IntersectionObserver to autoplay videos when ≥50% visible
		 * and pause when they scroll out of view.
		 */
		initAutoplay() {
			const observer = new IntersectionObserver(
				( entries ) => {
					entries.forEach( ( entry ) => {
						const video = entry.target.querySelector( 'video' );
						if ( ! video ) {
							return;
						}
						if ( entry.isIntersecting ) {
							video.play().catch( () => {} );
						} else {
							video.pause();
						}
					} );
				},
				{ threshold: 0.5 },
			);

			this.items.forEach( ( item ) => observer.observe( item ) );
		}

		/**
		 * Attach click handlers on Add to Cart buttons.
		 * Simple/external products: POST to WooCommerce Store API, then open the mini-cart.
		 * Variable products: rendered as <a> links, so they navigate to product page natively.
		 */
		initAddToCart() {
			const buttons = this.element.querySelectorAll( 'button.godam-gallery-item__add-to-cart' );
			buttons.forEach( ( btn ) => {
				btn.addEventListener( 'click', ( e ) => {
					e.preventDefault();
					e.stopPropagation();
					this.handleAddToCart( btn );
				} );
			} );
		}

		/**
		 * Handle the add-to-cart action for a button.
		 *
		 * @param {HTMLButtonElement} btn The add-to-cart button element.
		 */
		async handleAddToCart( btn ) {
			const productId = btn.dataset.productId;
			if ( ! productId || btn.classList.contains( 'is-loading' ) ) {
				return;
			}

			const iconEl = btn.querySelector( '.godam-gallery-item__add-to-cart-icon' );
			const spinnerEl = btn.querySelector( '.godam-gallery-item__add-to-cart-spinner' );
			const checkEl = btn.querySelector( '.godam-gallery-item__add-to-cart-check' );

			// Show loading state.
			btn.classList.add( 'is-loading' );
			btn.disabled = true;
			if ( iconEl ) {
				iconEl.style.display = 'none';
			}
			if ( spinnerEl ) {
				spinnerEl.style.display = 'block';
			}

			try {
				const response = await fetch( '/wp-json/wc/store/v1/cart/add-item', {
					method: 'POST',
					credentials: 'same-origin',
					headers: {
						'Content-Type': 'application/json',
						Nonce: ( typeof wcBlocksMiddlewareConfig !== 'undefined' && wcBlocksMiddlewareConfig.storeApiNonce ) || '',
					},
					body: JSON.stringify( { id: parseInt( productId, 10 ), quantity: 1 } ),
				} );

				if ( ! response.ok ) {
					throw new Error( 'Add to cart failed' );
				}

				// Show success state.
				if ( spinnerEl ) {
					spinnerEl.style.display = 'none';
				}
				if ( checkEl ) {
					checkEl.style.display = 'block';
				}
				btn.classList.remove( 'is-loading' );
				btn.classList.add( 'is-added' );

				// Open mini-cart sidebar if available (block themes).
				this.openMiniCart();

				// Refresh WooCommerce fragments (classic themes).
				if ( typeof jQuery !== 'undefined' ) {
					jQuery( document.body ).trigger( 'wc_fragment_refresh' );
				}

				// Reset button after 2 seconds.
				setTimeout( () => {
					if ( checkEl ) {
						checkEl.style.display = 'none';
					}
					if ( iconEl ) {
						iconEl.style.display = 'block';
					}
					btn.classList.remove( 'is-added' );
					btn.disabled = false;
				}, 2000 );
			} catch {
				// Reset on error.
				if ( spinnerEl ) {
					spinnerEl.style.display = 'none';
				}
				if ( iconEl ) {
					iconEl.style.display = 'block';
				}
				btn.classList.remove( 'is-loading' );
				btn.disabled = false;
			}
		}

		/**
		 * Try to open the WooCommerce Mini Cart sidebar (block themes).
		 */
		openMiniCart() {
			// Method 1: Dispatch a custom event that WooCommerce mini-cart listens to.
			document.body.dispatchEvent( new Event( 'wc-blocks_added_to_cart' ) );

			// Method 2: Click the mini-cart button if it exists.
			const miniCartBtn = document.querySelector( '.wc-block-mini-cart__button' );
			if ( miniCartBtn ) {
				miniCartBtn.click();
			}
		}

		initCarousel() {
			if ( ! this.container ) {
				return;
			}
			this.updateNavVisibility();
			this.container.addEventListener( 'scroll', () => this.updateNavVisibility() );
			window.addEventListener( 'resize', () => this.updateNavVisibility() );
			if ( this.prevBtn ) {
				this.prevBtn.addEventListener( 'click', () => this.scrollCarousel( -1 ) );
			}
			if ( this.nextBtn ) {
				this.nextBtn.addEventListener( 'click', () => this.scrollCarousel( 1 ) );
			}
		}

		scrollCarousel( direction ) {
			const itemWidth = this.items[ 0 ]?.offsetWidth || 200;
			const gap = parseInt( getComputedStyle( this.element ).getPropertyValue( '--godam-gallery-gap' ) ) || 16;
			this.container.scrollBy( { left: ( itemWidth + gap ) * direction, behavior: 'smooth' } );
		}

		updateNavVisibility() {
			if ( ! this.container || ! this.prevBtn || ! this.nextBtn ) {
				return;
			}
			const { scrollLeft, scrollWidth, clientWidth } = this.container;
			this.prevBtn.style.display = scrollLeft <= 0 ? 'none' : 'flex';
			this.nextBtn.style.display = scrollLeft + clientWidth >= scrollWidth - 1 ? 'none' : 'flex';
		}
	}

	/**
	 * VideoPlayer class - manages a single video item with custom controls.
	 */
	class VideoPlayer {
		constructor( item ) {
			this.item = item;
			this.video = item.querySelector( 'video' );
			this.controls = item.querySelector( '.godam-gallery-item__controls' );
			this.playPauseBtn = item.querySelector( '.godam-gallery-item__btn--playpause' );
			this.muteBtn = item.querySelector( '.godam-gallery-item__btn--mute' );
			this.fullscreenBtn = item.querySelector( '.godam-gallery-item__btn--fullscreen' );
			this.progressBar = item.querySelector( '.godam-gallery-item__progress-bar' );
			this.progressFill = item.querySelector( '.godam-gallery-item__progress-fill' );
			this.rafId = null;
			this.hideTimer = null;

			if ( ! this.video ) {
				return;
			}
			this.init();
		}

		init() {
			this.bindVideoEvents();
			this.bindControlEvents();
			this.updatePlayPauseIcon();
			this.updateMuteIcon();
		}

		/**
		 * Bind native video events to keep UI in sync.
		 */
		bindVideoEvents() {
			this.video.addEventListener( 'play', () => {
				this.updatePlayPauseIcon();
				this.startProgressLoop();
			} );

			this.video.addEventListener( 'pause', () => {
				this.updatePlayPauseIcon();
				this.stopProgressLoop();
			} );

			this.video.addEventListener( 'volumechange', () => {
				this.updateMuteIcon();
			} );

			this.video.addEventListener( 'ended', () => {
				this.updatePlayPauseIcon();
				this.stopProgressLoop();
			} );
		}

		/**
		 * Bind control button and progress bar events.
		 */
		bindControlEvents() {
			// Click anywhere on video to toggle play/pause.
			this.video.addEventListener( 'click', ( e ) => {
				if ( e.target.closest( '.godam-gallery-item__controls' ) ) {
					return;
				}
				this.togglePlayPause();
			} );

			// Show controls on hover / touch.
			const wrapper = this.item.querySelector( '.godam-gallery-item__video-wrapper' );
			if ( wrapper ) {
				wrapper.addEventListener( 'mouseenter', () => this.showControls() );
				wrapper.addEventListener( 'mouseleave', () => this.scheduleHideControls() );
				wrapper.addEventListener( 'touchstart', () => this.showControlsTemporarily(), { passive: true } );
			}

			if ( this.playPauseBtn ) {
				this.playPauseBtn.addEventListener( 'click', ( e ) => {
					e.stopPropagation();
					this.togglePlayPause();
				} );
			}

			if ( this.muteBtn ) {
				this.muteBtn.addEventListener( 'click', ( e ) => {
					e.stopPropagation();
					this.toggleMute();
				} );
			}

			if ( this.fullscreenBtn ) {
				this.fullscreenBtn.addEventListener( 'click', ( e ) => {
					e.stopPropagation();
					this.toggleFullscreen();
				} );
				document.addEventListener( 'fullscreenchange', () => this.updateFullscreenIcon() );
			}

			// Progress bar seeking.
			if ( this.progressBar ) {
				this.progressBar.addEventListener( 'click', ( e ) => {
					e.stopPropagation();
					const rect = this.progressBar.getBoundingClientRect();
					const ratio = ( e.clientX - rect.left ) / rect.width;
					this.video.currentTime = ratio * this.video.duration;
				} );
			}
		}

		togglePlayPause() {
			if ( this.video.paused ) {
				this.video.play().catch( () => {} );
			} else {
				this.video.pause();
			}
		}

		toggleMute() {
			this.video.muted = ! this.video.muted;
		}

		toggleFullscreen() {
			const wrapper = this.item.querySelector( '.godam-gallery-item__video-wrapper' );
			if ( ! document.fullscreenElement ) {
				( wrapper || this.video ).requestFullscreen().catch( () => {} );
			} else {
				document.exitFullscreen();
			}
		}

		updatePlayPauseIcon() {
			if ( ! this.playPauseBtn ) {
				return;
			}
			const isPaused = this.video.paused;
			this.playPauseBtn.querySelector( '.godam-icon--play' ).style.display = isPaused ? 'block' : 'none';
			this.playPauseBtn.querySelector( '.godam-icon--pause' ).style.display = isPaused ? 'none' : 'block';
			this.playPauseBtn.setAttribute( 'aria-label', isPaused ? 'Play' : 'Pause' );
		}

		updateMuteIcon() {
			if ( ! this.muteBtn ) {
				return;
			}
			const isMuted = this.video.muted || this.video.volume === 0;
			this.muteBtn.querySelector( '.godam-icon--muted' ).style.display = isMuted ? 'block' : 'none';
			this.muteBtn.querySelector( '.godam-icon--unmuted' ).style.display = isMuted ? 'none' : 'block';
			this.muteBtn.setAttribute( 'aria-label', isMuted ? 'Unmute' : 'Mute' );
		}

		updateFullscreenIcon() {
			if ( ! this.fullscreenBtn ) {
				return;
			}
			const isFs = !! document.fullscreenElement;
			this.fullscreenBtn.querySelector( '.godam-icon--enter-fs' ).style.display = isFs ? 'none' : 'block';
			this.fullscreenBtn.querySelector( '.godam-icon--exit-fs' ).style.display = isFs ? 'block' : 'none';
		}

		startProgressLoop() {
			this.stopProgressLoop();
			const tick = () => {
				if ( this.video.duration && this.progressFill ) {
					const pct = ( this.video.currentTime / this.video.duration ) * 100;
					this.progressFill.style.width = pct + '%';
				}
				this.rafId = requestAnimationFrame( tick );
			};
			this.rafId = requestAnimationFrame( tick );
		}

		stopProgressLoop() {
			if ( this.rafId ) {
				cancelAnimationFrame( this.rafId );
				this.rafId = null;
			}
		}

		showControls() {
			clearTimeout( this.hideTimer );
			if ( this.controls ) {
				this.controls.classList.add( 'is-visible' );
			}
		}

		scheduleHideControls() {
			this.hideTimer = setTimeout( () => {
				if ( this.controls ) {
					this.controls.classList.remove( 'is-visible' );
				}
			}, 2000 );
		}

		showControlsTemporarily() {
			this.showControls();
			this.scheduleHideControls();
		}
	}

	// Initialize when DOM is ready.
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initGalleries );
	} else {
		initGalleries();
	}

	window.addEventListener( 'load', initGalleries );

	window.GodamVideoProductGallery = { init: initGalleries };
}() );
