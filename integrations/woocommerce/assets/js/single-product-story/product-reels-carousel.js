/**
 * Product Reels Carousel – frontend navigation.
 *
 * Adds prev / next arrow behaviour and scroll-based visibility
 * for the `.rtgodam-product-video-gallery` carousel on the
 * WooCommerce single product page.
 */
( function() {
	'use strict';

	/**
	 * Initialise a single carousel instance.
	 *
	 * @param {HTMLElement} gallery The `.rtgodam-product-video-gallery` root element.
	 */
	function initCarousel( gallery ) {
		const container = gallery.querySelector( '.rtgodam-product-video-gallery__container' );
		const prevBtn = gallery.querySelector( '.rtgodam-product-video-gallery__nav--prev' );
		const nextBtn = gallery.querySelector( '.rtgodam-product-video-gallery__nav--next' );

		if ( ! container || ! prevBtn || ! nextBtn ) {
			return;
		}

		/**
		 * Show / hide arrows depending on scroll position.
		 */
		function updateNavVisibility() {
			const { scrollLeft, scrollWidth, clientWidth } = container;
			prevBtn.style.display = scrollLeft <= 0 ? 'none' : 'flex';
			nextBtn.style.display = scrollLeft + clientWidth >= scrollWidth - 1 ? 'none' : 'flex';
		}

		/**
		 * Scroll the carousel by one item in the given direction.
		 *
		 * @param {number} direction -1 for previous, 1 for next.
		 */
		function scrollCarousel( direction ) {
			const firstItem = container.querySelector( '.rtgodam-product-video-gallery__item' );
			const itemWidth = firstItem ? firstItem.offsetWidth : 200;
			const gap = parseInt( getComputedStyle( container ).gap ) || 12;
			container.scrollBy( { left: ( itemWidth + gap ) * direction, behavior: 'smooth' } );
		}

		prevBtn.addEventListener( 'click', function() {
			scrollCarousel( -1 );
		} );

		nextBtn.addEventListener( 'click', function() {
			scrollCarousel( 1 );
		} );

		container.addEventListener( 'scroll', updateNavVisibility );
		window.addEventListener( 'resize', updateNavVisibility );

		// Initial check.
		updateNavVisibility();
	}

	/**
	 * Boot all gallery carousels on the page.
	 */
	function initAll() {
		document.querySelectorAll( '.rtgodam-product-video-gallery' ).forEach( initCarousel );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', initAll );
	} else {
		initAll();
	}
}() );
