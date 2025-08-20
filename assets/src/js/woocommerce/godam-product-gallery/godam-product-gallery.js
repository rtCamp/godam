/**
 * Initializes GoDAM frontend components on DOMContentLoaded.
 *
 * Components initialized:
 * - Product gallery autoplay for videos (`initAutoplayGalleries`)
 * - Product video modal popup (`initVideoModal`)
 * - Carousel navigation arrows (`initCarouselSlider`)
 * - Minicart toggle and CTA dropdown (`initMinicartAndCtaDropdown`)
 * - Grid layout CSS variables (`initGridLayout`)
 *
 * Ensures all UI interactions are bound after the DOM is fully loaded.
 */

/**
 * Internal dependencies
 */

import { initAutoplayGalleries } from './autoplay.js';
import { initVideoModal } from './modal.js';
import { initCarouselSlider } from './slider.js';
import { initMinicartAndCtaDropdown } from './cart.js';

/**
 * Initialize grid layout CSS variables
 */
function initGridLayout() {
	const gridContainers = document.querySelectorAll( '.godam-grid-wrapper .grid-container' );

	gridContainers.forEach( ( container ) => {
		const columns = container.dataset.gridColumns || 4;
		const rowGap = container.dataset.gridRowGap || 16;
		const columnGap = container.dataset.gridColumnGap || 16;
		const alignment = container.dataset.gridCardAlignment || 'start';

		// Set CSS variables
		container.style.setProperty( '--grid-columns', columns );
		container.style.setProperty( '--grid-row-gap', ` ${ rowGap }px` );
		container.style.setProperty( '--grid-column-gap', ` ${ columnGap }px` );
		container.style.setProperty( '--grid-card-alignment', alignment );
	} );
}

/**
 * Initializing components.
 */
document.addEventListener( 'DOMContentLoaded', function() {
	initAutoplayGalleries();
	initVideoModal();
	initCarouselSlider();
	initMinicartAndCtaDropdown();
	initGridLayout();
} );
