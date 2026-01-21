/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable no-unused-vars */
/* global Swiper */

const { dispatch } = wp.data;

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
			self.addToCartModalProductAjax();
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
		this.swiper = new Swiper( '.rtgodam-product-video-gallery-slider', {
			loop: true,
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

				self.swiperModal = new Swiper( '.rtgodam-product-video-gallery-slider-modal-content-items', {
					loop: true,
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
							const activeSlide = this.slides[ this.activeIndex ];
							if ( activeSlide ) {
								const isTranscoded = activeSlide.getAttribute( 'data-is-transcoded' ) === 'true';
								const closeBtn = document.querySelector( '.rtgodam-product-video-gallery-slider-modal-close' );
								if ( closeBtn ) {
									closeBtn.classList.toggle( 'godam-transcoded', isTranscoded );
								}
							}
						},
						slideChange() {
							const activeSlide = this.slides[ this.activeIndex ];
							if ( activeSlide ) {
								const isTranscoded = activeSlide.getAttribute( 'data-is-transcoded' ) === 'true';
								const closeBtn = document.querySelector( '.rtgodam-product-video-gallery-slider-modal-close' );
								if ( closeBtn ) {
									closeBtn.classList.toggle( 'godam-transcoded', isTranscoded );
								}
							}
						},
					},
				} );
				const itemIndex = parseInt( event.target.getAttribute( 'data-swiper-slide-index' ) );
				self.swiperModal.slideTo( itemIndex );

				// Run the check immediately for the first slide.
				const firstSlide = self.swiperModal.slides[ self.swiperModal.activeIndex ];
				const isTranscoded = firstSlide.getAttribute( 'data-is-transcoded' ) === 'true';
				const closeBtn = document.querySelector( '.rtgodam-product-video-gallery-slider-modal-close' );
				if ( closeBtn ) {
					closeBtn.classList.toggle( 'godam-transcoded', isTranscoded );
				}

				const videoElmModal = document.querySelector( '.rtgodam-product-video-gallery-slider-modal' );
				videoElmModal.classList.add( 'open' );
				self.videoModalMiniSlider();
			} );
		} );
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
			videoElmModal.classList.remove( 'open' );
			if ( self.swiperModal ) {
				self.swiperModal.destroy();
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
	 * Adds an event listener to the cart form in the video modal.
	 *
	 * Listens for submits on the cart form in the video modal, and adds the item to the
	 * cart using the `wc/store/cart` store.
	 *
	 * @return {void}
	 */
	addToCartModalProductAjax() {
		const cartForm = document.querySelectorAll( '.rtgodam-product-video-gallery-slider-modal-content--cart-form' );
		cartForm.forEach( ( form ) => {
			form.querySelector( 'form' ).addEventListener( 'submit', ( event ) => {
				event.preventDefault();
				const formData = new FormData( event.target );
				const quantity = formData.get( 'quantity' );
				const subMitButton = form.querySelector( '.single_add_to_cart_button' );
				const variationId = formData.get( 'variation_id' );
				const productId = variationId || subMitButton?.value;
				subMitButton.disabled = true;
				subMitButton.classList.add( 'loading' );
				dispatch( 'wc/store/cart' ).addItemToCart( productId, quantity ).then( ( response ) => {
					subMitButton.disabled = false;
					subMitButton.classList.remove( 'loading' );
				} ).catch( ( err ) => {} );
			} );
		} );
	},

	/**
	 * Initializes the mini slider for the video modal.
	 *
	 * This method takes all elements with the class `.flex-control-nav` inside the video modal,
	 * wraps each one in a div with the class `.video-modal-mini-slider-parent`, and initializes
	 * a Swiper slider with the class `.video-modal-mini-slider-parent`.
	 *
	 * @return {void}
	 */
	videoModalMiniSlider() {
		const self = this;
		if ( self.swiperModalMini ) {
			return;
		}

		const videoElmModalMiniSlider = document.querySelectorAll( '.rtgodam-product-video-gallery-slider-modal .flex-control-nav' );
		videoElmModalMiniSlider.forEach( ( slider ) => {
			slider.classList.add( 'swiper-wrapper' );
			slider.querySelectorAll( 'li' ).forEach( ( slide ) => {
				slide.classList.add( 'swiper-slide' );
			} );
			const wrapper = document.createElement( 'div' );
			wrapper.className = 'video-modal-mini-slider-wrapper';
			const parent = document.createElement( 'div' );
			parent.className = 'video-modal-mini-slider-parent';
			const leftSlide = document.createElement( 'div' );
			leftSlide.className = 'video-modal-mini-slider-left';
			const rightSlide = document.createElement( 'div' );
			rightSlide.className = 'video-modal-mini-slider-right';
			slider.parentNode.insertBefore( wrapper, slider );
			parent.appendChild( slider );
			wrapper.appendChild( parent );
			wrapper.appendChild( leftSlide );
			wrapper.appendChild( rightSlide );
		} );
		self.swiperModalMini = new Swiper( '.video-modal-mini-slider-parent', {
			loop: true,
			navigation: {
				nextEl: '.video-modal-mini-slider-right',
				prevEl: '.video-modal-mini-slider-left',
			},
			slidesPerView: 4,
			spaceBetween: 10,
			autoplay: false,
			freeMode: true,
		} );
	},
};

// Initialize wcVideoCarousel.
wcVideoCarousel.init();
