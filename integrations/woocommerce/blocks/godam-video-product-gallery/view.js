/**
 * GoDAM Video Product Gallery - Frontend Runtime
 *
 * Handles custom video playback, add-to-cart interactions, and modal view for
 * the GoDAM Video Product Gallery block on the frontend.
 */

/* global jQuery, wc_add_to_cart_params */

( function() {
	'use strict';

	// Shared product HTML cache across all gallery instances on the page.
	const productHtmlCache = new Map();
	const PREVIEW_DURATION = 5;
	const AUTOPLAY_VISIBILITY_THRESHOLD = 0.5;
	const MOBILE_BREAKPOINT = 600;
	const SWIPE_THRESHOLD = 50; // Minimum vertical drag (px) to commit a swipe navigation.
	const WHEEL_THRESHOLD = 80; // Accumulated deltaY (px) required to trigger a wheel navigation.
	const SLIDE_DURATION_MS = 300; // Must match the CSS transition duration on the modal item.
	const SLIDE_SAFETY_MS = SLIDE_DURATION_MS + 100; // Safety timeout in case transitionend doesn't fire.
	let activeModalGallery = null;
	let sharedModalElements = null;

	/**
	 * Route document-level keyboard navigation to the currently active modal.
	 *
	 * @param {KeyboardEvent} e The keyboard event.
	 */
	function handleModalKeydown( e ) {
		if ( ! activeModalGallery || ! activeModalGallery.modalOpen ) {
			return;
		}

		if ( e.key === 'Escape' ) {
			activeModalGallery.closeModal();
		} else if ( e.key === 'ArrowLeft' || e.key === 'ArrowUp' ) {
			activeModalGallery.navigateModal( -1 );
		} else if ( e.key === 'ArrowRight' || e.key === 'ArrowDown' ) {
			activeModalGallery.navigateModal( 1 );
		}
	}

	document.addEventListener( 'keydown', handleModalKeydown );

	/**
	 * Create the shared modal shell once and reuse it across gallery instances.
	 *
	 * @return {Object} Shared modal elements.
	 */
	function getSharedModalElements() {
		if ( sharedModalElements ) {
			return sharedModalElements;
		}

		const overlay = document.createElement( 'div' );
		overlay.className = 'godam-vpg-modal-overlay';
		document.body.appendChild( overlay );

		const modalCloseBtn = document.createElement( 'button' );
		modalCloseBtn.className = 'godam-vpg-modal-close';
		modalCloseBtn.setAttribute( 'aria-label', 'Close' );
		modalCloseBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>';
		document.body.appendChild( modalCloseBtn );

		const modalWrapper = document.createElement( 'div' );
		modalWrapper.className = 'godam-vpg-modal-wrapper';
		document.body.appendChild( modalWrapper );

		const sidebar = document.createElement( 'div' );
		sidebar.className = 'godam-vpg-modal-sidebar';
		sidebar.innerHTML =
			'<div class="godam-vpg-sidebar-product">' +
			'<div class="godam-vpg-sidebar-spinner"></div>' +
			'</div>';
		modalWrapper.appendChild( sidebar );

		const modalPrevBtn = document.createElement( 'button' );
		modalPrevBtn.className = 'godam-vpg-modal-nav godam-vpg-modal-nav--prev';
		modalPrevBtn.setAttribute( 'aria-label', 'Previous video' );
		modalPrevBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>';
		document.body.appendChild( modalPrevBtn );

		const modalNextBtn = document.createElement( 'button' );
		modalNextBtn.className = 'godam-vpg-modal-nav godam-vpg-modal-nav--next';
		modalNextBtn.setAttribute( 'aria-label', 'Next video' );
		modalNextBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>';
		document.body.appendChild( modalNextBtn );

		overlay.addEventListener( 'click', () => {
			if ( activeModalGallery ) {
				activeModalGallery.closeModal();
			}
		} );

		modalCloseBtn.addEventListener( 'click', () => {
			if ( activeModalGallery ) {
				activeModalGallery.closeModal();
			}
		} );

		modalPrevBtn.addEventListener( 'click', () => {
			if ( activeModalGallery ) {
				activeModalGallery.navigateModal( -1 );
			}
		} );

		modalNextBtn.addEventListener( 'click', () => {
			if ( activeModalGallery ) {
				activeModalGallery.navigateModal( 1 );
			}
		} );

		sharedModalElements = {
			overlay,
			modalCloseBtn,
			modalWrapper,
			sidebar,
			modalPrevBtn,
			modalNextBtn,
		};

		return sharedModalElements;
	}

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
			this.wcAjaxUrl = element.dataset.wcAjaxUrl || '';
			this.productNonce = element.dataset.productNonce || '';

			// Modal state.
			this.modalOpen = false;
			this.modalIndex = -1;
			this.modalOriginalItem = null;
			this.modalPlaceholder = null;

			// Sidebar state.
			this.currentSidebarProductId = null;

			// Vertical-swipe / wheel-scroll navigation state (mobile only).
			this._swipe = { active: false, startY: 0, currentY: 0 };
			this._wheelAccumulator = 0;
			this._wheelResetTimer = null;
			this._slideNavigating = false; // Shared lock — only one slide animation at a time.

			this.createModalElements();
			this.init();
		}

		init() {
			if ( this.layout === 'carousel' ) {
				this.initCarousel();
			}

			if ( this.autoplay ) {
				this.initAutoplay();
			} else {
				this.initHoverPlay();
			}

			this.initAddToCart();
			this.initModal();
			this.initMobileSwipe();
		}

		/**
		 * Use IntersectionObserver to autoplay the first 5 seconds of each video
		 * in a loop when ≥50% visible, and pause when they scroll out of view.
		 */
		initAutoplay() {
			this.autoplayObserver = new IntersectionObserver(
				( entries ) => {
					entries.forEach( ( entry ) => {
						entry.target.dataset.isInViewport = entry.isIntersecting ? 'true' : 'false';
						this.syncPreviewVideo( entry.target, entry.isIntersecting );
					} );
				},
				{ threshold: AUTOPLAY_VISIBILITY_THRESHOLD },
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
				item.dataset.isInViewport = 'false';
				this.autoplayObserver.observe( item );
			} );
		}

		/**
		 * Play the first 5 seconds of each video in a loop on hover.
		 * Used when autoplay is disabled — videos stay paused until the user hovers.
		 */
		initHoverPlay() {
			this.items.forEach( ( item ) => {
				const video = item.querySelector( 'video' );
				if ( video ) {
					// Loop video back to start after PREVIEW_DURATION seconds.
					video._godamTimeUpdate = () => {
						if ( video.currentTime >= PREVIEW_DURATION ) {
							video.currentTime = 0;
						}
					};
					video.addEventListener( 'timeupdate', video._godamTimeUpdate );
				}

				// Play on hover.
				item.addEventListener( 'mouseenter', () => {
					this.syncPreviewVideo( item, true );
				} );

				// Stop on hover out.
				item.addEventListener( 'mouseleave', () => {
					this.syncPreviewVideo( item, false );
				} );
			} );
		}

		/**
		 * Start or stop preview playback for a gallery item.
		 *
		 * @param {Element} item The gallery item.
		 * @param {boolean} shouldPlay Whether preview playback should run.
		 */
		syncPreviewVideo( item, shouldPlay ) {
			const video = item?.querySelector( 'video' );
			if ( ! video ) {
				return;
			}

			if ( shouldPlay ) {
				video.currentTime = 0;
				video.play().catch( () => {} );
				return;
			}

			video.pause();
			video.currentTime = 0;
		}

		/**
		 * Sync preview playback for every gallery item using the latest observer state.
		 */
		syncVisiblePreviewVideos() {
			if ( ! this.autoplay ) {
				return;
			}

			this.items.forEach( ( item ) => {
				this.syncPreviewVideo( item, item.dataset.isInViewport === 'true' );
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

			fetch( this.getWcAjaxEndpoint( 'add_to_cart' ), {
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
					this.updateCartFragments( data.fragments );

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
		 * Resolve a WooCommerce AJAX endpoint in a way that works for subdirectory installs.
		 *
		 * @param {string} endpoint The WooCommerce AJAX endpoint name.
		 * @return {string} The resolved endpoint URL.
		 */
		getWcAjaxEndpoint( endpoint ) {
			if (
				typeof wc_add_to_cart_params !== 'undefined' &&
				wc_add_to_cart_params &&
				wc_add_to_cart_params.wc_ajax_url
			) {
				return wc_add_to_cart_params.wc_ajax_url.replace( '%%endpoint%%', endpoint );
			}

			if ( this.wcAjaxUrl ) {
				return this.wcAjaxUrl.replace( '%%endpoint%%', endpoint );
			}

			return `/?wc-ajax=${ endpoint }`;
		}

		/**
		 * Apply WooCommerce cart fragments to the DOM (classic theme cart widgets).
		 *
		 * @param {Object|undefined} fragments Key→HTML map returned by the add-to-cart AJAX endpoint.
		 */
		updateCartFragments( fragments ) {
			if ( ! fragments || typeof jQuery === 'undefined' ) {
				return;
			}
			jQuery.each( fragments, ( key, value ) => {
				jQuery( key ).replaceWith( value );
			} );
			jQuery( document.body ).trigger( 'wc_fragments_refreshed' );
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
			const modalElements = getSharedModalElements();

			this.overlay = modalElements.overlay;
			this.modalCloseBtn = modalElements.modalCloseBtn;
			this.modalWrapper = modalElements.modalWrapper;
			this.sidebar = modalElements.sidebar;
			this.modalPrevBtn = modalElements.modalPrevBtn;
			this.modalNextBtn = modalElements.modalNextBtn;
		}

		/**
		 * Attach event handlers to open the modal when tapping or clicking a gallery item.
		 *
		 * On touch devices, Video.js intercepts bubble-phase touch events and begins
		 * playback before a synthetic click can fire. We therefore register capture-phase
		 * touchstart/touchend listeners on the wrapper so we see the gesture first.
		 * If the touch qualifies as a tap (minimal movement), we call preventDefault() and
		 * stopPropagation() to prevent Video.js from reacting, then open the modal.
		 * A regular click handler covers pointer (desktop/mouse) devices.
		 */
		initModal() {
			this.items.forEach( ( item, index ) => {
				const videoWrapper = item.querySelector( '.godam-gallery-item__video-wrapper' );
				if ( ! videoWrapper ) {
					return;
				}

				videoWrapper.style.cursor = 'pointer';

				// Track where the touch started so we can distinguish a tap from a scroll.
				let tapStartX = 0;
				let tapStartY = 0;

				// Capture-phase: record start position before any inner listener sees it.
				videoWrapper.addEventListener( 'touchstart', ( e ) => {
					if ( item.classList.contains( 'godam-video-product-gallery-item--modal' ) ) {
						return; // Already in modal — let the player handle normally.
					}
					tapStartX = e.touches[ 0 ].clientX;
					tapStartY = e.touches[ 0 ].clientY;
				}, { passive: true, capture: true } );

				// Capture-phase: intercept the tap before Video.js can play the video.
				videoWrapper.addEventListener( 'touchend', ( e ) => {
					if ( item.classList.contains( 'godam-video-product-gallery-item--modal' ) ) {
						return; // Already in modal — let the player handle normally.
					}

					// Ignore taps on product info / add-to-cart.
					if (
						e.target.closest( '.godam-gallery-item__product' ) ||
						e.target.closest( '.godam-gallery-item__add-to-cart' )
					) {
						return;
					}

					const touch = e.changedTouches[ 0 ];
					const moved = Math.abs( touch.clientX - tapStartX ) + Math.abs( touch.clientY - tapStartY );

					// Only treat as a tap when the finger barely moved (< 10 px total).
					if ( moved < 10 ) {
						e.preventDefault(); // Stops the synthetic click from reaching Video.js.
						e.stopPropagation(); // Stops inner Video.js touch listeners.
						this.openModal( index );
					}
				}, { passive: false, capture: true } );

				// Desktop / pointer device click handler.
				videoWrapper.addEventListener( 'click', ( e ) => {
					// Don't open modal if clicking on player controls.
					if (
						e.target.closest( '.godam-gallery-item__product' ) ||
						e.target.closest( '.godam-gallery-item__add-to-cart' )
					) {
						return;
					}

					// Already in modal — let the video player handle the click.
					if ( item.classList.contains( 'godam-video-product-gallery-item--modal' ) ) {
						return;
					}

					this.openModal( index );
				} );
			} );
		}

		/**
		 * Open the modal for a given item index.
		 *
		 * @param {number} index The index of the item to show in the modal.
		 */
		openModal( index ) {
			if ( activeModalGallery && activeModalGallery !== this ) {
				activeModalGallery.closeModal();
			}

			// If already open with a different item, restore the current one first.
			if ( this.modalOpen ) {
				this.restoreCurrentItem();
			}

			this.modalIndex = index;
			this.modalOpen = true;
			this.modalOriginalItem = this.items[ index ];
			activeModalGallery = this;

			// Pause all gallery preview videos.
			this.items.forEach( ( item ) => {
				this.syncPreviewVideo( item, false );
			} );

			// Create a placeholder clone to maintain gallery layout.
			this.modalPlaceholder = this.modalOriginalItem.cloneNode( true );
			this.modalPlaceholder.classList.add( 'godam-video-product-gallery-item--placeholder' );

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
			if ( activeModalGallery === this ) {
				activeModalGallery = null;
			}

			// Unlock body scroll.
			document.body.classList.remove( 'godam-vpg-modal-open' );

			this.syncVisiblePreviewVideos();
		}

		/**
		 * Restore the currently modal-ized item back to its gallery position.
		 */
		restoreCurrentItem() {
			if ( ! this.modalOriginalItem || ! this.modalPlaceholder ) {
				return;
			}

			const restoredItem = this.modalOriginalItem;

			// Remove modal classes.
			restoredItem.classList.remove(
				'godam-video-product-gallery-item--modal',
				'is-active',
			);

			// Clear any inline swipe/animation styles.
			restoredItem.style.transform = '';
			restoredItem.style.opacity = '';
			restoredItem.style.transition = '';

			// Mute, pause, and reset the video.
			const video = restoredItem.querySelector( 'video' );
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
				restoredItem,
				this.modalPlaceholder,
			);

			// Remove the placeholder.
			this.modalPlaceholder.remove();
			this.modalPlaceholder = null;
			this.modalOriginalItem = null;
		}

		/**
		 * Attach touch event listeners on the modal wrapper for vertical swipe
		 * navigation on mobile (≤ 600px). Swipe up → next, swipe down → previous.
		 */
		initMobileSwipe() {
			const wrapper = this.modalWrapper;
			if ( ! wrapper ) {
				return;
			}

			wrapper.addEventListener( 'touchstart', ( e ) => {
				if ( ! this._isMobileActive() ) {
					return;
				}

				// Block new swipe while a slide animation is in progress.
				if ( this._slideNavigating ) {
					return;
				}

				// Ignore touches on player controls.
				if ( e.target.closest( '.vjs-control-bar' ) || e.target.closest( '.godam-gallery-item__product' ) ) {
					return;
				}

				this._swipe.active = true;
				this._swipe.startY = e.touches[ 0 ].clientY;
				this._swipe.currentY = this._swipe.startY;

				// Disable the CSS transition while dragging for real-time tracking.
				if ( this.modalOriginalItem ) {
					this.modalOriginalItem.style.transition = 'none';
				}
			}, { passive: true } );

			wrapper.addEventListener( 'touchmove', ( e ) => {
				if ( ! this._swipe.active ) {
					return;
				}

				this._swipe.currentY = e.touches[ 0 ].clientY;
				const deltaY = this._swipe.currentY - this._swipe.startY;

				// Apply a dampened translateY so the item follows the finger.
				if ( this.modalOriginalItem ) {
					this.modalOriginalItem.style.transform = `translateY(${ deltaY * 0.4 }px)`;
					this.modalOriginalItem.style.opacity = Math.max( 0.4, 1 - ( Math.abs( deltaY ) / 600 ) );
				}
			}, { passive: true } );

			wrapper.addEventListener( 'touchend', () => {
				if ( ! this._swipe.active ) {
					return;
				}

				this._swipe.active = false;

				// If another slide started already, just clean up.
				if ( this._slideNavigating ) {
					this.resetSwipeTransform();
					return;
				}

				const deltaY = this._swipe.currentY - this._swipe.startY;

				if ( Math.abs( deltaY ) >= SWIPE_THRESHOLD ) {
					// Swipe up (negative delta) → next (+1), swipe down → previous (-1).
					const direction = deltaY < 0 ? 1 : -1;
					this.navigateModalWithSlide( direction );
				} else {
					// Snap back — not enough distance.
					this.resetSwipeTransform();
				}
			}, { passive: true } );

			wrapper.addEventListener( 'touchcancel', () => {
				if ( this._swipe.active ) {
					this._swipe.active = false;
					this.resetSwipeTransform();
				}
			}, { passive: true } );

			// Wheel / trackpad scroll navigation on small screens.
			wrapper.addEventListener( 'wheel', ( e ) => {
				if ( ! this._isMobileActive() ) {
					return;
				}

				// Don't trigger a new navigation while one is still animating.
				if ( this._slideNavigating ) {
					e.preventDefault();
					return;
				}

				e.preventDefault();

				// Accumulate scroll delta (supports both mouse wheel and trackpad).
				this._wheelAccumulator += e.deltaY;

				// Reset accumulator after a short idle (new scroll gesture).
				clearTimeout( this._wheelResetTimer );
				this._wheelResetTimer = setTimeout( () => {
					this._wheelAccumulator = 0;
				}, 200 );

				if ( Math.abs( this._wheelAccumulator ) >= WHEEL_THRESHOLD ) {
					const direction = this._wheelAccumulator > 0 ? 1 : -1;
					this._wheelAccumulator = 0;

					this.navigateModalWithSlide( direction );
				}
			}, { passive: false } );
		}

		/**
		 * Returns true when mobile swipe / wheel navigation should be active.
		 * Centralises the repeated guard check used by touch and wheel handlers.
		 *
		 * @return {boolean} Whether mobile swipe navigation is currently applicable.
		 */
		_isMobileActive() {
			return this.modalOpen && window.innerWidth <= MOBILE_BREAKPOINT && this.items.length > 1;
		}

		/**
		 * Reset wheel accumulator and timer so continued scrolling after an
		 * animation cannot immediately re-trigger navigation.
		 */
		resetWheelState() {
			clearTimeout( this._wheelResetTimer );
			this._wheelResetTimer = null;
			this._wheelAccumulator = 0;
		}

		/**
		 * Release the slide-navigation lock and flush wheel state so the next
		 * gesture starts clean.
		 */
		_releaseSlideLock() {
			this.resetWheelState();
			this._slideNavigating = false;
		}

		/**
		 * Reset the modal item's transform and opacity back to default with a transition.
		 */
		resetSwipeTransform() {
			if ( ! this.modalOriginalItem ) {
				return;
			}

			this.modalOriginalItem.style.transition = 'transform 0.25s ease, opacity 0.25s ease';
			this.modalOriginalItem.style.transform = '';
			this.modalOriginalItem.style.opacity = '';
		}

		/**
		 * Navigate with a vertical slide animation (mobile only).
		 * Slides the current item out, swaps the content, then slides the new item in.
		 *
		 * @param {number} direction -1 for previous (slide down), 1 for next (slide up).
		 */
		navigateModalWithSlide( direction ) {
			if ( ! this.modalOpen || ! this.modalOriginalItem ) {
				return;
			}

			// Prevent overlapping navigations.
			if ( this._slideNavigating ) {
				return;
			}
			this._slideNavigating = true;

			const item = this.modalOriginalItem;
			const slideOutY = direction > 0 ? '-100%' : '100%';

			// Animate current item out.
			item.style.transition = `transform ${ SLIDE_DURATION_MS }ms ease, opacity ${ SLIDE_DURATION_MS }ms ease`;
			item.style.transform = `translateY(${ slideOutY })`;
			item.style.opacity = '0';

			// After the exit animation, swap and slide in the new item.
			const onExitEnd = () => {
				item.removeEventListener( 'transitionend', onExitEnd );

				// Swap content via navigateModal.
				this.navigateModal( direction );

				// Position the new item off-screen on the entry side and animate in.
				const newItem = this.modalOriginalItem;
				if ( newItem ) {
					const slideInY = direction > 0 ? '100%' : '-100%';
					newItem.style.transition = 'none';
					newItem.style.transform = `translateY(${ slideInY })`;
					newItem.style.opacity = '0';

					requestAnimationFrame( () => {
						newItem.style.transition = `transform ${ SLIDE_DURATION_MS }ms ease, opacity ${ SLIDE_DURATION_MS }ms ease`;
						newItem.style.transform = '';
						newItem.style.opacity = '';

						// Release the lock once the entry animation ends.
						const onEntryEnd = () => {
							newItem.removeEventListener( 'transitionend', onEntryEnd );
							this._releaseSlideLock();
						};
						newItem.addEventListener( 'transitionend', onEntryEnd, { once: true } );

						// Safety fallback in case transitionend doesn't fire.
						setTimeout( () => {
							newItem.removeEventListener( 'transitionend', onEntryEnd );
							this._releaseSlideLock();
						}, SLIDE_SAFETY_MS );
					} );
				} else {
					this._releaseSlideLock();
				}
			};

			item.addEventListener( 'transitionend', onExitEnd, { once: true } );

			// Safety timeout in case transitionend doesn't fire.
			setTimeout( () => {
				item.removeEventListener( 'transitionend', onExitEnd );
				if ( this.modalOpen && this.modalOriginalItem === item ) {
					onExitEnd();
				}
			}, SLIDE_SAFETY_MS );
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

					fetch( this.getWcAjaxEndpoint( 'add_to_cart' ), {
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
