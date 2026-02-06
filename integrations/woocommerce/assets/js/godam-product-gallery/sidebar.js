/**
 * Handles the initialization of the product modal sidebar and image gallery.
 *
 * This module provides: A fully functional image gallery with:
 * - Thumbnail navigation
 * - Horizontal scroll with buttons, mouse wheel, and touch/swipe support
 * - Accessibility support (keyboard navigation, ARIA labels)
 */

/**
 * Initializes the sidebar functionality by attaching
 * the close button event listener.
 */
export function initSidebar() {
	addCloseSidebarListener();
	addOpenSidebarListener();
}

/**
 * Adds an event listener to the sidebar close button to close
 * the product sidebar and adjust modal content layout accordingly.
 */
function addCloseSidebarListener() {
	const modalContainer = document.querySelector( '.godam-product-modal-container.open' );

	// If modal is not present return immediately FAAAAAAAH.
	if ( ! modalContainer ) {
		return;
	}

	// Get sidebar close and open button.
	const sidebarClose = modalContainer.querySelector( '.godam-sidebar-close' );
	const sidebarOpenButton = modalContainer.querySelector( '.sidebar-collapsible-open-button.hidden' );

	sidebarClose?.addEventListener( 'click', () => {
		// Close the sidebar.
		const sidebarElement = modalContainer.querySelector( '.godam-product-sidebar' );
		sidebarElement?.classList.add( 'close' );

		// Update Modal.
		modalContainer?.querySelector( '.godam-product-modal-content' )?.classList?.add( 'no-sidebar' );
		modalContainer?.querySelector( '.godam-product-modal-content' )?.classList?.remove( 'sidebar' );

		// Display the sidebar open button.
		sidebarOpenButton?.classList.remove( 'hidden' );
	} );
}

/**
 * Adds an event listener to the sidebar open button to open
 * the product sidebar and adjust modal content layout accordingly.
 */
function addOpenSidebarListener() {
	const modalContainer = document.querySelector( '.godam-product-modal-container.open' );

	// If modal is not present return immediately.
	if ( ! modalContainer ) {
		return;
	}

	// Get the sidebar open button.
	const sidebarOpen = modalContainer.querySelector( '.sidebar-collapsible-open-button' );

	sidebarOpen?.addEventListener( 'click', () => {
		// Get the sidebar.
		const sidebarElement = modalContainer.querySelector( '.godam-product-sidebar' );
		sidebarElement?.classList.remove( 'close' );

		// Update the modal.
		modalContainer?.querySelector( '.godam-product-modal-content' )?.classList?.remove( 'no-sidebar' );
		modalContainer?.querySelector( '.godam-product-modal-content' )?.classList?.add( 'sidebar' );

		// Hide the sidebar open button.
		sidebarOpen?.classList.add( 'hidden' );
	} );
}

/**
 * Initializes the image gallery functionality within the open product modal.
 *
 * Features:
 * - Thumbnail selection with active state
 * - Horizontal scroll navigation
 * - Touch/swipe gestures for image switching
 * - Mouse wheel horizontal scrolling
 * - Accessibility (keyboard navigation and ARIA labels)
 */
export function initImageGallery() {
	const modalContainer = document.querySelector( '.godam-product-modal-container.open' );

	if ( ! modalContainer ) {
		return;
	}

	// Get gallery elements.
	const mainImage = modalContainer.querySelector( '.godam-main-image img' );
	const thumbnails = modalContainer.querySelectorAll( '.godam-thumbnail-item' );

	if ( ! mainImage || thumbnails.length === 0 ) {
		return;
	}

	// Hide thumbnail carousel if there's only one image.
	const thumbnailCarousel = modalContainer.querySelector( '.godam-thumbnail-carousel' );
	if ( thumbnails.length === 1 && thumbnailCarousel ) {
		thumbnailCarousel.style.display = 'none';
		return;
	}

	const thumbnailImages = modalContainer.querySelectorAll( '.godam-thumbnail-image' );
	const thumbnailTrack = modalContainer.querySelector( '.godam-thumbnail-track' );
	const prevBtn = modalContainer.querySelector( '.godam-thumbnail-prev' );
	const nextBtn = modalContainer.querySelector( '.godam-thumbnail-next' );

	/**
	 * Initializes the gallery with thumbnail, scroll, touch, and mouse support.
	 */
	function initGallery() {
		thumbnails.forEach( ( thumbnail, index ) => {
			thumbnail.addEventListener( 'click', () => {
				showImage( index );
			} );

			// Add keyboard support.
			thumbnail.setAttribute( 'tabindex', '0' );
			thumbnail.setAttribute( 'role', 'button' );
			thumbnail.setAttribute( 'aria-label', `View image ${ index + 1 }` );

			thumbnail.addEventListener( 'keydown', ( e ) => {
				if ( e.key === 'Enter' || e.key === ' ' ) {
					e.preventDefault();
					showImage( index );
				}
			} );
		} );

		// Initialize horizontal scroll navigation.
		initHorizontalScroll();

		// Add touch/swipe support for mobile.
		initTouchSupport();

		// Add mouse wheel support.
		initMouseWheelSupport();
	}

	/**
	 * Updates the main image based on selected thumbnail.
	 *
	 * @param {number} index - Index of the selected thumbnail.
	 */
	function showImage( index ) {
		thumbnails.forEach( ( thumb ) => {
			thumb.classList.remove( 'active' );
		} );

		if ( thumbnails[ index ] ) {
			thumbnails[ index ].classList.add( 'active' );
		}

		// Update main image.
		if ( thumbnailImages[ index ] ) {
			mainImage.src = thumbnailImages[ index ].src;
			mainImage.alt = thumbnailImages[ index ].alt;
		}

		mainImage.style.opacity = '0';
		setTimeout( () => {
			mainImage.style.opacity = '1';
		}, 150 );
	}

	/**
	 * Enables horizontal scrolling for thumbnails with navigation buttons.
	 */
	function initHorizontalScroll() {
		const scrollStep = 120;
		let currentScrollLeft = 0;
		const maxScrollLeft = thumbnailTrack.scrollWidth - thumbnailTrack.clientWidth;

		function updateNavigationButtons() {
			if ( prevBtn ) {
				prevBtn.disabled = currentScrollLeft <= 0;
				prevBtn.style.opacity = currentScrollLeft <= 0 ? '0.3' : '1';
			}
			if ( nextBtn ) {
				nextBtn.disabled = currentScrollLeft >= maxScrollLeft;
				nextBtn.style.opacity = currentScrollLeft >= maxScrollLeft ? '0.3' : '1';
			}
		}

		function scrollThumbnails( direction ) {
			const newScrollLeft = currentScrollLeft + ( direction * scrollStep );

			// Clamp scroll position.
			currentScrollLeft = Math.max( 0, Math.min( newScrollLeft, maxScrollLeft ) );

			thumbnailTrack.scrollTo( {
				left: currentScrollLeft,
				behavior: 'smooth',
			} );

			updateNavigationButtons();
		}

		// Add click event listeners to navigation buttons.
		if ( prevBtn ) {
			prevBtn.addEventListener( 'click', () => {
				scrollThumbnails( -1 );
			} );
		}

		if ( nextBtn ) {
			nextBtn.addEventListener( 'click', () => {
				scrollThumbnails( 1 );
			} );
		}

		// Update scroll position on manual scroll.
		thumbnailTrack.addEventListener( 'scroll', () => {
			currentScrollLeft = thumbnailTrack.scrollLeft;
			updateNavigationButtons();
		} );

		// Initialize button states.
		updateNavigationButtons();
	}

	/**
	 * Adds mouse wheel support for horizontal thumbnail scrolling.
	 */
	function initMouseWheelSupport() {
		thumbnailTrack.addEventListener( 'wheel', ( e ) => {
			e.preventDefault();

			const scrollAmount = e.deltaY > 0 ? 1 : -1;
			const scrollStep = 60; // Smaller step for wheel scrolling.

			const currentScrollLeft = thumbnailTrack.scrollLeft;
			const newScrollLeft = currentScrollLeft + ( scrollAmount * scrollStep );
			const maxScrollLeft = thumbnailTrack.scrollWidth - thumbnailTrack.clientWidth;

			thumbnailTrack.scrollTo( {
				left: Math.max( 0, Math.min( newScrollLeft, maxScrollLeft ) ),
				behavior: 'smooth',
			} );
		} );
	}

	/**
	 * Adds touch/swipe gesture support for switching main images.
	 */
	function initTouchSupport() {
		let startX = 0;
		let endX = 0;
		const mainImageContainer = modalContainer.querySelector( '.godam-main-image' );

		if ( ! mainImageContainer ) {
			return;
		}

		mainImageContainer.addEventListener( 'touchstart', ( e ) => {
			startX = e.touches[ 0 ].clientX;
		} );

		mainImageContainer.addEventListener( 'touchend', ( e ) => {
			endX = e.changedTouches[ 0 ].clientX;
			handleSwipe();
		} );

		function handleSwipe() {
			const swipeThreshold = 50;
			const diff = startX - endX;
			const currentActiveIndex = Array.from( thumbnails ).findIndex( ( thumb ) =>
				thumb.classList.contains( 'active' ),
			);

			if ( Math.abs( diff ) > swipeThreshold ) {
				if ( diff > 0 && currentActiveIndex < thumbnails.length - 1 ) {
					// Swipe left - next image.
					showImage( currentActiveIndex + 1 );
				} else if ( diff < 0 && currentActiveIndex > 0 ) {
					// Swipe right - previous image.
					showImage( currentActiveIndex - 1 );
				}
			}
		}
	}

	// Initialize the gallery.
	initGallery();
}
