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
 * Every hotspot layer is merged into ONE manager layer, drawn into the first
 * layer's container once all layers are mounted, so the manager's index-based
 * reposition stays consistent. Per-layer style is flattened onto each hotspot
 * (legacy per-hotspot fields) so distinct layer colours and icons survive.
 *
 * @param {Object} ctx Mount context.
 * @return {Object} Handlers.
 */
function mountOnImage( ctx ) {
	const state = ctx.shared( 'godam/image-hotspots', () => {
		const image = { layers: [], container: ctx.container, manager: null };
		image.handlers = {
			onReady: () => {
				const hotspots = [];
				image.layers.forEach( ( layer ) => {
					( layer.hotspots || [] ).forEach( ( hotspot ) => {
						const style = resolveHotspotStyle( layer, hotspot );
						// Button-style hotspots keep their own button fields; tag them so
						// the style-less merged layer still renders them as buttons.
						if ( style.styleType === 'button' ) {
							hotspots.push( { ...hotspot, styleType: 'button' } );
							return;
						}
						hotspots.push( {
							...hotspot,
							icon: style.icon || '',
							customIconUrl: style.customIconUrl || null,
							backgroundColor: style.color,
						} );
					} );
				} );

				const manager = new HotspotLayerManager( ctx.player, ctx.isDisplayingLayers, ctx.instanceId );
				manager.computeContentRect = () => ctx.player.computeContentRect();
				manager.setupHotspotLayer(
					{ id: 'godam-image-hotspots', type: 'hotspot', pauseOnHover: false, hotspots },
					image.container,
				);
				// The analytics runtime loads on image pages too, so hotspot
				// interactions are recorded like on video.
				manager.createHotspots( manager.hotspotLayers[ manager.hotspotLayers.length - 1 ] );
				image.manager = manager;
			},
			onResize: () => image.manager?.updateHotspotPositions(),
		};
		return image;
	} );
	state.layers.push( ctx.layer );
	return state.handlers;
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
