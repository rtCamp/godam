/**
 * GoDAM Video Product Gallery - Frontend Runtime
 *
 * Handles custom video playback, add-to-cart interactions, and modal view for
 * the GoDAM Video Product Gallery block on the frontend.
 */

/* global jQuery */

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
			this.items = Array.from( element.querySelectorAll( '.godam-video-product-gallery-item' ) );
			this.prevBtn = element.querySelector( '.godam-video-product-gallery__nav--prev' );
			this.nextBtn = element.querySelector( '.godam-video-product-gallery__nav--next' );

			// Modal state.
			this.modalOpen = false;
			this.modalIndex = -1;
			this.modalOriginalItem = null;
			this.modalPlaceholder = null;

			this.createModalElements();
			this.init();
		}

		init() {
			if ( this.layout === 'carousel' ) {
				this.initCarousel();
			}

			if ( this.autoplay ) {
				this.initAutoplay();
			}

			this.initAddToCart();
			this.initModal();
		}

		/**
		 * Use IntersectionObserver to autoplay the first 5 seconds of each video
		 * in a loop when ≥50% visible, and pause when they scroll out of view.
		 */
		initAutoplay() {
			const PREVIEW_DURATION = 5; // Loop only the initial 5 seconds.

			const observer = new IntersectionObserver(
				( entries ) => {
					entries.forEach( ( entry ) => {
						const video = entry.target.querySelector( 'video' );
						if ( ! video ) {
							return;
						}
						if ( entry.isIntersecting ) {
							video.currentTime = 0;
							video.play().catch( () => {} );
						} else {
							video.pause();
							video.currentTime = 0;
						}
					} );
				},
				{ threshold: 0.5 },
			);

			this.items.forEach( ( item ) => {
				const video = item.querySelector( 'video' );
				if ( video ) {
					// Store the time-update handler so we can remove/re-attach it.
					video._godamTimeUpdate = () => {
						if ( video.currentTime >= PREVIEW_DURATION ) {
							video.currentTime = 0;
						}
					};
					video.addEventListener( 'timeupdate', video._godamTimeUpdate );
				}
				observer.observe( item );
			} );
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
		handleAddToCart( btn ) {
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

			fetch( '/?wc-ajax=add_to_cart', {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams( { product_id: productId, quantity: 1 } ),
				credentials: 'same-origin',
			} )
				.then( ( response ) => response.json() )
				.then( ( data ) => {
					if ( data.error ) {
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

					// Update WooCommerce cart fragments (classic themes).
					if ( data.fragments && typeof jQuery !== 'undefined' ) {
						jQuery.each( data.fragments, ( key, value ) => {
							jQuery( key ).replaceWith( value );
						} );
						jQuery( document.body ).trigger( 'wc_fragments_refreshed' );
					}

					// Open mini-cart sidebar if available (block themes).
					this.openMiniCart();

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
				} )
				.catch( () => {
					// Reset on error.
					if ( spinnerEl ) {
						spinnerEl.style.display = 'none';
					}
					if ( iconEl ) {
						iconEl.style.display = 'block';
					}
					btn.classList.remove( 'is-loading' );
					btn.disabled = false;
				} );
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

		// ─────────────────────────────────────────────
		// Modal — move original element to body
		// ─────────────────────────────────────────────

		/**
		 * Create modal UI elements (overlay, close, prev/next) and append to body.
		 */
		createModalElements() {
			// Overlay.
			this.overlay = document.createElement( 'div' );
			this.overlay.className = 'godam-vpg-modal-overlay';
			document.body.appendChild( this.overlay );

			// Close button.
			this.modalCloseBtn = document.createElement( 'button' );
			this.modalCloseBtn.className = 'godam-vpg-modal-close';
			this.modalCloseBtn.setAttribute( 'aria-label', 'Close' );
			this.modalCloseBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
			document.body.appendChild( this.modalCloseBtn );

			// Prev button.
			this.modalPrevBtn = document.createElement( 'button' );
			this.modalPrevBtn.className = 'godam-vpg-modal-nav godam-vpg-modal-nav--prev';
			this.modalPrevBtn.setAttribute( 'aria-label', 'Previous video' );
			this.modalPrevBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
			document.body.appendChild( this.modalPrevBtn );

			// Next button.
			this.modalNextBtn = document.createElement( 'button' );
			this.modalNextBtn.className = 'godam-vpg-modal-nav godam-vpg-modal-nav--next';
			this.modalNextBtn.setAttribute( 'aria-label', 'Next video' );
			this.modalNextBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
			document.body.appendChild( this.modalNextBtn );
		}

		/**
		 * Attach click handlers to open modal when clicking on a video item.
		 */
		initModal() {
			// Click on video wrapper to open modal.
			this.items.forEach( ( item, index ) => {
				const videoWrapper = item.querySelector( '.godam-gallery-item__video-wrapper' );
				if ( videoWrapper ) {
					videoWrapper.style.cursor = 'pointer';
					videoWrapper.addEventListener( 'click', ( e ) => {
						// Don't open modal if clicking on player controls.
						if (
							e.target.closest( '.godam-gallery-item__product' ) ||
							e.target.closest( '.godam-gallery-item__add-to-cart' )
						) {
							return;
						}

						// If this item is already in modal, let video player handle the click.
						if ( item.classList.contains( 'godam-video-product-gallery-item--modal' ) ) {
							return;
						}

						this.openModal( index );
					} );
				}
			} );

			// Close handlers.
			this.overlay.addEventListener( 'click', () => this.closeModal() );
			this.modalCloseBtn.addEventListener( 'click', () => this.closeModal() );

			// Nav handlers.
			this.modalPrevBtn.addEventListener( 'click', () => this.navigateModal( -1 ) );
			this.modalNextBtn.addEventListener( 'click', () => this.navigateModal( 1 ) );

			// Keyboard handlers.
			document.addEventListener( 'keydown', ( e ) => {
				if ( ! this.modalOpen ) {
					return;
				}
				if ( e.key === 'Escape' ) {
					this.closeModal();
				} else if ( e.key === 'ArrowLeft' ) {
					this.navigateModal( -1 );
				} else if ( e.key === 'ArrowRight' ) {
					this.navigateModal( 1 );
				}
			} );
		}

		/**
		 * Open the modal for a given item index.
		 *
		 * @param {number} index The index of the item to show in the modal.
		 */
		openModal( index ) {
			// If already open with a different item, restore the current one first.
			if ( this.modalOpen ) {
				this.restoreCurrentItem();
			}

			this.modalIndex = index;
			this.modalOpen = true;
			this.modalOriginalItem = this.items[ index ];

			// Pause all gallery preview videos.
			this.items.forEach( ( item ) => {
				const video = item.querySelector( 'video' );
				if ( video ) {
					video.pause();
				}
			} );

			// Create a placeholder clone to maintain gallery layout.
			this.modalPlaceholder = this.modalOriginalItem.cloneNode( true );
			this.modalPlaceholder.classList.add( 'godam-video-product-gallery-item--placeholder' );

			// Pause any video in the clone so it doesn't play in the background.
			const cloneVideo = this.modalPlaceholder.querySelector( 'video' );
			if ( cloneVideo ) {
				cloneVideo.pause();
				cloneVideo.removeAttribute( 'autoplay' );
				cloneVideo.muted = true;
			}

			// Insert placeholder before the original, then move original to body.
			this.modalOriginalItem.parentNode.insertBefore( this.modalPlaceholder, this.modalOriginalItem );
			document.body.appendChild( this.modalOriginalItem );

			// Add modal class to the original element.
			this.modalOriginalItem.classList.add( 'godam-video-product-gallery-item--modal' );

			// Unmute and play the full video (remove 5s loop limit).
			const modalVideo = this.modalOriginalItem.querySelector( 'video' );
			if ( modalVideo ) {
				// modalVideo.muted = false;

				// Remove the 5-second preview limiter.
				if ( modalVideo._godamTimeUpdate ) {
					modalVideo.removeEventListener( 'timeupdate', modalVideo._godamTimeUpdate );
				}

				modalVideo.currentTime = 0;
				modalVideo.play().catch( () => {} );
			}

			// Show overlay, close, nav.
			this.overlay.classList.add( 'is-active' );
			this.modalCloseBtn.classList.add( 'is-active' );

			if ( this.items.length > 1 ) {
				this.modalPrevBtn.classList.add( 'is-active' );
				this.modalNextBtn.classList.add( 'is-active' );
			}

			// Trigger entry animation on next frame.
			requestAnimationFrame( () => {
				this.modalOriginalItem.classList.add( 'is-active' );
			} );

			// Lock body scroll.
			document.body.classList.add( 'godam-vpg-modal-open' );
		}

		/**
		 * Close the modal and restore the item to its gallery position.
		 */
		closeModal() {
			if ( ! this.modalOpen ) {
				return;
			}

			this.restoreCurrentItem();

			// Hide overlay, close, nav.
			this.overlay.classList.remove( 'is-active' );
			this.modalCloseBtn.classList.remove( 'is-active' );
			this.modalPrevBtn.classList.remove( 'is-active' );
			this.modalNextBtn.classList.remove( 'is-active' );

			this.modalOpen = false;
			this.modalIndex = -1;

			// Unlock body scroll.
			document.body.classList.remove( 'godam-vpg-modal-open' );
		}

		/**
		 * Restore the currently modal-ized item back to its gallery position.
		 */
		restoreCurrentItem() {
			if ( ! this.modalOriginalItem || ! this.modalPlaceholder ) {
				return;
			}

			// Remove modal classes.
			this.modalOriginalItem.classList.remove(
				'godam-video-product-gallery-item--modal',
				'is-active',
			);

			// Mute, pause, and reset the video.
			const video = this.modalOriginalItem.querySelector( 'video' );
			if ( video ) {
				video.pause();
				video.muted = true;
				video.currentTime = 0;

				// Re-attach the 5-second preview limiter if autoplay is enabled.
				if ( this.autoplay && video._godamTimeUpdate ) {
					video.addEventListener( 'timeupdate', video._godamTimeUpdate );
				}
			}

			// Move original item back into gallery (before placeholder).
			this.modalPlaceholder.parentNode.insertBefore(
				this.modalOriginalItem,
				this.modalPlaceholder,
			);

			// Remove the placeholder.
			this.modalPlaceholder.remove();
			this.modalPlaceholder = null;
			this.modalOriginalItem = null;
		}

		/**
		 * Navigate to previous or next video in the modal.
		 *
		 * @param {number} direction -1 for previous, 1 for next.
		 */
		navigateModal( direction ) {
			if ( ! this.modalOpen || this.items.length <= 1 ) {
				return;
			}

			// Restore the current item first.
			this.restoreCurrentItem();

			// Calculate new index with wrapping.
			const total = this.items.length;
			const newIndex = ( this.modalIndex + direction + total ) % total;

			// Reset state so openModal doesn't try to restore again.
			this.modalOpen = false;
			this.openModal( newIndex );
		}

		// ─────────────────────────────────────────────
		// Carousel
		// ─────────────────────────────────────────────

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

	// Initialize when DOM is ready.
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initGalleries );
	} else {
		initGalleries();
	}

	window.addEventListener( 'load', initGalleries );

	window.GodamVideoProductGallery = { init: initGalleries };
}() );
