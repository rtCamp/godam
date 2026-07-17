/**
 * GoDAM Image Layers — front-end renderer.
 *
 * Renders hotspot and WooCommerce product-hotspot layers on a `godam/image`
 * block. Images have no timeline, so every layer is always visible and ALL
 * layers render into ONE shared overlay element (a single stacking context,
 * so hotspots/tooltips from different layers never clip or cover each other).
 *
 * It reuses the existing player-side managers unchanged except for a single
 * seam: `manager.computeContentRect` is overridden with an image-box
 * implementation (the managers' own version reads a `<video>`, which does not
 * exist here). A tiny "media host" adapter satisfies every other manager call
 * site; timeline/playback methods are no-ops.
 */

/**
 * Internal dependencies
 */
// Side-effect import: creates window.godamLayerRegistry and drains the queue the
// Woo front-end script pushed to (image-only pages never boot the video player).
import './../godam-player/utils/layer-registry-init.js';
import HotspotLayerManager from './../godam-player/managers/layers/hotspotLayerManager.js';
import { loadFontAwesome, hasHotspotsWithIcons } from './../godam-player/utils/pluginLoader.js';
import { resolveHotspotStyle } from './../godam-player/utils/hotspotStyle.js';

/**
 * Build a minimal "media host" adapter for the layer managers.
 *
 * @param {HTMLElement}      frame The positioned `.godam-image__frame` wrapper.
 * @param {HTMLImageElement} img   The image element.
 * @return {Object} An object satisfying the manager player interface.
 */
function makeImageAdapter( frame, img ) {
	return {
		// Managers read the container element and its `data-id` (analytics key).
		el: () => frame,
		// The one real override: content rect = the rendered <img> box relative
		// to the positioned frame. Kept in sync with the image on resize.
		computeContentRect: () => {
			const frameRect = frame.getBoundingClientRect();
			const imgRect = img.getBoundingClientRect();
			return {
				left: Math.round( imgRect.left - frameRect.left ),
				top: Math.round( imgRect.top - frameRect.top ),
				width: Math.round( img.clientWidth || imgRect.width ),
				height: Math.round( img.clientHeight || imgRect.height ),
			};
		},
		tech: () => null,
		videoWidth: () => img.naturalWidth,
		videoHeight: () => img.naturalHeight,
		// No timeline / playback on an image — these keep pauseOnHover, analytics
		// enrichment and fullscreen handling as safe no-ops.
		currentTime: () => 0,
		isFullscreen: () => false,
		paused: () => true,
		pause: () => {},
		play: () => {},
		one: () => {},
		on: () => {},
	};
}

/**
 * Render all layers of one `godam/image` block into its shared overlay.
 *
 * @param {HTMLElement} frame The `.godam-image__frame` element.
 */
function initFrame( frame ) {
	if ( frame.dataset.godamLayersRendered === 'true' ) {
		return;
	}

	let layers = [];
	try {
		layers = JSON.parse( frame.dataset.godamImageLayers || '[]' );
	} catch ( e ) {
		layers = [];
	}
	if ( ! Array.isArray( layers ) || layers.length === 0 ) {
		return;
	}

	const img = frame.querySelector( 'img' );
	const sharedEl = frame.querySelector( '.easydam-layer.godam-image-layer' );
	if ( ! img || ! sharedEl ) {
		return;
	}

	const instanceId = frame.dataset.instanceId || '';
	const hotspotLayers = layers.filter( ( layer ) => layer?.type === 'hotspot' );
	const wooLayers = layers.filter( ( layer ) => layer?.type === 'woo' );
	const adapter = makeImageAdapter( frame, img );

	const render = () => {
		if ( frame.dataset.godamLayersRendered === 'true' ) {
			return;
		}
		frame.dataset.godamLayersRendered = 'true';

		let hotspotManager = null;
		let wooManager = null;

		// Two `display:contents` group wrappers inside the SINGLE overlay. They
		// carry no box and form no stacking context, so all markers share the one
		// overlay's stacking context (the z-index fix), while giving each manager a
		// private scope for its index-based `.hotspot` reposition queries — hotspot
		// and Woo markers both use the `.hotspot` class, so they must not share a
		// query root.
		const hotspotGroup = document.createElement( 'div' );
		hotspotGroup.className = 'godam-image-hotspot-group';
		hotspotGroup.style.display = 'contents';
		const wooGroup = document.createElement( 'div' );
		wooGroup.className = 'godam-image-woo-group';
		wooGroup.style.display = 'contents';
		sharedEl.appendChild( hotspotGroup );
		sharedEl.appendChild( wooGroup );

		// Merge every hotspot layer into ONE manager layer object so the manager's
		// index-based reposition stays consistent. Per-layer style is flattened
		// onto each hotspot (legacy per-hotspot fields) so distinct layer colours /
		// icons survive the merge.
		if ( hotspotLayers.length ) {
			const mergedHotspots = [];
			hotspotLayers.forEach( ( layer ) => {
				( layer.hotspots || [] ).forEach( ( hotspot ) => {
					const style = resolveHotspotStyle( layer, hotspot );
					mergedHotspots.push( {
						...hotspot,
						icon: style.icon || '',
						customIconUrl: style.customIconUrl || null,
						backgroundColor: style.color,
					} );
				} );
			} );
			const mergedLayer = {
				id: 'godam-image-hotspots',
				type: 'hotspot',
				pauseOnHover: false,
				hotspots: mergedHotspots,
			};
			hotspotManager = new HotspotLayerManager( adapter, {}, instanceId );
			hotspotManager.computeContentRect = () => adapter.computeContentRect();
			hotspotManager.setupHotspotLayer( mergedLayer, hotspotGroup );
			const layerObj = hotspotManager.hotspotLayers[ hotspotManager.hotspotLayers.length - 1 ];
			if ( typeof hotspotManager.emitParentLayerEvent === 'function' ) {
				hotspotManager.emitParentLayerEvent( mergedLayer, 'viewed' );
			}
			hotspotManager.createHotspots( layerObj );
		}

		// Woo layers — resolved from the shared registry (present only when the
		// godam-for-woo add-on is active). Merge product hotspots into one layer
		// object (using the first woo layer's style / behaviour as the base).
		if ( wooLayers.length ) {
			const WooManager = window.godamLayerRegistry?.getLayerManager?.( 'woo' );
			if ( WooManager ) {
				const mergedWoo = {
					...wooLayers[ 0 ],
					id: 'godam-image-woo',
					productHotspots: wooLayers.flatMap( ( layer ) => layer.productHotspots || [] ),
				};
				wooManager = new WooManager( adapter, {}, instanceId );
				wooManager.computeContentRect = () => adapter.computeContentRect();
				wooManager.setupLayer( mergedWoo, wooGroup );
				const layerObj = wooManager.wooLayers[ wooManager.wooLayers.length - 1 ];
				wooManager.createProductHotspots( layerObj );
			}
		}

		// Reposition markers when the rendered image box changes.
		const reposition = () => {
			if ( hotspotManager && typeof hotspotManager.updateHotspotPositions === 'function' ) {
				hotspotManager.updateHotspotPositions();
			}
			if ( wooManager && typeof wooManager.updateProductHotspotPositions === 'function' ) {
				wooManager.updateProductHotspotPositions();
			}
		};
		window.addEventListener( 'resize', reposition );
		if ( 'ResizeObserver' in window ) {
			const observer = new ResizeObserver( reposition );
			observer.observe( img );
		}
	};

	const start = () => {
		// Load FontAwesome first when any hotspot uses an icon style, else the
		// icon glyphs render as empty boxes.
		if ( hasHotspotsWithIcons( layers ) ) {
			loadFontAwesome().then( render ).catch( render );
		} else {
			render();
		}
	};

	// Positioning needs the image's laid-out box; wait for load when necessary
	// (core images are lazy-loaded / async-decoded).
	if ( img.complete && img.naturalWidth ) {
		start();
	} else {
		img.addEventListener( 'load', start, { once: true } );
	}
}

document.addEventListener( 'DOMContentLoaded', () => {
	document
		.querySelectorAll( '.godam-image__frame[data-godam-image-layers]' )
		.forEach( initFrame );
} );
