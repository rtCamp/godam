/**
 * The shared controller behind CTA, Form and Poll layers (#2294).
 *
 * These layers pause the video, show one at a time and have a skip button, so
 * every one of them on a player shares one `FormLayerManager`. The player's
 * `LayersManager` creates it, so the CTA, Form and Poll view scripts
 * (`assets/src/layers/shared/overlay.js`) only add their layers to it and
 * never bundle the manager themselves.
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
