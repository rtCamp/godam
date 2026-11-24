/**
 * The Hotspot layer's front-end runtime (#2294), on video and on images.
 */

/**
 * Internal dependencies
 */
import { registerLayerRuntime, getLayerRuntime } from '../../js/godam-layers/runtime/registry.js';
import HotspotLayerManager from '../../js/godam-player/managers/layers/hotspotLayerManager.js';
import { resolveHotspotStyle } from '../../js/godam-player/utils/hotspotStyle.js';

/**
 * Whether a hotspot layer draws any FontAwesome icon.
 *
 * Resolves each point's effective style (the shared layer-level model for
 * refactored layers, per-hotspot for legacy ones) so detection matches exactly
 * when a FontAwesome glyph renders.
 *
 * @param {Object} layer Saved hotspot layer.
 * @return {boolean} True when FontAwesome must load first.
 */
export function hotspotLayerUsesIconFont( layer ) {
	return Boolean( layer?.hotspots?.some( ( hotspot ) => resolveHotspotStyle( layer, hotspot ).icon ) );
}

/**
 * Mount on a video: every hotspot layer on the player shares one manager.
 *
 * @param {Object} ctx Mount context.
 * @return {Object} Handlers.
 */
function mountOnVideo( ctx ) {
	const { manager, handlers } = ctx.shared( 'godam/hotspots', () => {
		const hotspots = new HotspotLayerManager( ctx.player, ctx.isDisplayingLayers, ctx.instanceId );
		return {
			manager: hotspots,
			handlers: {
				onTimeUpdate: ( currentTime ) => hotspots.handleHotspotLayersTimeUpdate( currentTime ),
				onResize: () => hotspots.updateHotspotPositions(),
				onFullscreenChange: ( isFullscreen, container ) => hotspots.handleFullscreenChange( isFullscreen, container ),
			},
		};
	} );
	manager.setupHotspotLayer( ctx.layer, ctx.container );
	return handlers;
}

/**
 * Mount on an image: hotspots show at once, with no timeline.
 *
 * Every hotspot layer on the image shares one manager, as on a video, and is
 * drawn as itself into its own container. So each point keeps its layer's id
 * and name in analytics and its layer's style (colours, icon, icon colour),
 * exactly as in the editor preview and on video. Each layer's drawing is a
 * `display:contents` wrapper, which scopes the manager's index-based
 * reposition to that layer's points without adding a stacking context.
 *
 * Layers are drawn on `onReady`. A layer mounted later (its view script loaded
 * late) gets `onReady` again on the same handlers, and only the layers not yet
 * drawn are drawn then. The manager is kept across those calls, so its
 * once-per-page analytics dedupe holds.
 *
 * @param {Object} ctx Mount context.
 * @return {Object} Handlers.
 */
function mountOnImage( ctx ) {
	const image = ctx.shared( 'godam/image-hotspots', () => {
		const state = { toDraw: [], drawings: [], manager: null };
		state.handlers = {
			onReady: () => {
				if ( ! state.manager ) {
					state.manager = new HotspotLayerManager( ctx.player, ctx.isDisplayingLayers, ctx.instanceId );
					state.manager.computeContentRect = () => ctx.player.computeContentRect();
				}
				const manager = state.manager;

				state.toDraw.splice( 0 ).forEach( ( { layer, container } ) => {
					const drawing = document.createElement( 'div' );
					drawing.className = 'godam-image-hotspots';
					drawing.style.display = 'contents';
					container.appendChild( drawing );
					state.drawings.push( drawing );

					// An image has no playback to pause on hover.
					const imageLayer = { ...layer, pauseOnHover: false };
					manager.setupHotspotLayer( imageLayer, drawing );
					// The analytics runtime loads on image pages too, so hotspot
					// interactions are recorded like on video.
					manager.createHotspots( manager.hotspotLayers[ manager.hotspotLayers.length - 1 ] );
					// The points show as soon as they're drawn, so record the
					// impressions now, as a video does when the layer appears.
					manager.emitLayerVisible( imageLayer );
				} );
			},
			onResize: () => state.manager?.updateHotspotPositions(),
			destroy: () => {
				state.drawings.forEach( ( drawing ) => drawing.remove() );
				state.drawings = [];
				state.toDraw = [];
				state.manager = null;
			},
		};
		return state;
	} );
	image.toDraw.push( { layer: ctx.layer, container: ctx.container } );
	return image.handlers;
}

/**
 * Register the Hotspot runtime, unless something already did.
 */
export function registerHotspotRuntime() {
	if ( getLayerRuntime( 'hotspot' ) ) {
		return;
	}
	registerLayerRuntime( 'hotspot', {
		title: 'Hotspot',
		supports: { media: [ 'video', 'image' ] },
		usesIconFont: hotspotLayerUsesIconFont,
		mount: ( ctx ) => ( ctx.media?.type === 'image' ? mountOnImage( ctx ) : mountOnVideo( ctx ) ),
	} );
}

registerHotspotRuntime();
