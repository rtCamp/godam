/**
 * GoDAM Video Product Gallery - Frontend Runtime
 *
 * Handles custom video playback, add-to-cart interactions, and modal view for
 * the GoDAM Video Product Gallery block on the frontend.
 */

/* global jQuery */

( function() {
	'use strict';

	// Shared product HTML cache across all gallery instances on the page.
	const productHtmlCache = new Map();

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

			// AJAX configuration from data attributes.
			this.ajaxUrl = element.dataset.ajaxUrl || '';
			this.productNonce = element.dataset.productNonce || '';

			// Modal state.
			this.modalOpen = false;
			this.modalIndex = -1;
			this.modalOriginalItem = null;
			this.modalPlaceholder = null;

			// Sidebar state.
			this.currentSidebarProductId = null;

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
		 * Create modal UI elements (overlay, close, wrapper with sidebar, prev/next) and append to body.
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

			// Modal wrapper — holds promoted video item + sidebar.
			this.modalWrapper = document.createElement( 'div' );
			this.modalWrapper.className = 'godam-vpg-modal-wrapper';
			document.body.appendChild( this.modalWrapper );

			// Sidebar element inside the wrapper.
			this.sidebar = document.createElement( 'div' );
			this.sidebar.className = 'godam-vpg-modal-sidebar';
			this.sidebar.innerHTML =
				'<div class="godam-vpg-sidebar-product">' +
				'<div class="godam-vpg-sidebar-spinner"></div>' +
				'</div>';
			this.modalWrapper.appendChild( this.sidebar );

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

			// Insert placeholder before the original, then move original into modal wrapper.
			this.modalOriginalItem.parentNode.insertBefore( this.modalPlaceholder, this.modalOriginalItem );
			this.modalWrapper.prepend( this.modalOriginalItem );

			// Add modal class to the original element.
			this.modalOriginalItem.classList.add( 'godam-video-product-gallery-item--modal' );

			// Unmute and play the full video (remove 5s loop limit).
			const modalVideo = this.modalOriginalItem.querySelector( 'video' );
			if ( modalVideo ) {
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

			// Trigger entry animation on the wrapper.
			requestAnimationFrame( () => {
				this.modalWrapper.classList.add( 'is-active' );
			} );

			// Lock body scroll.
			document.body.classList.add( 'godam-vpg-modal-open' );

			// Load sidebar product when a product is assigned.
			const productId = this.items[ index ]?.dataset?.productId;
			const hasProduct = productId && productId !== '0';

			if ( hasProduct ) {
				this.showSidebar( productId );
			} else {
				this.hideSidebar();
			}

			// Always prefetch adjacent products for instant navigation on next/prev.
			this.prefetchAdjacentProducts( index );
		}

		/**
		 * Close the modal and restore the item to its gallery position.
		 */
		closeModal() {
			if ( ! this.modalOpen ) {
				return;
			}

			this.restoreCurrentItem();

			// Hide overlay, close, nav, wrapper.
			this.overlay.classList.remove( 'is-active' );
			this.modalCloseBtn.classList.remove( 'is-active' );
			this.modalPrevBtn.classList.remove( 'is-active' );
			this.modalNextBtn.classList.remove( 'is-active' );
			this.modalWrapper.classList.remove( 'is-active' );

			// Hide sidebar.
			this.hideSidebar();

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
		// Product Sidebar — fetch, cache, render
		// ─────────────────────────────────────────────

		/**
		 * Fetch product HTML for a given product ID, using cache when available.
		 *
		 * @param {number|string} productId The product ID to fetch.
		 * @return {Promise<string|null>} The product HTML string, or null on failure.
		 */
		async fetchProductHtml( productId ) {
			if ( ! productId ) {
				return null;
			}

			const cacheKey = String( productId );

			// Return cached HTML if available.
			if ( productHtmlCache.has( cacheKey ) ) {
				return productHtmlCache.get( cacheKey );
			}

			// Require AJAX configuration.
			if ( ! this.ajaxUrl || ! this.productNonce ) {
				return null;
			}

			try {
				const url =
					this.ajaxUrl +
					'?action=godam_get_single_sidebar_product_html' +
					'&product_id=' + encodeURIComponent( productId ) +
					'&_wpnonce=' + encodeURIComponent( this.productNonce );

				const response = await fetch( url, { credentials: 'same-origin' } );
				const result = await response.json();

				if ( result.success && result.data ) {
					productHtmlCache.set( cacheKey, result.data );
					return result.data;
				}
			} catch ( err ) {
				// Silently fail — sidebar won't show for this product.
			}

			return null;
		}

		/**
		 * Prefetch product HTML for adjacent gallery items (previous and next).
		 * Fire-and-forget — results are stored in cache for instant access on navigation.
		 *
		 * @param {number} index The current item index.
		 */
		prefetchAdjacentProducts( index ) {
			if ( this.items.length <= 1 ) {
				return;
			}

			const total = this.items.length;
			const adjacentIndices = [
				( index - 1 + total ) % total,
				( index + 1 ) % total,
			];

			adjacentIndices.forEach( ( i ) => {
				const pid = this.items[ i ]?.dataset?.productId;
				if ( pid && pid !== '0' && ! productHtmlCache.has( String( pid ) ) ) {
					this.fetchProductHtml( pid ); // Fire-and-forget.
				}
			} );
		}

		/**
		 * Show the sidebar with product content for the given product ID.
		 *
		 * @param {number|string} productId The product ID to display.
		 */
		async showSidebar( productId ) {
			if ( ! this.sidebar || ! productId ) {
				this.hideSidebar();
				return;
			}

			// Track which product we're loading to guard against race conditions.
			this.currentSidebarProductId = productId;

			const productContent = this.sidebar.querySelector( '.godam-vpg-sidebar-product' );

			// Show sidebar with loading spinner.
			this.sidebar.classList.add( 'is-active' );
			productContent.innerHTML = '<div class="godam-vpg-sidebar-spinner"></div>';

			// Fetch product HTML (from cache or AJAX).
			const html = await this.fetchProductHtml( productId );

			// Guard: make sure the modal is still open for this product.
			if ( this.currentSidebarProductId !== productId || ! this.modalOpen ) {
				return;
			}

			if ( html ) {
				productContent.innerHTML = html;
				this.initSidebarInteractions();
			} else {
				this.hideSidebar();
			}
		}

		/**
		 * Hide the product sidebar.
		 */
		hideSidebar() {
			if ( this.sidebar ) {
				this.sidebar.classList.remove( 'is-active' );
			}
			this.currentSidebarProductId = null;
		}

		/**
		 * Initialize all interactive elements within the sidebar after AJAX content is injected.
		 * Handles: collapsible toggle, image gallery thumbnails, and add-to-cart buttons.
		 */
		initSidebarInteractions() {
			if ( ! this.sidebar ) {
				return;
			}

			// Collapsible toggle.
			const toggle = this.sidebar.querySelector( '.godam-sidebar-product-toggle' );
			if ( toggle ) {
				toggle.addEventListener( 'click', () => {
					const expanded = toggle.dataset.expanded === 'true';
					toggle.dataset.expanded = expanded ? 'false' : 'true';

					// Toggle collapsed class on content sections.
					const sections = this.sidebar.querySelectorAll(
						'.godam-image-gallery, .godam-single-product-sidebar-content, .godam-sidebar-multiple-list',
					);
					sections.forEach( ( el ) => {
						el.classList.toggle( 'is-collapsed', expanded );
					} );
				} );
			}

			// Image gallery — thumbnail click to swap main image.
			const mainImage = this.sidebar.querySelector( '.godam-main-image img' );
			const thumbnails = this.sidebar.querySelectorAll( '.godam-thumbnail-item' );
			if ( mainImage && thumbnails.length ) {
				thumbnails.forEach( ( thumb ) => {
					thumb.addEventListener( 'click', () => {
						const img = thumb.querySelector( 'img' );
						if ( img ) {
							mainImage.src = img.src;
						}
						thumbnails.forEach( ( t ) => t.classList.remove( 'active' ) );
						thumb.classList.add( 'active' );
					} );
				} );
			}

			// Image gallery — prev/next nav buttons.
			const track = this.sidebar.querySelector( '.godam-thumbnail-track' );
			const prevNav = this.sidebar.querySelector( '.godam-thumbnail-prev' );
			const nextNav = this.sidebar.querySelector( '.godam-thumbnail-next' );
			if ( track ) {
				if ( prevNav ) {
					prevNav.addEventListener( 'click', () => {
						track.scrollBy( { left: -120, behavior: 'smooth' } );
					} );
				}
				if ( nextNav ) {
					nextNav.addEventListener( 'click', () => {
						track.scrollBy( { left: 120, behavior: 'smooth' } );
					} );
				}
			}

			// Add to cart buttons inside the sidebar.
			const cartButtons = this.sidebar.querySelectorAll( '.godam-product-sidebar-add-to-cart-button' );
			cartButtons.forEach( ( btn ) => {
				btn.addEventListener( 'click', () => {
					const pid = btn.dataset.productId;
					if ( ! pid || btn.classList.contains( 'loading' ) ) {
						return;
					}

					btn.classList.add( 'loading' );

					fetch( '/?wc-ajax=add_to_cart', {
						method: 'POST',
						headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
						body: new URLSearchParams( { product_id: pid, quantity: 1 } ),
						credentials: 'same-origin',
					} )
						.then( ( response ) => response.json() )
						.then( ( data ) => {
							btn.classList.remove( 'loading' );
							if ( data.error ) {
								return;
							}

							// Update WooCommerce cart fragments.
							if ( data.fragments && typeof jQuery !== 'undefined' ) {
								jQuery.each( data.fragments, ( key, value ) => {
									jQuery( key ).replaceWith( value );
								} );
								jQuery( document.body ).trigger( 'wc_fragments_refreshed' );
							}

							this.openMiniCart();
						} )
						.catch( () => {
							btn.classList.remove( 'loading' );
						} );
				} );
			} );
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
