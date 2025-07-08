/* global Swiper */
/**
 * External dependencies
 */
import videojs from 'video.js';

/**
 * Initializes and manages the video carousel functionality for WooCommerce.
 * This function sets up the carousel, handles events, and ensures smooth video playback.
 */
const wcVideoCarousel = {

	// Video carousel and modal elements.
	swiper: null,
	swiperModal: null,

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
		} );
	},

	/**
	 * Initializes the video carousel and slider.
	 * Uses Swiper for the carousel.
	 */
	loadVideoCarousel() {
		const self = this;
		// eslint-disable-next-line no-unused-vars
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
		document.querySelectorAll( '.rtgodam-product-video-gallery-slider video' ).forEach( ( video ) => {
			video.addEventListener( 'click', ( event ) => {
				event.preventDefault();

				self.swiperModal = new Swiper( '.rtgodam-product-video-gallery-slider-modal-content-items', {
					loop: true,
					navigation: {
						nextEl: '.swiper-button-next',
						prevEl: '.swiper-button-prev',
					},
					freeMode: true,
					autoplay: false,
				} );
				const itemIndex = parseInt( event.target.getAttribute( 'data-index-id' ) );
				self.swiperModal.slideTo( itemIndex );

				const videoElmModal = document.querySelector( '.rtgodam-product-video-gallery-slider-modal' );
				videoElmModal.classList.add( 'open' );
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
		rtgodamProductVideoGallerySlider.classList.remove( 'rtgodam-product-video-gallery-slider-loading' );
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
		videoElmModalClose.addEventListener( 'click', ( event ) => {
			event.preventDefault();
			videoElmModal.classList.remove( 'open' );
			self.swiperModal.destroy();
			self.swiperModal = null;
		} );
	},
};

// Initialize wcVideoCarousel.
wcVideoCarousel.init();
