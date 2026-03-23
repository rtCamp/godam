/**
 * GoDAM Carousel Slider Initialization
 *
 * Description:
 * Initializes horizontal scrolling for carousels with custom left/right navigation arrows.
 * Adds click event listeners to the arrow buttons within each `.godam-carousel-wrapper`.
 * Clicking the left arrow scrolls the `.carousel-track` left, and the right arrow scrolls it right.
 */

export function initCarouselSlider() {
	const wrappers = document.querySelectorAll( '.godam-carousel-wrapper' );

	wrappers.forEach( ( wrapper ) => {
		const track = wrapper.querySelector( '.carousel-track' );
		if ( ! track ) {
			return;
		}

		const leftBtn = wrapper.querySelector( '.carousel-arrow.left' );
		const rightBtn = wrapper.querySelector( '.carousel-arrow.right' );

		if ( leftBtn ) {
			leftBtn.addEventListener( 'click', () => {
				track.scrollBy( { left: -300, behavior: 'smooth' } );
			} );
		}
		if ( rightBtn ) {
			rightBtn.addEventListener( 'click', () => {
				track.scrollBy( { left: 300, behavior: 'smooth' } );
			} );
		}
	} );
}
