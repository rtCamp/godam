/**
 * External dependencies
 */
import { Analytics } from 'analytics';
/**
 * Internal dependencies
 */
import videoAnalyticsPlugin from './video-analytics-plugin';
import GTMVideoTracker from './gtm-video-tracker';
import { shouldSkipAnalytics, buildAnalyticsRequestBody } from './analytics-helpers';

const analytics = Analytics( {
	app: 'analytics-cdp-plugin',
	plugins: [
		videoAnalyticsPlugin(),
	],
} );
window.analytics = analytics;

/**
 * Collect all played time ranges from a VideoJS player instance.
 * Module-scoped so it is accessible to both the IIFE (trackVideoEvent)
 * and the module-level sendPlayerHeatmap function.
 *
 * @param {Object} player - VideoJS player instance
 * @return {Array} Array of [start, end] pairs representing played ranges
 */
function collectPlayedRanges( player ) {
	const played = player && player.played && player.played();
	const ranges = [];
	if ( played && typeof played.length === 'number' ) {
		for ( let i = 0; i < played.length; i++ ) {
			ranges.push( [ played.start( i ), played.end( i ) ] );
		}
	}
	return ranges;
}

// Generic video analytics helper
( function() {
	function findVideoElementById( videoId, root ) {
		const ctx = root && root.querySelector ? root : document;
		return ctx.querySelector(
			`.easydam-player.video-js[data-id="${ videoId }"], .video-js[data-id="${ videoId }"]`,
		);
	}
	window.GoDAM = window.GoDAM || {};
	window.GoDAM.findVideoElementById = findVideoElementById; // Exposed for other plugins as a global helper.

	function getPlayer( el ) {
		if ( ! el ) {
			return null;
		}
		if ( el.player && typeof el.player.played === 'function' ) {
			return el.player;
		}
		try {
			return videojs.getPlayer( el ); // eslint-disable-line no-undef -- variable is defined globally
		} catch ( e ) {
			return null;
		}
	}

	// Attach to window.analytics
	/**
	 * Tracks video analytics events for engagement and heatmap data.
	 *
	 * @param {Object}           params                - The parameters object
	 * @param {number}           params.type           - Event type (currently only supports type 2 for heatmap)
	 * @param {number}           [params.videoId]      - Specific video ID to track. If not provided, will auto-detect current video
	 * @param {Element|Document} [params.root]         - Root element to search for video elements. Defaults to document
	 *
	 * @param {boolean}          [params.sendPageLoad] - Whether to send a type 1 'page_load' event before the heatmap event. Defaults to true.
	 * @return {boolean} Returns true if event was successfully tracked, false otherwise
	 *
	 * @description
	 * This function handles video analytics tracking with the following behavior:
	 *
	 * **IMPORTANT: Automatic Type 1 Event Behavior**
	 * When type 2 (heatmap) is requested, this function automatically sends a type 1 'page_load' (Video Loaded)
	 * event BEFORE sending the type 2 (Video Played) event, if sendPageLoad is true (default true). This behavior is intentional but may result
	 * in duplicate type 1 events in certain scenarios:
	 *
	 * - Called during video switches: Will send type 2 for the old video
	 * - Called when videos are closed: Will send type 2 for the closing video
	 *
	 * **Event Types:**
	 * - Type 1: Video Loaded (automatically sent before type 2)
	 * - Type 2: Video Played (main functionality)
	 *
	 * @since 1.4.2
	 */
	window.analytics.trackVideoEvent = ( { type, videoId, root, sendPageLoad = true } = {} ) => {
		if ( ! type ) {
			return false;
		}
		// Type 2: heatmap (derive ranges and length via videojs)
		if ( type === 2 ) {
			const ctx = root && root.querySelector ? root : document;
			let vid = videoId;
			let jobId = '';

			const videoEl = findVideoElementById( vid, root ) || ctx.querySelector( '.easydam-player.video-js, .video-js' );

			// If no videoId provided, automatically find the current video
			if ( ! vid && videoEl ) {
				vid = parseInt( videoEl.getAttribute( 'data-id' ), 10 ) || 0;
			}

			if ( videoEl ) {
				jobId = videoEl.getAttribute( 'data-job_id' ) || '';
			}

			vid = parseInt( vid, 10 ) || 0;
			if ( ! vid ) {
				return false;
			}

			// Send type 1 first (for the current video) if sendPageLoad is true
			// NOTE: This automatically sends a 'page_load' event before the heatmap event, for ease of use.
			// This is intentional behavior but may cause duplicate type 1 events in some scenarios
			if ( sendPageLoad ) {
				window.analytics.track( 'page_load', { type: 1, videoIds: [ [ vid, jobId ] ] } );
			}

			const player = getPlayer( videoEl );
			if ( ! player ) {
				return false;
			}

			const ranges = collectPlayedRanges( player );
			if ( ranges.length === 0 ) {
				return false;
			}

			const videoLength = Number( player.duration && player.duration() ) || 0;

			window.analytics.track( 'video_heatmap', {
				type: 2,
				videoId: vid,
				jobId,
				ranges,
				videoLength,
			} );
			return true;
		}

		return false;
	};
}() );

if ( ! window.pageLoadEventTracked ) {
	window.pageLoadEventTracked = true; // Mark as tracked to avoid duplicate execution

	document.addEventListener( 'DOMContentLoaded', () => {
		const videos = document.querySelectorAll( '.easydam-player.video-js' );

		// Collect all video IDs and Job IDs
		const videoInfo = Array.from( videos )
			.map( ( video ) => ( {
				id: video.getAttribute( 'data-id' ),
				jobId: video.getAttribute( 'data-job_id' ) || '',
			} ) )
			.filter( ( info ) => info.id !== null && info.id !== '' && ! isNaN( info.id ) )
			.map( ( info ) => [ parseInt( info.id, 10 ), info.jobId ] );

		// Send a single page_load request with all video ID and Job ID pairs
		if ( window.analytics && videoInfo.length > 0 ) {
			window.analytics.track( 'page_load', {
				type: 1, // Enum: 1 = Page Load
				videoIds: videoInfo, // Array of [video_id, job_id] pairs
			} );
		}

		// Set up analytics for each player when it's ready
		// This prevents double initialization issues during async plugin loading
		document.addEventListener( 'godamPlayerReady', ( event ) => {
			setupPlayerAnalytics( event.detail.player, event.detail.videoElement );
		} );

		// Also try to set up analytics for any players that are already ready
		// (in case this runs after some players are initialized)
		playerAnalytics();
	} );
}

/**
 * Setup analytics for a single player
 * Extracted to avoid double initialization
 *
 * @param {Object}      player - VideoJS player instance
 * @param {HTMLElement} video  - Video container element
 */
// Store the Map on window so all script evaluations share the same instance.
// If this script runs more than once (guarded via window.pageLoadEventTracked),
// the already-bound unload handler will still see every player registered by any run.
window.godamTrackedPlayers = window.godamTrackedPlayers || new Map();

// Global listener for analytics
if ( ! window.godamUnloadListenerBound ) {
	window.godamUnloadListenerBound = true;

	/**
	 * Final flush on true page unload (navigation away or tab close).
	 * Clears the map since the page will not recover.
	 */
	const handleUnload = () => {
		window.godamTrackedPlayers.forEach( ( entry, playerInstance ) => {
			// Parent gallery already POSTed this player's heatmap from its
			// own context; skipping here avoids the duplicate (and the
			// cancelled retry that the browser kills during iframe teardown).
			if ( entry.flushedByGallery ) {
				return;
			}
			// Pass lastSentKey so sendPlayerHeatmap skips if visibilitychange already
			// sent these exact ranges (avoids double-send on tab close).
			sendPlayerHeatmap( playerInstance, entry.videoEl, entry.lastSentKey );
		} );
		// Clear to avoid duplicate sends if the event fires multiple times (e.g. cancelled unload).
		window.godamTrackedPlayers.clear();
	};

	/**
	 * Intermediate flush when the page is hidden (tab switch, window minimize, screen lock).
	 *
	 * visibilitychange fires before pagehide/beforeunload, so when a user closes a tab
	 * BOTH events fire in sequence. To prevent sending the same data twice, we stamp a
	 * fingerprint (JSON of ranges) on the entry after sending. The final unload handler
	 * re-computes the current ranges — if they match the fingerprint, the user did not
	 * watch anything new after returning, so we skip. If they differ, updated data is sent.
	 */
	const handleVisibilityHidden = () => {
		if ( document.visibilityState === 'hidden' ) {
			window.godamTrackedPlayers.forEach( ( entry, playerInstance ) => {
				// Parent gallery has already claimed this player — skip.
				if ( entry.flushedByGallery ) {
					return;
				}
				const sent = sendPlayerHeatmap( playerInstance, entry.videoEl );
				if ( sent ) {
					// Stamp the ranges that were just sent so the unload handler
					// can skip if nothing new was watched after the user returned.
					entry.lastSentKey = sent;
				}
			} );
			// Intentionally NOT clearing the map — ranges keep accumulating if user returns.
		}
	};

	window.addEventListener( 'beforeunload', handleUnload );
	window.addEventListener( 'pagehide', handleUnload ); // For better mobile / bfcache support
	document.addEventListener( 'visibilitychange', handleVisibilityHidden ); // Tab switch, minimize, screen lock
}

/**
 * Build a heatmap analytics payload for a single player without sending it.
 *
 * Split out from sendPlayerHeatmap so the same payload can be either:
 * - fetched from this context (the normal unload/dispose path), or
 * - handed to a parent window via postMessage (the gallery-modal-close path,
 * where the iframe is about to be torn down and an in-context fetch would
 * be cancelled by the browser).
 *
 * @param {Object}      player    - VideoJS player instance
 * @param {HTMLElement} video     - Video container element
 * @param {string|null} skipIfKey - Skip when current ranges fingerprint matches this key.
 * @return {{endpoint: string, body: Object, fingerprint: string}|null} - Payload data for the heatmap event, or null if no valid payload could be built or if skipped due to matching skipIfKey.
 */
function buildHeatmapPayload( player, video, skipIfKey = null ) {
	if ( ! player || ! video ) {
		return null;
	}

	try {
		if ( typeof player.isDisposed === 'function' && player.isDisposed() ) {
			return null;
		}

		const ranges = collectPlayedRanges( player );
		if ( ranges.length === 0 ) {
			return null;
		}

		const fingerprint = JSON.stringify( ranges );
		if ( skipIfKey && fingerprint === skipIfKey ) {
			return null;
		}

		const videoId = video.getAttribute( 'data-id' );
		const jobId = video.getAttribute( 'data-job_id' ) || '';
		if ( ! videoId ) {
			return null;
		}

		if ( shouldSkipAnalytics() ) {
			return null;
		}

		const videoLength = Number( player.duration && player.duration() ) || 0;

		const { endpoint, body } = buildAnalyticsRequestBody( {
			type: 2,
			userToken: window.analytics?.user?.()?.anonymousId || '',
			videoId: parseInt( videoId, 10 ),
			jobId,
			ranges,
			videoLength,
		} );

		if ( ! endpoint ) {
			return null;
		}

		return { endpoint, body, fingerprint };
	} catch ( e ) {
		return null;
	}
}

/**
 * Send heatmap data for a single player via a keepalive fetch.
 *
 * Returns a string fingerprint of the ranges sent (used by the visibilitychange handler
 * to avoid re-sending identical data in the subsequent pagehide/beforeunload), or null
 * if nothing was sent.
 *
 * @param {Object}      player    - VideoJS player instance
 * @param {HTMLElement} video     - Video container element
 * @param {string|null} skipIfKey - If provided, skip sending when current ranges fingerprint matches this key.
 * @return {string|null} Fingerprint of sent ranges, or null if skipped.
 */
function sendPlayerHeatmap( player, video, skipIfKey = null ) {
	const payload = buildHeatmapPayload( player, video, skipIfKey );
	if ( ! payload ) {
		return null;
	}

	/*
	 * IMPORTANT: We bypass window.analytics.track() here intentionally.
	 *
	 * This function is called from beforeunload / pagehide / dispose handlers.
	 * window.analytics.track() dispatches async work (Promises, microtasks).
	 * The browser does NOT block page unload waiting for async work to settle.
	 *
	 * keepalive: true queues the request at the network layer so it survives
	 * top-level page unload. Note: keepalive does NOT survive iframe element
	 * removal by the parent — that case is handled by the gallery's
	 * `godamGalleryFlushPayloads` direct-call flow below.
	 *
	 * Reference: https://fetch.spec.whatwg.org/#keep-alive-flag
	 */
	fetch( payload.endpoint + '/analytics/', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify( payload.body ),
		keepalive: true,
	} );

	return payload.fingerprint;
}

/*
 * Gallery-modal-close flush — exposed for the GoDAM gallery modal in the
 * parent window. Returns the heatmap payloads the parent should POST from
 * its own (not-being-destroyed) context before tearing this iframe down.
 * Sending them from here would lose the request to the iframe-teardown
 * cancel. Stamps each player's lastSentKey so the iframe's own pagehide /
 * dispose handlers will dedupe and skip the same ranges later.
 *
 * Same-origin only. The parent calls `iframe.contentWindow.godamGalleryFlushPayloads()`
 * directly; if the iframe is cross-origin the access throws SecurityError
 * which the parent catches and falls through to its normal close path.
 */
// Only expose the gallery flush API when this script is running inside a
// gallery iframe. The gallery embeds the video-embed page with
// `?godam_gallery=1` in the iframe URL; on any other page (standalone embed,
// admin preview, regular video on a post) the function is not defined and
// `flushedByGallery` never gets set — so all non-gallery analytics paths
// behave exactly as they did before this change.
const isGalleryIframeContext = ( () => {
	try {
		return new URLSearchParams( window.location.search ).get( 'godam_gallery' ) === '1';
	} catch ( e ) {
		return false;
	}
} )();

if ( isGalleryIframeContext ) {
	window.godamGalleryFlushPayloads = function() {
		const payloads = [];
		if ( ! window.godamTrackedPlayers ) {
			return payloads;
		}
		window.godamTrackedPlayers.forEach( ( entry, playerInstance ) => {
			const payload = buildHeatmapPayload(
				playerInstance,
				entry.videoEl,
				entry.lastSentKey,
			);
			if ( payload ) {
				payloads.push( { endpoint: payload.endpoint, body: payload.body } );
				entry.lastSentKey = payload.fingerprint;
			}
			// Set unconditionally — even when buildHeatmapPayload returned null.
			// Every null-return represents "nothing to send right now" (no ranges,
			// already-sent fingerprint, disposed, skip-analytics flag, etc.), so
			// suppressing the iframe-side handlers is always safe here. Setting it
			// only inside `if ( payload )` would be a regression: if more ranges
			// accumulate between this call and iframe teardown, the iframe's own
			// pagehide/dispose would fire and get cancelled by the teardown — the
			// exact failure mode this whole flow exists to prevent.
			entry.flushedByGallery = true;
		} );
		return payloads;
	};
}

function setupPlayerAnalytics( player, video ) {
	// Skip if already set up for this player instance.
	// We use the player object rather than the DOM element because
	// godamPlayerReady provides the raw <video> element, but playerAnalytics()
	// queries the wrapper <div> element. Attaching to player prevents double-setup.
	if ( player._godamAnalyticsSetup ) {
		return;
	}
	player._godamAnalyticsSetup = true;
	video.dataset.analyticsSetup = 'true'; // Keep for backwards compatibility

	// Track the active player. Entry shape: { videoEl, lastSentKey }
	// lastSentKey is the JSON fingerprint of the last ranges sent via visibilitychange,
	// used to avoid re-sending identical data in the subsequent pagehide/beforeunload.
	window.godamTrackedPlayers.set( player, { videoEl: video, lastSentKey: null } );

	// Initialize GTM tracker for this video
	if ( typeof window.dataLayer !== 'undefined' && window.godamSettings?.enableGTMTracking ) {
		const gtmTracker = new GTMVideoTracker( player, video );
		// Store tracker reference for potential cleanup
		video.gtmTracker = gtmTracker;
	}

	// Send heatmap when player is unmounted/disposed (e.g. AJAX navigation)
	player.on( 'dispose', () => {
		if ( window.godamTrackedPlayers.has( player ) ) {
			const entry = window.godamTrackedPlayers.get( player );
			// Parent gallery already sent this player's heatmap from its
			// own context — don't fire a second (cancelled) request as the
			// iframe tears down.
			if ( ! entry.flushedByGallery ) {
				sendPlayerHeatmap( player, entry.videoEl, entry.lastSentKey );
			}
			window.godamTrackedPlayers.delete( player );
		}
	} );
}

/**
 * Initialize analytics for all players on the page
 * Only sets up analytics for players that are already initialized
 */
function playerAnalytics() {
	const videos = document.querySelectorAll( '.easydam-player.video-js' );

	videos.forEach( ( video ) => {
		// Skip if player is still initializing
		if ( video.dataset.videojsInitializing === 'true' ) {
			return;
		}

		// Get existing player, don't initialize new ones here
		// Wrap in try-catch to prevent errors on pages without actual video players
		let player = null;
		try {
			player = videojs.getPlayer( video ); // eslint-disable-line no-undef -- variable is defined globally
		} catch ( e ) {
			// Player not initialized or element is not a valid video element
			return;
		}

		if ( ! player ) {
			// Player not ready yet, skip analytics setup for now
			// It will be set up via godamPlayerReady event
			return;
		}

		setupPlayerAnalytics( player, video );
	} );
}
