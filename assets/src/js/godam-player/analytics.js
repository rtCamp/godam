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

/**
 * Resolve the canonical video element used for analytics.
 * Falls back to a descendant so callers can pass either the raw <video>
 * element or a wrapping player container.
 *
 * @param {HTMLElement} video - Candidate video or wrapper element.
 * @return {HTMLElement|null} The element carrying analytics data attributes.
 */
function resolveAnalyticsVideoElement( video ) {
	if ( ! video ) {
		return null;
	}

	if ( video.getAttribute?.( 'data-instance-id' ) ) {
		return video;
	}

	return video.querySelector?.( '[data-instance-id]' ) || null;
}

/**
 * Build analytics metadata for a single video instance.
 *
 * @param {HTMLElement} video - Candidate video or wrapper element.
 * @return {{ videoEl: HTMLElement, instanceId: string, videoId: number, jobId: string }|null} Parsed analytics data.
 */
function getPageLoadVideoInfo( video ) {
	const videoEl = resolveAnalyticsVideoElement( video );
	const instanceId = videoEl?.getAttribute( 'data-instance-id' ) || '';
	const videoId = parseInt( videoEl?.getAttribute( 'data-id' ), 10 ) || 0;

	if ( ! videoEl || ! instanceId || ! videoId ) {
		return null;
	}

	return {
		videoEl,
		instanceId,
		videoId,
		jobId: videoEl.getAttribute( 'data-job_id' ) || '',
	};
}

// Keep instance tracking on window so repeat evaluations share one registry.
window.godamTrackedPageLoadInstances = window.godamTrackedPageLoadInstances || new Set();
window.godamObservedPageLoadVideos = window.godamObservedPageLoadVideos || new WeakSet();
window.godamPageLoadObserver = window.godamPageLoadObserver || null;

/**
 * Send a type 1 page_load event for a single video instance exactly once.
 * Deduplication is per data-instance-id so duplicate renders of the same
 * underlying video each send independently, while re-entries do not.
 *
 * @param {HTMLElement} video - Candidate video or wrapper element.
 * @return {boolean} True when an event was sent, false otherwise.
 */
function trackPageLoadForVideo( video ) {
	const videoInfo = getPageLoadVideoInfo( video );

	if ( ! videoInfo || ! window.analytics ) {
		return false;
	}

	if ( window.godamTrackedPageLoadInstances.has( videoInfo.instanceId ) ) {
		return false;
	}

	window.analytics.track( 'page_load', {
		type: 1,
		videoIds: [ [ videoInfo.videoId, videoInfo.jobId ] ],
	} );

	window.godamTrackedPageLoadInstances.add( videoInfo.instanceId );

	return true;
}

/**
 * Observe a video instance and send its page_load event the first time at
 * least 10% of it is visible in the viewport.
 *
 * @param {HTMLElement} video - Candidate video or wrapper element.
 */
function observePageLoadForVideo( video ) {
	const videoInfo = getPageLoadVideoInfo( video );

	if ( ! videoInfo ) {
		return;
	}

	if (
		window.godamTrackedPageLoadInstances.has( videoInfo.instanceId ) ||
		window.godamObservedPageLoadVideos.has( videoInfo.videoEl )
	) {
		return;
	}

	if ( ! ( 'IntersectionObserver' in window ) ) {
		trackPageLoadForVideo( videoInfo.videoEl );
		return;
	}

	if ( ! window.godamPageLoadObserver ) {
		window.godamPageLoadObserver = new IntersectionObserver(
			( entries, observer ) => {
				entries.forEach( ( entry ) => {
					if ( ! entry.isIntersecting || entry.intersectionRatio < 0.1 ) {
						return;
					}

					trackPageLoadForVideo( entry.target );
					observer.unobserve( entry.target );
					window.godamObservedPageLoadVideos.delete( entry.target );
				} );
			},
			{
				root: null,
				rootMargin: '0px',
				threshold: 0.1,
			},
		);
	}

	window.godamObservedPageLoadVideos.add( videoInfo.videoEl );
	window.godamPageLoadObserver.observe( videoInfo.videoEl );
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
	 * event BEFORE sending the type 2 (Video Played) event, if sendPageLoad is true (default true). This behavior is intentional and now uses
	 * the shared per-instance type 1 helper so viewport-triggered and type 2-triggered sends stay deduplicated:
	 *
	 * - Called during video switches: Will send a type 1 fallback only if that video instance has not already been tracked
	 * - Called when videos are closed: Will send a type 1 fallback only if that video instance has not already been tracked
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

			// Send type 1 first (for the current video instance) if sendPageLoad is true.
			// This reuses the shared page_load helper so viewport and heatmap paths
			// follow the same per-instance deduplication rules.
			if ( sendPageLoad ) {
				trackPageLoadForVideo( videoEl );
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
	window.pageLoadEventTracked = true; // Mark page_load tracking listeners as initialized.

	document.addEventListener( 'DOMContentLoaded', () => {
		const videos = document.querySelectorAll( '.easydam-player.video-js' );

		// Observe all current videos and send type 1 only when each individual
		// player instance first enters the viewport.
		videos.forEach( ( video ) => observePageLoadForVideo( video ) );

		// Set up analytics for each player when it's ready
		// This prevents double initialization issues during async plugin loading
		document.addEventListener( 'godamPlayerReady', ( event ) => {
			observePageLoadForVideo( event.detail.videoElement );
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
	if ( ! player || ! video ) {
		return null;
	}

	try {
		// Double check player isn't disposed natively beforehand
		if ( typeof player.isDisposed === 'function' && player.isDisposed() ) {
			return null;
		}

		const ranges = collectPlayedRanges( player );

		if ( ranges.length === 0 ) {
			return null; // Nothing played — skip
		}

		const rangesKey = JSON.stringify( ranges );

		// Skip if the caller already sent these exact ranges (visibilitychange → pagehide dedup).
		if ( skipIfKey && rangesKey === skipIfKey ) {
			return null;
		}

		const videoId = video.getAttribute( 'data-id' );
		const jobId = video.getAttribute( 'data-job_id' ) || '';
		if ( ! videoId ) {
			return null;
		}

		// Skip the same conditions the analytics plugin does.
		if ( shouldSkipAnalytics() ) {
			return null;
		}

		const videoLength = Number( player.duration && player.duration() ) || 0;

		/*
		 * IMPORTANT: We bypass window.analytics.track() here intentionally.
		 *
		 * This function is called from beforeunload / pagehide / dispose handlers.
		 * window.analytics.track() dispatches async work (Promises, microtasks).
		 * The browser does NOT block page unload waiting for async work to settle —
		 * the async chain can be silently abandoned mid-flight.
		 *
		 * The correct fix is to call fetch() with keepalive: true SYNCHRONOUSLY
		 * inside the handler. The browser queues a keepalive request at the network
		 * level and guarantees delivery even after the JS context is torn down.
		 * This is the spec-compliant equivalent of navigator.sendBeacon() for POST
		 * requests that need a JSON body.
		 *
		 * Reference: https://fetch.spec.whatwg.org/#keep-alive-flag
		 */
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

		// keepalive: true guarantees the request outlives the page. We do NOT
		// await — the browser handles delivery asynchronously at the network
		// layer, entirely outside our JS execution context.
		fetch( endpoint + '/analytics/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( body ),
			keepalive: true,
		} );

		return rangesKey; // Return fingerprint so caller can stamp it.
	} catch ( e ) {
		// Silently ignore — we are in an unload handler and cannot surface errors.
		return null;
	}
}

function setupPlayerAnalytics( player, video ) {
	observePageLoadForVideo( video );

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
		// Store tracker reference for potential cleanup
		video.gtmTracker = new GTMVideoTracker( player, video );
	}

	// Send heatmap when player is unmounted/disposed (e.g. AJAX navigation)
	player.on( 'dispose', () => {
		const pageLoadVideo = resolveAnalyticsVideoElement( video );
		if ( pageLoadVideo && window.godamPageLoadObserver ) {
			window.godamPageLoadObserver.unobserve( pageLoadVideo );
			window.godamObservedPageLoadVideos.delete( pageLoadVideo );
		}

		if ( window.godamTrackedPlayers.has( player ) ) {
			const { videoEl, lastSentKey } = window.godamTrackedPlayers.get( player );
			sendPlayerHeatmap( player, videoEl, lastSentKey );
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
