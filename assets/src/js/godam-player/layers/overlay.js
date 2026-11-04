/**
 * The shared controller behind CTA, Form and Poll layers (#2294).
 *
 * These layers pause the video, show one at a time and have a skip button, so
 * every one of them on a player shares one `FormLayerManager`. Each runtime's
 * `mount()` adds its layer to it with its own `behaviour` and returns the same
 * handlers, so the host sends each player event to the manager once.
 */

/**
 * Internal dependencies
 */
import FormLayerManager from '../managers/layers/formLayerManager.js';

const OVERLAY_KEY = 'godam/overlay';

/**
 * Get the player's overlay controller, creating it on first use.
 *
 * @param {Object} scope A mount `ctx`, or the host (anything with `shared()` and the player fields).
 * @return {{ manager: FormLayerManager, handlers: Object }} The controller.
 */
export function getOverlayController( scope ) {
	return scope.shared( OVERLAY_KEY, () => {
		const manager = new FormLayerManager( scope.player, scope.isDisplayingLayers, scope.instanceId );
		return {
			manager,
			handlers: {
				onReady: () => manager.sortLayers(),
				onTimeUpdate: ( currentTime ) => manager.handleFormLayersTimeUpdate( currentTime ),
				onPause: () => manager.handlePause(),
				onEnded: () => manager.handleEnded(),
				onPlay: () => manager.handlePlay(),
				onFullscreenChange: ( isFullscreen, container ) => manager.handleFullscreenChange( isFullscreen, container ),
				onReplay: () => manager.replay(),
			},
		};
	} );
}

/**
 * Build a `mount()` that adds the layer to the overlay controller.
 *
 * @param {Function} getBehaviour `getBehaviour( ctx )` returns the `behaviour` for `FormLayerManager.setupFormLayer()`.
 * @return {Function} The mount function.
 */
export function mountOverlayLayer( getBehaviour ) {
	return ( ctx ) => {
		const { manager, handlers } = getOverlayController( ctx );
		manager.setupFormLayer( ctx.layer, ctx.container, getBehaviour( ctx ) );
		return handlers;
	};
}
