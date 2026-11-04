/**
 * Mounting for the CTA, Form and Poll layers' view scripts (#2294).
 *
 * These layers share one `FormLayerManager` per player (pause on display, one
 * at a time, skip button). The player creates it (`getOverlayController()` in
 * `assets/src/js/godam-player/layers/overlay.js`) before any layer mounts, so
 * a view script only adds its layer with its own `behaviour`, and does not
 * bundle the manager.
 */

// Must match OVERLAY_KEY in assets/src/js/godam-player/layers/overlay.js.
const OVERLAY_KEY = 'godam/overlay';

/**
 * Build a `mount()` that adds the layer to the player's overlay controller.
 *
 * @param {Function} getBehaviour `getBehaviour( ctx )` returns the `behaviour` for `FormLayerManager.setupFormLayer()`.
 * @return {Function} The mount function.
 */
export function mountOverlayLayer( getBehaviour ) {
	return ( ctx ) => {
		const { manager, handlers } = ctx.shared( OVERLAY_KEY, () => {
			throw new Error( 'GoDAM: this layer needs the video player\'s overlay controller.' );
		} );
		manager.setupFormLayer( ctx.layer, ctx.container, getBehaviour( ctx ) );
		return handlers;
	};
}
