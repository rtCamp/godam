/* global Swiper */

/**
 * Initializes and manages the video carousel functionality for WooCommerce.
 * This function sets up the carousel, handles events, and ensures smooth video playback.
 */
const wcVideoCarousel = {

	/**
	 * Initiate the video carousel and show controls on mouse enter.
	 * Uses Swiper for the carousel.
	 */
	init() {
		const self = this;
		// Load after DOM is ready.
		document.addEventListener( 'DOMContentLoaded', () => {
			self.loadVideoCarousel();
			self.showVideoControlOnMouseEnter();
		} );
	},

	/**
	 * Initializes the video carousel and slider.
	 * Uses Swiper for the carousel.
	 */
	loadVideoCarousel() {
		const self = this;
		// eslint-disable-next-line no-unused-vars
		const swiper = new Swiper( '.rtgodam-product-video-gallery-slider', {
			loop: true,
			navigation: {
				nextEl: '.swiper-button-next',
				prevEl: '.swiper-button-prev',
			},
			slidesPerView: 4,
			spaceBetween: 10,
			grabCursor: true,
			freeMode: true,
			autoplay: false,
			breakpoints: {
				0: {
					slidesPerView: 1,
				},
				640: {
					slidesPerView: 3,
				},
				1024: {
					slidesPerView: 4,
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
	 * Adds mouse enter and leave event listeners to videos in the carousel.
	 * Shows video controls on mouse enter and hides them on mouse leave.
	 */

	showVideoControlOnMouseEnter() {
		// Show control only when enter on video.
		document.querySelectorAll( '.rtgodam-product-video-gallery-slider video' ).forEach( ( video ) => {
			video.addEventListener( 'click', () => {
				console.log( 'clicked' );
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
};

// Initialize wcVideoCarousel.
wcVideoCarousel.init();
