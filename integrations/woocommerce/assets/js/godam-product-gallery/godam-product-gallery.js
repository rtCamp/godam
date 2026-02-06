/**
 * Initializes GoDAM frontend components on DOMContentLoaded.
 *
 * Components initialized:
 * - Product gallery autoplay for videos (`initAutoplayGalleries`)
 * - Product video modal popup (`initVideoModal`)
 * - Carousel navigation arrows (`initCarouselSlider`)
 * - Minicart toggle and CTA dropdown (`initMinicartAndCtaDropdown`)
 *
 * Ensures all UI interactions are bound after the DOM is fully loaded.
 */

/**
 * Internal dependencies
 */

import { initAutoplayGalleries, cleanupAutoplayGalleries } from './autoplay.js';
import { initVideoModal } from './modal.js';
import { initCarouselSlider } from './slider.js';
import { initMinicartAndCtaDropdown } from './cart.js';
/**
 * Initializing components.
 */
document.addEventListener( 'DOMContentLoaded', function() {
	initAutoplayGalleries();
	initVideoModal();
	initCarouselSlider();
	initMinicartAndCtaDropdown();
} );

/**
 * Cleanup on page unload to prevent memory leaks.
 */
window.addEventListener( 'beforeunload', function() {
	cleanupAutoplayGalleries();
} );
