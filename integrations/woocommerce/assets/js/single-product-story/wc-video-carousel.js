/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-console */
/* eslint-disable no-unused-vars */
/* global Swiper */

const { dispatch } = wp.data;

/**
 * Internal dependencies
 */
import { initSidebar, loadSidebarProducts, resetSidebarState } from '../global-video-popup/sidebar.js';
import { resetVideoModal, loadNewVideo, initScrollSwipeNavigation } from '../global-video-popup/video-modal.js';
import { registerEscapeHandler, unregisterEscapeHandler } from '../global-video-popup/escapeManager.js';

/**
 * Initializes and manages the video carousel functionality for WooCommerce.
 * This function sets up the carousel, handles events, and ensures smooth video playback.
 */
const wcVideoCarousel = {

	// Video carousel and modal elements.
	swiper: null,
	swiperModal: null,
	swiperModalMini: null,

	/**
	 * Initiate the video carousel and show controls on mouse enter.
	 * Uses Swiper for the carousel.
	 */
	init() {
		const self = this;
		// Load after DOM is ready.
		document.addEventListener( 'DOMContentLoaded', () => {
			self.loadVideoCarousel();
			self.openVideoModal();
			self.closeVideoModal();
			self.addToCartSimple();
		} );
	},

	/**
	 * Initializes the video carousel and slider.
	 * Uses Swiper for the carousel.
	 */
	loadVideoCarousel() {
		if ( 'undefined' === typeof Swiper ) {
			// Swiper failed to load; skip initialization to avoid runtime errors.
			console.warn( 'Swiper library is not available; skipping video carousel init.' );
			return;
		}

		const self = this;
		const slides = document.querySelectorAll( '.rtgodam-product-video-gallery-slider .swiper-slide' );
		const enableLoop = slides.length > 0;
		this.swiper = new Swiper( '.rtgodam-product-video-gallery-slider', {
			loop: enableLoop,
			navigation: {
				nextEl: '.swiper-button-next',
				prevEl: '.swiper-button-prev',
			},
			slidesPerView: 3,
			spaceBetween: 10,
			grabCursor: true,
			freeMode: true,
			autoplay: false,
			breakpoints: {
				0: {
					slidesPerView: 2,
				},
				640: {
					slidesPerView: 3,
				},
				1024: {
					slidesPerView: 3,
				},
			},
			on: {
				beforeInit() {
					self.hideLoading();
				},
			},
		} );
	},

	/**
	 * Show a modal with a video player when a video is clicked.
	 *
	 * Listens for clicks on video elements in the video carousel, and shows a modal
	 * with a video player when a video is clicked.
	 *
	 * @return {void}
	 */
	openVideoModal() {
		const self = this;
		// Show control only when enter on video.
		document.querySelectorAll( '.rtgodam-product-video-gallery-slider .swiper-slide' ).forEach( ( video ) => {
			video.addEventListener( 'click', ( event ) => {
				event.preventDefault();

				if ( 'undefined' === typeof Swiper ) {
					console.warn( 'Swiper library is not available; skipping modal slider init.' );
					return;
				}

				const modalSlides = document.querySelectorAll( '.rtgodam-product-video-gallery-slider-modal-content-items .swiper-slide' );
				const enableModalLoop = modalSlides.length > 0;
				self.swiperModal = new Swiper( '.rtgodam-product-video-gallery-slider-modal-content-items', {
					loop: enableModalLoop,
					navigation: {
						nextEl: '.swiper-button-next',
						prevEl: '.swiper-button-prev',
					},
					freeMode: true,
					noSwiping: true,
					noSwipingClass: 'flex-control-nav',
					touchStartPreventDefault: false, // let native scroll kick in
					threshold: 5,
					autoplay: false,
					on: {
						init() {
							wcVideoCarousel.handleSlideVisibility( this );
						},

						slideChange() {
							wcVideoCarousel.handleSlideVisibility( this );
						},
					},
				} );
				const clickedSlide = event.target.closest( '.swiper-slide' );
				const itemIndex = parseInt(
					clickedSlide.getAttribute( 'data-swiper-slide-index' ),
				);
				if ( enableModalLoop ) {
					self.swiperModal.slideToLoop( itemIndex );
				} else {
					self.swiperModal.slideTo( itemIndex );
				}

				// Run the check immediately for the first slide.
				const firstSlide = self.swiperModal.slides[ self.swiperModal.activeIndex ];
				if ( firstSlide ) {
					const isTranscoded = firstSlide.getAttribute( 'data-is-transcoded' ) === 'true';
					const closeBtn = document.querySelector( '.rtgodam-product-video-gallery-slider-modal-close' );
					if ( closeBtn ) {
						closeBtn.classList.toggle( 'godam-transcoded', isTranscoded );
					}
				}

				const videoElmModal = document.querySelector( '.rtgodam-product-video-gallery-slider-modal' );
				videoElmModal.classList.add( 'open' );

				if ( window.matchMedia( '(max-width: 550px)' ).matches ) {
					const fullscreenBtn = videoElmModal.querySelector(
						'.rtgodam-product-video-gallery-slider-modal-fullscreen',
					);

					if ( fullscreenBtn ) {
						// Small timeout ensures swiper + videojs initialized
						setTimeout( () => {
							fullscreenBtn.click();
						}, 50 );
					}
				}
			} );
		} );
	},

	/**
	 * Handles visibility and fullscreen behavior for the active Swiper slide.
	 *
	 * This method:
	 * - Validates the provided Swiper instance.
	 * - Retrieves the currently active slide.
	 * - Locates the video.js element inside the active slide.
	 * - Finds the fullscreen button within the modal.
	 * - Initializes the video.js player instance.
	 * - Attaches fullscreen visibility and click handlers.
	 *
	 * Early returns are used to safely exit if required DOM elements,
	 * the Swiper instance, or the video.js library are unavailable.
	 *
	 * @param {Object} swiperInstance - The active Swiper instance controlling the video slides.
	 * @return {void}
	 */
	handleSlideVisibility( swiperInstance ) {
		if ( ! swiperInstance ) {
			return;
		}

		const videoElmModal = document.querySelector(
			'.rtgodam-product-video-gallery-slider-modal',
		);

		if ( ! videoElmModal ) {
			return;
		}

		const activeSlide = swiperInstance.slides[ swiperInstance.activeIndex ];

		if ( ! activeSlide ) {
			return;
		}

		const videoEl = activeSlide.querySelector( '.video-js' );

		const button = videoElmModal.querySelector(
			'.rtgodam-product-video-gallery-slider-modal-fullscreen',
		);

		if ( ! videoEl || ! button ) {
			return;
		}

		if ( typeof window.videojs === 'undefined' ) {
			return;
		}

		const player = window.videojs( videoEl );

		this.attachFullscreenVisibility( player, button );
		this.attachFullscreenClickHandler( swiperInstance, button );
	},

	/**
	 * Removes the loading class from the video gallery slider.
	 *
	 * This method is used to hide the loading overlay on the video
	 * gallery slider once the Swiper instance is initialized.
	 */

	hideLoading() {
		const rtgodamProductVideoGallerySlider = document.querySelector( '.rtgodam-product-video-gallery-slider' );
		rtgodamProductVideoGallerySlider?.classList.remove( 'rtgodam-product-video-gallery-slider-loading' );
	},

	/**
	 * Removes the video modal from the DOM when the close button is clicked.
	 *
	 * The modal is created when a video is clicked in the video carousel.
	 * This method is used to clean up the DOM when the modal is closed.
	 */
	closeVideoModal() {
		const self = this;
		const videoElmModal = document.querySelector( '.rtgodam-product-video-gallery-slider-modal' );
		const videoElmModalClose = document.querySelector( '.rtgodam-product-video-gallery-slider-modal-close' );

		function handleClose( event ) {
			event?.preventDefault?.();

			const videoEls = videoElmModal.querySelectorAll( '.video-js' );

			videoEls.forEach( ( videoEl ) => {
				if ( typeof window.videojs !== 'undefined' ) {
					const player = window.videojs( videoEl );

					if ( player ) {
						player.pause();
						player.currentTime( 0 );
					}
				}
			} );

			videoElmModal.classList.remove( 'open' );
			if ( self.swiperModal ) {
				self.swiperModal.destroy( true, true );
				self.swiperModal = null;
			}
		}

		function handleEscape( e ) {
			if ( e.key === 'Escape' || e.key === 'Esc' ) {
				handleClose();
			}
		}

		// Close on button click.
		videoElmModalClose?.addEventListener( 'click', handleClose );

		// Close on Escape key.
		document.addEventListener( 'keydown', handleEscape );
	},

	/**
	 * Displays a temporary cart notification message.
	 *
	 * Creates a notice element, shows it with animation,
	 * and automatically removes it after a short delay.
	 *
	 * @param {string} message          - The message to display.
	 * @param {string} [type='success'] - The notice type (e.g., 'success', 'error').
	 * @return {void}
	 */
	showCartNotice( message, type = 'success' ) {
		const notice = document.createElement( 'div' );
		notice.className = `godam-cart-notice ${ type }`;
		notice.innerText = message;

		document.body.appendChild( notice );

		setTimeout( () => {
			notice.classList.add( 'show' );
		}, 10 );

		setTimeout( () => {
			notice.classList.remove( 'show' );
			setTimeout( () => notice.remove(), 300 );
		}, 2500 );
	},

	addToCartSimple() {
		document.addEventListener( 'click', async ( e ) => {
			const button = e.target.closest( '.rtgodam-modal-add-to-cart' );
			if ( ! button ) {
				return;
			}

			const productId = button.dataset.productId;
			const productType = button.dataset.productType;
			const firstVariationId = button.dataset.firstVariationId;
			const groupedIds = button.dataset.groupedIds;
			const externalUrl = button.dataset.externalUrl;
			const inStock = button.dataset.inStock === 'true';

			console.log( inStock );

			// OUT OF STOCK
			if ( ! inStock ) {
				this.showCartNotice( 'Product is out of stock', 'error' );
				return;
			}

			// EXTERNAL PRODUCT
			if ( productType === 'external' && externalUrl ) {
				window.location.href = externalUrl;
				return;
			}

			const cartStore = dispatch( 'wc/store/cart' );

			if ( ! cartStore ) {
				this.showCartNotice( 'Cart not available', 'error' );
				return;
			}

			button.disabled = true;
			button.classList.add( 'loading' );

			try {
				let successMessage = 'Added to cart successfully';

				if ( productType === 'variable' && firstVariationId ) {
					await cartStore.addItemToCart( firstVariationId, 1 );
					successMessage = 'First Variation added to cart';
				} else if ( productType === 'grouped' && groupedIds ) {
					const ids = groupedIds
						.split( ',' )
						.map( ( id ) => id.trim() )
						.filter( ( id ) => id );

					if ( ! ids.length ) {
						throw new Error( 'No grouped products found' );
					}

					let successCount = 0;

					for ( const id of ids ) {
						try {
							await cartStore.addItemToCart( id, 1 );
							successCount++;
						} catch ( err ) {
							console.warn( `Failed to add grouped item ${ id }`, err );
						}
					}

					if ( successCount === 0 ) {
						throw new Error( 'All grouped products failed' );
					}

					successMessage = `${ successCount } item${ successCount > 1 ? 's' : '' } added to cart`;
				} else {
					await cartStore.addItemToCart( productId, 1 );
					successMessage = 'Product added to cart';
				}

				this.showCartNotice( successMessage );
			} catch ( err ) {
				console.error( err );
				this.showCartNotice( 'Failed to add to cart', 'error' );
			} finally {
				button.disabled = false;
				button.classList.remove( 'loading' );
			}
		} );
	},

	/**
	 * Attaches a delegated click listener to handle modal "Add to Cart" actions.
	 *
	 * This method:
	 * - Listens for clicks on `.rtgodam-modal-add-to-cart` buttons.
	 * - Handles different WooCommerce product types (simple, variable, grouped, external).
	 * - Validates stock status before proceeding.
	 * - Redirects for external products.
	 * - Adds products to the WooCommerce Store API cart.
	 * - Displays success or error notices.
	 * - Manages loading state and button disabling during async operations.
	 *
	 * Gracefully handles grouped product partial failures and ensures
	 * UI state is restored after completion.
	 *
	 * @param {Object}      player - The video.js player instance.
	 * @param {HTMLElement} button - The fullscreen button element.
	 *
	 * @return {void}
	 */
	attachFullscreenVisibility( player, button ) {
		if ( ! player || ! button ) {
			return;
		}

		let hideTimeout = null;

		const showButton = () => {
			if ( hideTimeout ) {
				clearTimeout( hideTimeout );
				hideTimeout = null;
			}
			button.style.opacity = '1';
			button.style.pointerEvents = 'auto';
		};

		const hideButton = () => {
			button.style.opacity = '0';
			button.style.pointerEvents = 'none';
		};

		// When Video.js detects inactivity.
		player.on( 'userinactive', () => {
			if ( player.paused() || player.ended() ) {
				return;
			}

			// Add small delay BEFORE hiding.
			hideTimeout = setTimeout( () => {
				hideButton();
			}, 100 );
		} );

		// When user becomes active again.
		player.on( 'useractive', () => {
			showButton();
		} );

		// When paused → always visible.
		player.on( 'pause', () => {
			showButton();
		} );

		// When ended → always visible.
		player.on( 'ended', () => {
			showButton();
		} );

		// Initial state
		showButton();
	},

	/**
	 * Attaches a fullscreen click handler to the provided button for the active Swiper slide.
	 *
	 * This method:
	 * - Safely removes any previously attached fullscreen handler to prevent duplicates.
	 * - Retrieves the currently active slide from the Swiper instance.
	 * - Hides the gallery slider modal.
	 * - Opens the corresponding fullscreen reels modal for the selected video.
	 * - Initializes the sidebar and loads related product data.
	 * - Registers close handlers (close button, outside click, Escape key).
	 * - Loads the selected video in fullscreen mode.
	 * - Enables scroll/swipe navigation within the fullscreen modal.
	 *
	 * Ensures graceful handling if the Swiper instance is invalid, destroyed,
	 * or if required DOM elements are missing.
	 *
	 * @async
	 * @param {Object}      swiperInstance - The active Swiper instance controlling the slides.
	 * @param {HTMLElement} button         - The fullscreen trigger button element.
	 * @return {Promise<void>}
	 */
	async attachFullscreenClickHandler( swiperInstance, button ) {
		if ( ! swiperInstance || ! button ) {
			return;
		}

		// Remove previous listener if it exists.
		if ( button._fullscreenHandler ) {
			button.removeEventListener( 'click', button._fullscreenHandler );
			button._fullscreenHandler = null;
		}

		const handler = async ( e ) => {
			e.preventDefault();
			e.stopPropagation();

			if ( ! swiperInstance || swiperInstance.destroyed ) {
				console.warn( 'Swiper instance no longer valid' );
				return;
			}

			// Get active slide from swiper
			const activeIndex = swiperInstance.activeIndex;
			const activeSlide = swiperInstance.slides[ activeIndex ];

			if ( ! activeSlide ) {
				console.warn( 'No active slide found' );
				return;
			}

			document.querySelector( '.rtgodam-product-video-gallery-slider-modal' ).classList.add( 'hidden' );

			const videoId = activeSlide.dataset.videoId;
			const productId = activeSlide.dataset.productId;
			const modal = document.querySelector(
				`.godam-woocommerce-product-page-reels-modal-container[data-modal-video-id="${ videoId }"]`,
			);

			modal.querySelector( '.godam-sidebar-header-actions' )?.classList.add( 'hide' );

			modal.classList.add( 'open' );

			initSidebar();

			modal.dataset.currentVideoId = videoId;
			modal.dataset.isLoading = 'false';

			const sidebarModal = modal.querySelector( '.godam-product-sidebar' );

			/* Close Modal and Product sidebar on clicking x */
			modal.querySelector( '.godam-woocommerce-product-page-reels-modal-close' )?.addEventListener( 'click', () => this.closeFullScreenModal( modal, sidebarModal ) );

			/* Clicking outside the modal content and sidebar closes the Modal */
			modal.addEventListener( 'click', ( ev ) => {
				if (
					! ev.target.closest( '.godam-woocommerce-product-page-reels-modal-content' ) &&
					! ev.target.closest( '.godam-product-sidebar' )
				) {
					this.closeFullScreenModal( modal, sidebarModal );
				}
			} );

			const handleEscapeClose = () => {
				this.closeFullScreenModal( modal, sidebarModal );
				unregisterEscapeHandler( handleEscapeClose );
			};

			modal._escapeHandler = handleEscapeClose;

			registerEscapeHandler( handleEscapeClose );

			/* Loads the video, Opens popup screen */
			modal.classList.remove( 'hidden' );
			await loadNewVideo( videoId, modal, true, 'godam_woo_product_page_reels', true );

			await loadSidebarProducts( productId, sidebarModal, modal );

			const videoModal = modal.querySelector( '.godam-woo-global-video-container' );
			const currentVideoItems = swiperInstance.slides;

			/** Scroll/swipe nav for modal */
			initScrollSwipeNavigation(
				modal,
				videoModal,
				currentVideoItems,
				true,
				'godam_woo_product_page_reels',
				true,
				async ( newProductId ) => {
					await loadSidebarProducts(
						newProductId,
						sidebarModal,
						modal,
					);
				},
			);
		};

		button._fullscreenHandler = handler;

		button.addEventListener( 'click', handler );
	},

	/**
	 * Closes the fullscreen reels modal and resets its state.
	 *
	 * Unregisters the Escape key handler, resets the video and sidebar state,
	 * and restores the original gallery slider modal visibility.
	 *
	 * @param {HTMLElement} modal        - The fullscreen modal element.
	 * @param {HTMLElement} sidebarModal - The associated product sidebar element.
	 * @return {void}
	 */
	closeFullScreenModal( modal, sidebarModal ) {
		if ( modal._escapeHandler ) {
			unregisterEscapeHandler( modal._escapeHandler );
			modal._escapeHandler = null;
		}

		resetVideoModal( modal );

		const modalContent = modal.querySelector( '.godam-woocommerce-product-page-reels-modal-content' );
		resetSidebarState( modal, sidebarModal, modalContent );

		document.querySelector( '.rtgodam-product-video-gallery-slider-modal' ).classList.remove( 'hidden' );
	},

};

// Initialize wcVideoCarousel.
wcVideoCarousel.init();
