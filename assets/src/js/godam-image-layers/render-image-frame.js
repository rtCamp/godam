/**
 * GoDAM Image Layers — shared frame renderer.
 *
 * Draws hotspot and WooCommerce product-hotspot layers onto a single
 * `.godam-image__frame` element. Extracted so it can be reused by both the
 * front-end bootstrap (frontend.js) and the block editor preview (the
 * `godam/image` block's edit.js), which renders the same markup into the
 * editor canvas and calls this against a ref.
 *
 * It reuses the existing player-side managers unchanged except for a single
 * seam: `manager.computeContentRect` is overridden with an image-box
 * implementation (the managers' own version reads a `<video>`, which does not
 * exist here). A tiny "media host" adapter satisfies every other manager call
 * site; timeline/playback methods are no-ops.
 *
 * Note: importing this module is NOT side-effect-free — it initializes
 * `window.godamLayerRegistry` (see the layer-registry-init import below). It
 * does not auto-run any rendering, though: nothing draws until a caller invokes
 * `initImageFrame()`.
 */

/**
 * Internal dependencies
 */
// Side-effect import: creates window.godamLayerRegistry and drains the queue the
// Woo front-end script pushed to (image-only pages never boot the video player).
import './../godam-player/utils/layer-registry-init.js';
import HotspotLayerManager from './../godam-player/managers/layers/hotspotLayerManager.js';
import { loadFontAwesome, hasHotspotsWithIcons, renderFontAwesomeIcons } from './../godam-player/utils/pluginLoader.js';
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
 * Idempotent and self-cleaning. A frame is initialized only once — tracked by a
 * per-frame teardown handle rather than a boolean, so the awaiting-image-load
 * window is covered too — and the returned teardown removes every listener,
 * ResizeObserver and any pending `load` handler, then clears the overlay and the
 * render guard so the frame can be re-initialized. Callers that redraw on change
 * (the block editor) should run the returned teardown before the next call
 * (React does this automatically when it is returned from an effect); the front
 * end can ignore the return value.
 *
 * @param {HTMLElement} frame The `.godam-image__frame` element.
 * @return {Function} Teardown for this frame (a no-op when nothing was set up).
 */
export function initImageFrame( frame ) {
	const noop = () => {};

	if ( ! frame ) {
		return noop;
	}
	// Already initialized (rendered, or awaiting the image's load): hand back the
	// existing teardown instead of stacking a second set of listeners/observers.
	if ( typeof frame._godamLayersTeardown === 'function' ) {
		return frame._godamLayersTeardown;
	}

	let layers = [];
	try {
		layers = JSON.parse( frame.dataset.godamImageLayers || '[]' );
	} catch ( e ) {
		layers = [];
	}
	if ( ! Array.isArray( layers ) || layers.length === 0 ) {
		return noop;
	}

	const img = frame.querySelector( 'img' );
	const sharedEl = frame.querySelector( '.easydam-layer.godam-image-layer' );
	if ( ! img || ! sharedEl ) {
		return noop;
	}

	const instanceId = frame.dataset.instanceId || '';
	const hotspotLayers = layers.filter( ( layer ) => layer?.type === 'hotspot' );
	const wooLayers = layers.filter( ( layer ) => layer?.type === 'woo' );
	const adapter = makeImageAdapter( frame, img );

	// Everything that must be undone on teardown — resize listener, ResizeObserver
	// and (until it fires) the deferred image `load` handler. Populated as setup
	// progresses so a teardown at any point only unwinds what was actually set up.
	const cleanups = [];
	let torn = false;

	const teardown = () => {
		if ( torn ) {
			return;
		}
		torn = true;
		cleanups.forEach( ( fn ) => {
			try {
				fn();
			} catch ( e ) {}
		} );
		cleanups.length = 0;
		// Clear the drawn markers and reset the guards so the frame can redraw.
		sharedEl.innerHTML = '';
		delete frame.dataset.godamLayersRendered;
		delete frame._godamLayersTeardown;
	};

	// Claim the frame up front (covers the awaiting-load window) so a concurrent
	// call is a no-op; teardown releases it to allow a subsequent redraw.
	frame._godamLayersTeardown = teardown;

	const render = () => {
		// A late `load` firing after teardown, or a stray double call, is a no-op.
		if ( torn || frame.dataset.godamLayersRendered === 'true' ) {
			return;
		}

		let hotspotManager = null;
		let wooManager = null;

		try {
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
				// No analytics on images (see godam-image/render.php): the block does
				// not load the analytics buffer, so the managers' interaction emits are
				// guarded no-ops — there is no `viewed` beacon to fire here.
				hotspotManager.createHotspots( layerObj );
			}

			// Woo layers — resolved from the shared registry (present only when the
			// godam-for-woo add-on is active). Each layer is set up INDIVIDUALLY on
			// its own container rather than merged into one: the Woo manager resolves
			// every marker's style (pulse / icon / custom icon + colours), behaviour
			// (clickBehaviour, tooltipDisplay, pauseOnHover) and analytics id from that
			// layer's own config, and its resize reposition queries `.hotspot` by index
			// WITHIN each layer's element against that layer's productHotspots. Merging
			// (the old behaviour) forced every product to inherit the first layer's
			// style/id, so a second layer's custom icon rendered as the first layer's
			// pulse. A single shared manager instance keeps the product cache/prefetch
			// shared across layers.
			if ( wooLayers.length ) {
				const WooManager = window.godamLayerRegistry?.getLayerManager?.( 'woo' );
				if ( WooManager ) {
					wooManager = new WooManager( adapter, {}, instanceId );
					wooManager.computeContentRect = () => adapter.computeContentRect();
					wooLayers.forEach( ( layer ) => {
						// A per-layer `display:contents` wrapper: it carries no box and
						// forms no stacking context, so all markers still share the ONE
						// overlay's stacking context (the z-index fix) and absolute
						// markers resolve against the positioned `.godam-image__frame`,
						// while giving each layer a private scope for the manager's
						// index-based `.hotspot` reposition queries.
						const layerEl = document.createElement( 'div' );
						layerEl.className = 'godam-image-woo-layer';
						layerEl.style.display = 'contents';
						wooGroup.appendChild( layerEl );
						wooManager.setupLayer( layer, layerEl );
						const layerObj = wooManager.wooLayers[ wooManager.wooLayers.length - 1 ];
						wooManager.createProductHotspots( layerObj );
					} );
				}
			}

			// Reposition markers when the rendered image box changes. The listener
			// and observer are registered for teardown so redraws / unmounts in the
			// editor don't accumulate them (and don't pin a detached <img>).
			const reposition = () => {
				if ( hotspotManager && typeof hotspotManager.updateHotspotPositions === 'function' ) {
					hotspotManager.updateHotspotPositions();
				}
				if ( wooManager && typeof wooManager.updateProductHotspotPositions === 'function' ) {
					wooManager.updateProductHotspotPositions();
				}
			};
			window.addEventListener( 'resize', reposition );
			cleanups.push( () => window.removeEventListener( 'resize', reposition ) );
			if ( 'ResizeObserver' in window ) {
				const observer = new ResizeObserver( reposition );
				observer.observe( img );
				cleanups.push( () => observer.disconnect() );
			}

			// Transform any FontAwesome icon hotspots into inline SVG within THIS
			// frame's document. In the block-editor iframe the global FA observer
			// never sees these nodes, so icon hotspots would otherwise render as
			// empty boxes; on the front end this is a harmless idempotent pass.
			if ( hasHotspotsWithIcons( layers ) ) {
				renderFontAwesomeIcons( frame );
			}

			// Mark rendered only after a fully successful pass. If any manager setup
			// above throws, the guard stays unset so a later call (editor redraw or
			// deferred front-end pass) can retry instead of being stuck.
			frame.dataset.godamLayersRendered = 'true';
		} catch ( e ) {
			// eslint-disable-next-line no-console
			if ( window.console && typeof window.console.error === 'function' ) {
				window.console.error( 'GoDAM image layers: render failed', e );
			}
			// Undo any partial setup and release the frame so it can be retried,
			// rather than leaving it permanently flagged as rendered.
			teardown();
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
		const onLoad = () => start();
		img.addEventListener( 'load', onLoad, { once: true } );
		// Cancel the pending load handler on teardown so a rapid image swap while
		// the previous image is still loading can't fire a stale, late render.
		cleanups.push( () => img.removeEventListener( 'load', onLoad ) );
	}

	return teardown;
}
