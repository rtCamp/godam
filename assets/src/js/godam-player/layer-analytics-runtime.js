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
 * It also makes sure `window.analytics` exists (see ensureAnalyticsInstance), since
 * the anonymous visitor id is read from there and only the video bundle creates it.
 *
 * @package
 */

/**
 * External dependencies
 */
import { Analytics } from 'analytics';

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
 * App name of the video player's analytics instance (`analytics.js`), reused so the
 * fallback instance below is configured the same way.
 */
const ANALYTICS_APP_NAME = 'analytics-cdp-plugin';

/**
 * Make sure `window.analytics` exists, so the anonymous visitor id can be read on a
 * page that never loads the video bundle (e.g. one whose only GoDAM content is an
 * Image block with product hotspots).
 *
 * This runtime's flush and the Woo add-on's in-image add-to-cart send
 * `window.analytics.user().anonymousId` as the user_token. Without an instance it
 * was '', and the add-on refuses Direct attribution for an empty token, so the
 * sale's revenue was lost.
 *
 * The fallback is the library the player bundles, with the player's app name and
 * NO plugins, so it sends nothing, and nothing here calls page() or track() on it.
 * It reads the stored visitor id, or creates and stores one, under the storage key
 * the player's instance reads, so a visitor keeps one id across image and video
 * pages.
 *
 * An existing `window.analytics` (the player's, or any other) is never replaced.
 * If the player bundle runs later on the page, its own assignment replaces the
 * fallback. A new id is stored in promise work that a browser finishes between two
 * scripts, so the player reads it; if both bundles were concatenated into one
 * script, the player stores its own id instead, before the fallback's can be read.
 *
 * @return {Object} The instance on `window.analytics`.
 */
export function ensureAnalyticsInstance() {
	if ( ! window.analytics ) {
		window.analytics = Analytics( { app: ANALYTICS_APP_NAME } );
	}
	return window.analytics;
}

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
 * (registered by the video bundle) is left in place, and THIS module binds its
 * flush listeners at most once, guarded by `window.godamLayerFlushBound`. On a
 * mixed video+image page the video bundle (`analytics.js`) also flushes the buffer
 * from its own unload handler; that is harmless because `flushLayerInteractions`
 * clears the buffer after dispatch, so the later flush is a no-op.
 */
export function initLayerAnalytics() {
	// First, so the visitor id is readable before any hotspot can be clicked.
	ensureAnalyticsInstance();

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
