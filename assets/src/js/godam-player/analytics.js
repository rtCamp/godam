/**
 * External dependencies
 */
import { Analytics } from 'analytics';
/**
 * Internal dependencies
 */
import videoAnalyticsPlugin from './video-analytics-plugin';
import GTMVideoTracker from './gtm-video-tracker';

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
		const {
			endpoint,
			token,
			userId,
			emailId,
			locationIP,
			isPost,
			isPage,
			isArchive,
			postType,
			postId,
			postTitle,
			categories,
			tags,
			author,
		} = window.videoAnalyticsParams || {};

		// Honour the same skip conditions as the analytics plugin itself.
		if ( ! endpoint || token === 'unverified' ) {
			return null;
		}

		const requestBody = {
			site_url: window.location.origin,
			account_token: token || '',
			wp_user_id: parseInt( userId, 10 ) || 0,
			email: emailId || '',
			visitor_timestamp: Date.now(),
			visit_entry_action_url: window.location.href,
			visit_entry_action_name: document.title,
			referer_url: document.referrer || '',
			referer_name: document.referrer || '',
			location_ip: locationIP || '',
			is_post: isPost === '1',
			is_page: isPage === '1',
			is_archive: isArchive === '1',
			post_type: postType,
			post_id: parseInt( postId, 0 ),
			post_title: postTitle,
			categories,
			tags,
			author,
			type: 2,
			video_id: parseInt( videoId, 10 ),
			job_id: jobId,
			video_ids: [],
			ranges,
			video_length: videoLength,
		};

		// keepalive: true guarantees the request outlives the page. We do NOT
		// await — the browser handles delivery asynchronously at the network
		// layer, entirely outside our JS execution context.
		fetch( endpoint + '/analytics/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( requestBody ),
			keepalive: true,
		} );

		return rangesKey; // Return fingerprint so caller can stamp it.
	} catch ( e ) {
		// Silently ignore — we are in an unload handler and cannot surface errors.
		return null;
	}
}

function setupPlayerAnalytics( player, video ) {
	// Skip if already set up
	if ( video.dataset.analyticsSetup === 'true' ) {
		return;
	}
	video.dataset.analyticsSetup = 'true';

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
