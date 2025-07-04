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
	 * Show a modal with a video player when a video is clicked.
	 *
	 * Listens for clicks on video elements in the video carousel, and shows a modal
	 * with a video player when a video is clicked.
	 *
	 * @return {void}
	 */
	openVideoModal() {
		// Show control only when enter on video.
		document.querySelectorAll( '.rtgodam-product-video-gallery-slider video' ).forEach( ( video ) => {
			video.addEventListener( 'click', ( event ) => {
				event.preventDefault();
				const src = event.target.currentSrc;
				const time = event.target.currentTime;

				let videoElm = document.querySelector( '#rtgodam-product-video-gallery-slider-single-video' );
				const videoElmModal = document.querySelector( '.rtgodam-product-video-gallery-slider-modal' );
				const videoElmModalContant = document.querySelector( '.rtgodam-product-video-gallery-slider-modal-content' );

				if ( videoElm ) {
					videoElmModal.classList.remove( 'open' );
					videojs( 'rtgodam-product-video-gallery-slider-single-video' ).dispose();
					videoElm.remove();
				}

				videoElm = document.createElement( 'video' );
				videoElm.setAttribute( 'id', 'rtgodam-product-video-gallery-slider-single-video' );
				videoElm.setAttribute( 'class', 'video-js' );
				const source = document.createElement( 'source' );
				source.setAttribute( 'src', src );
				videoElm.appendChild( source );
				videoElmModalContant.appendChild( videoElm );
				const player = videojs( 'rtgodam-product-video-gallery-slider-single-video', {
					controls: true,
					autoplay: true,
					preload: 'auto',
					width: '450px',
					height: '800px',
					controlBar: {
						skipButtons: {
							forward: 10,
							backward: 10,
						},
					},
				} );
				player.currentTime( time );
				player.play();
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
		const videoElmModal = document.querySelector( '.rtgodam-product-video-gallery-slider-modal' );
		const videoElmModalClose = document.querySelector( '.rtgodam-product-video-gallery-slider-modal-close' );
		videoElmModalClose.addEventListener( 'click', () => {
			videojs( 'rtgodam-product-video-gallery-slider-single-video' ).dispose();
			videoElmModal.classList.remove( 'open' );
		} );
	},
};

// Initialize wcVideoCarousel.
wcVideoCarousel.init();
