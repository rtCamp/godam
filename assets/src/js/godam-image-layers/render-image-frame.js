/**
 * GoDAM Image Layers — shared frame renderer.
 *
 * Draws the saved layers of one `.godam-image__frame` element. Used by both the
 * front-end bootstrap (frontend.js) and the block editor preview (the
 * `godam/image` block's edit.js), which renders the same markup into the
 * editor canvas and calls this against a ref.
 *
 * Layers are mounted through the Layer API runtimes (#2294), exactly as on a
 * video, on a host whose media is the image. Only runtimes that declare
 * `supports.media: [ 'image' ]` run here (core: Hotspot, from its view script
 * `assets/build/layers/hotspot/view.js`; add-ons such as the Woo layer). A tiny "media host" adapter stands in for the
 * Video.js player; timeline and playback methods are no-ops.
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
import { createLayerHost } from './../godam-layers/runtime/host.js';
import { layersUseIconFont, getLayerRuntime, whenLayerRuntime } from './../godam-layers/runtime/registry.js';
import { loadFontAwesome, renderFontAwesomeIcons } from './../godam-player/utils/pluginLoader.js';

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

		try {
			const host = createLayerHost( {
				player: adapter,
				media: { type: 'image', element: img },
				instanceId,
			} );
			cleanups.push( () => host.destroy() );

			// One `display:contents` wrapper per layer inside the SINGLE overlay.
			// They carry no box and form no stacking context, so every marker
			// shares the one overlay's stacking context (the z-index fix) and
			// absolute markers resolve against the positioned frame, while each
			// layer gets a private scope for its manager's index-based `.hotspot`
			// reposition queries.
			const mountLayer = ( layer, runtime ) => {
				const layerEl = document.createElement( 'div' );
				layerEl.className = 'godam-image-layer-item';
				layerEl.dataset.layerType = String( layer?.type || '' );
				layerEl.style.display = 'contents';
				sharedEl.appendChild( layerEl );
				if ( ! host.mount( layer, layerEl, runtime ) ) {
					layerEl.remove();
				}
			};

			layers.forEach( ( layer ) => {
				const runtime = getLayerRuntime( layer?.type );
				if ( runtime ) {
					mountLayer( layer, runtime );
					return;
				}
				// Its view script may still load (deferred or delayed): mount it then.
				const stop = whenLayerRuntime( layer?.type, ( lateRuntime ) => {
					const mountLate = () => {
						if ( torn ) {
							return;
						}
						mountLayer( layer, lateRuntime );
						if ( typeof lateRuntime.usesIconFont === 'function' && lateRuntime.usesIconFont( layer ) ) {
							renderFontAwesomeIcons( frame );
						}
					};
					if ( typeof lateRuntime.usesIconFont === 'function' && lateRuntime.usesIconFont( layer ) ) {
						loadFontAwesome().then( mountLate ).catch( mountLate );
					} else {
						mountLate();
					}
				} );
				cleanups.push( stop );
			} );
			host.dispatch( 'onReady' );

			// Reposition markers when the rendered image box changes. The listener
			// and observer are registered for teardown so redraws / unmounts in the
			// editor don't accumulate them (and don't pin a detached <img>).
			const reposition = () => host.dispatch( 'onResize' );
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
			if ( layersUseIconFont( layers ) ) {
				renderFontAwesomeIcons( frame );

				// Some markers are appended asynchronously (the Woo layer resolves
				// its products over REST first), so the pass above runs
				// before their `<i class="fa-solid ...">` nodes even exist. On the
				// front end FontAwesome's own dom.watch() observer catches them
				// late; inside the editor iframe it never does, leaving Woo product
				// hotspots as empty circles. Watch the overlay and re-run the
				// conversion whenever unconverted icons show up. i2svg replaces the
				// `<i>` with an `<svg>`, so the resulting mutation finds nothing
				// left to convert and the loop settles immediately.
				const iconObserver = new MutationObserver( () => {
					if ( sharedEl.querySelector( 'i[class*="fa-"]' ) ) {
						renderFontAwesomeIcons( frame );
					}
				} );
				iconObserver.observe( sharedEl, { childList: true, subtree: true } );
				cleanups.push( () => iconObserver.disconnect() );
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
		if ( layersUseIconFont( layers ) ) {
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
