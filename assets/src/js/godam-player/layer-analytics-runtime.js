/**
 * Standalone layer-analytics runtime.
 *
 * Registers `window.GoDAM.addLayerInteraction` + `flushLayerInteractions` and the
 * page-hide flush listeners WITHOUT the video player. It exists so a page that has
 * only a GoDAM Image block (product hotspots on a still image) can capture hotspot
 * interactions: those pages never load `godam-player-analytics.min.js` (which pulls
 * in the whole video player), so the emit calls in the shared hotspot managers were
 * previously guarded no-ops.
 *
 * The video-player analytics bundle (`analytics.js`) still registers the same buffer
 * API for video pages. This module is deliberately idempotent and does NOT overwrite
 * an existing registration, so on a page that somehow has both a video and an image
 * the first loader wins and there is exactly one buffer + one set of flush listeners.
 * (Folding `analytics.js` onto this shared module to remove the remaining duplication
 * is a tracked follow-up; kept separate here so the in-review video analytics is
 * untouched.)
 *
 * @package
 */

/**
 * Internal dependencies
 */
import { shouldSkipAnalytics, buildAnalyticsRequestBody } from './analytics-helpers';
import {
	addLayerInteraction as bufferAddLayerInteraction,
	getLayerInteractions as bufferGetLayerInteractions,
	clearLayerInteractions as bufferClearLayerInteractions,
} from './utils/storage';
import { LAYER_ACTIONS, LAYER_TYPE_WHITELIST, getLayerDisplayName } from './utils/layerActions';

/**
 * Find the element carrying analytics identity for a numeric key.
 *
 * A video lives on `.video-js[data-id]`; an image-block hotspot frame lives on
 * `.godam-image__frame[data-id]`. The image fallback is why a still image's
 * `block_source` ('godam-image') survives the flush: without it the lookup finds
 * nothing and the surface tag falls back to '' (unattributed).
 *
 * @param {number}           videoId Numeric attachment id (video or image).
 * @param {Element|Document} [root]  Optional search root.
 * @return {HTMLElement|null} The identity element, or null.
 */
export function findVideoElementById( videoId, root ) {
	const ctx = root && root.querySelector ? root : document;
	return (
		ctx.querySelector(
			`.easydam-player.video-js[data-id="${ videoId }"], .video-js[data-id="${ videoId }"]`,
		) || ctx.querySelector( `.godam-image__frame[data-id="${ videoId }"]` )
	);
}

/**
 * Host-post attribution for a single identity element.
 *
 * @param {HTMLElement|null} el The element (or null).
 * @return {number|null} The host page's post ID, or null when not stamped.
 */
function elementHostPostId( el ) {
	const id = parseInt( el?.dataset?.hostPostId, 10 );
	return id > 0 ? id : null;
}

/**
 * Drain the buffered type=3 layer interactions and POST them, grouped by the
 * effective video/image key. Mirrors the video bundle's flush, plus the image
 * fallback in findVideoElementById above.
 */
function flushLayerInteractions() {
	if ( shouldSkipAnalytics() ) {
		bufferClearLayerInteractions();
		return;
	}

	const buffer = bufferGetLayerInteractions();
	const videoKeys = Object.keys( buffer );
	if ( videoKeys.length === 0 ) {
		return;
	}

	// The microservice enforces a max of 100 layer entries per request.
	const MAX_PER_REQUEST = 100;

	for ( const videoKey of videoKeys ) {
		const events = Array.isArray( buffer[ videoKey ] ) ? buffer[ videoKey ] : [];
		if ( events.length === 0 ) {
			continue;
		}

		// videoKey is the WP attachment id (numeric) or the job_id.
		const numericId = parseInt( videoKey, 10 );
		const isNumeric = Number.isFinite( numericId ) && String( numericId ) === videoKey;

		// Surface + host attribution rides along when the identity element is still
		// in the DOM at flush time; best-effort, '' otherwise.
		const flushVideoEl = isNumeric
			? findVideoElementById( numericId )
			: document.querySelector( `.video-js[data-job_id="${ videoKey }"]` );

		for ( let i = 0; i < events.length; i += MAX_PER_REQUEST ) {
			const chunk = events.slice( i, i + MAX_PER_REQUEST );
			const { endpoint, body } = buildAnalyticsRequestBody( {
				type: 3,
				userToken: window.analytics?.user?.()?.anonymousId || '',
				videoId: isNumeric ? numericId : 0,
				jobId: isNumeric ? '' : videoKey,
				layers: chunk,
				blockSource: flushVideoEl?.dataset?.blockSource || '',
				hostPostId: elementHostPostId( flushVideoEl ),
			} );

			if ( ! endpoint ) {
				continue;
			}

			fetch( endpoint + '/analytics/', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify( body ),
				keepalive: true,
			} );
		}
	}

	// Clear after dispatch (keepalive carries the requests even through teardown);
	// re-sending on a later flush would double-count.
	bufferClearLayerInteractions();
}

/**
 * Register the layer buffer API and bind the page-hide flush listeners, once.
 *
 * Idempotent and non-destructive: an existing `window.GoDAM.addLayerInteraction`
 * (registered by the video bundle) is left in place, and the flush listeners bind
 * only once across all evaluations via `window.godamLayerFlushBound`.
 */
export function initLayerAnalytics() {
	window.GoDAM = window.GoDAM || {};

	// Register the buffer API only if the video bundle has not already done so, so
	// the two bundles never install competing implementations on one page.
	if ( typeof window.GoDAM.addLayerInteraction !== 'function' ) {
		window.GoDAM.addLayerInteraction = bufferAddLayerInteraction;
		window.GoDAM.getLayerInteractions = bufferGetLayerInteractions;
		window.GoDAM.clearLayerInteractions = bufferClearLayerInteractions;
		window.GoDAM.flushLayerInteractions = flushLayerInteractions;
		window.GoDAM.findVideoElementById = findVideoElementById;
		window.GoDAM.LAYER_ACTIONS = LAYER_ACTIONS;
		window.GoDAM.LAYER_TYPE_WHITELIST = LAYER_TYPE_WHITELIST;
		window.GoDAM.getLayerDisplayName = getLayerDisplayName;
	}

	if ( window.godamLayerFlushBound ) {
		return;
	}
	window.godamLayerFlushBound = true;

	const flush = () => {
		try {
			window.GoDAM?.flushLayerInteractions?.();
		} catch ( e ) {
			// Best-effort: a flush failure must never throw on unload.
		}
	};
	const flushOnHidden = () => {
		if ( document.visibilityState === 'hidden' ) {
			flush();
		}
	};

	window.addEventListener( 'beforeunload', flush );
	window.addEventListener( 'pagehide', flush ); // Mobile / bfcache.
	document.addEventListener( 'visibilitychange', flushOnHidden ); // Tab switch, minimize.
}
