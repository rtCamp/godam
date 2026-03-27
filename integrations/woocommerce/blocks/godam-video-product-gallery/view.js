/**
 * GoDAM Video Product Gallery - Frontend Runtime
 *
 * Handles custom video playback and add-to-cart interactions for
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
			this.items = element.querySelectorAll( '.godam-video-product-gallery-item' );
			this.prevBtn = element.querySelector( '.godam-video-product-gallery__nav--prev' );
			this.nextBtn = element.querySelector( '.godam-video-product-gallery__nav--next' );
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
					// Reset to the beginning once the preview duration is reached.
					video.addEventListener( 'timeupdate', () => {
						if ( video.currentTime >= PREVIEW_DURATION ) {
							video.currentTime = 0;
						}
					} );
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
