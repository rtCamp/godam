/**
 * Elementor re-initialisation for the GoDAM Gallery widget.
 *
 * The gallery's view.js and the GoDAM player both auto-run only on
 * DOMContentLoaded, so a widget that Elementor injects after page load (editor
 * preview, and frontend lazy rendering) never initialises. In particular the
 * blur-up thumbnails (.godam-gallery-blurred-img) never receive their 'loaded'
 * class because initBlurUpPlaceholders() runs during gallery init.
 *
 * Re-running the gallery init on element_ready resolves the stuck blur (and the
 * modal / infinite-scroll handlers). Both calls are idempotent.
 */

window.addEventListener( 'elementor/frontend/init', () => {
	if ( ! window.elementorFrontend || ! window.elementorFrontend.hooks ) {
		return;
	}

	// eslint-disable-next-line no-undef
	elementorFrontend.hooks.addAction(
		'frontend/element_ready/godam-gallery.default',
		() => {
			if ( window.GodamGalleryV2 && typeof window.GodamGalleryV2.init === 'function' ) {
				window.GodamGalleryV2.init();
			}
			if ( typeof window.GODAMPlayer === 'function' ) {
				window.GODAMPlayer();
			}
		},
	);
} );
