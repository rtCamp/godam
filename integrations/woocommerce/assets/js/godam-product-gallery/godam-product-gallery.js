/**
 * Initializes GoDAM frontend components on DOMContentLoaded.
 *
 * Components initialized:
 * - Product gallery autoplay for videos (`initAutoplayGalleries`)
 * - Product video modal popup (`initProductGalleryVideoModal`)
 * - Carousel navigation arrows (`initCarouselSlider`)
 * - Minicart toggle and CTA dropdown (`initMinicartAndCtaDropdown`)
 * - Global escape key handler for closing modals and overlays (`initEscapeManager`)
 *
 * Ensures all UI interactions are bound after the DOM is fully loaded.
 */

/**
 * Internal dependencies
 */

import { initAutoplayGalleries, cleanupAutoplayGalleries } from './autoplay.js';
import { initProductGalleryVideoModal } from './modal.js';
import { initCarouselSlider } from '../global-video-popup/slider.js';
import { initMinicartAndCtaDropdown } from './cart.js';
import { initEscapeManager } from '../global-video-popup/escapeManager.js';
/**
 * Initializing components.
 */
document.addEventListener( 'DOMContentLoaded', function() {
	initAutoplayGalleries();
	initProductGalleryVideoModal();
	initCarouselSlider();
	initMinicartAndCtaDropdown();
	initEscapeManager();
} );

/**
 * Cleanup on page unload to prevent memory leaks.
 */
window.addEventListener( 'beforeunload', function() {
	cleanupAutoplayGalleries();
} );
