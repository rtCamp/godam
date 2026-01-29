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

// Generic video analytics helper
( function() {
	function findVideoElementById( videoId, root ) {
		const ctx = root && root.querySelector ? root : document;
		return ctx.querySelector(
			`.easydam-player.video-js[data-id="${ videoId }"], .video-js[data-id="${ videoId }"]`,
		);
	}
	window.findVideoElementById = findVideoElementById; // Exposed for other plugins as a global helper.

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
function setupPlayerAnalytics( player, video ) {
	// Skip if already set up
	if ( video.dataset.analyticsSetup === 'true' ) {
		return;
	}
	video.dataset.analyticsSetup = 'true';

	// Initialize GTM tracker for this video
	if ( typeof window.dataLayer !== 'undefined' && window.godamSettings?.enableGTMTracking ) {
		const gtmTracker = new GTMVideoTracker( player, video );
		// Store tracker reference for potential cleanup
		video.gtmTracker = gtmTracker;
	}

	window.addEventListener( 'beforeunload', () => {
		const played = player.played();
		const ranges = [];
		const videoLength = player.duration();

		// Extract time ranges from the player.played() object
		for ( let i = 0; i < played.length; i++ ) {
			ranges.push( [ played.start( i ), played.end( i ) ] );
		}

		// Send the ranges using updateHeatmap
		updateHeatmap( ranges, videoLength );
	} );

	async function updateHeatmap( ranges, videoLength ) {
		const videoId = video.getAttribute( 'data-id' );
		const jobId = video.getAttribute( 'data-job_id' ) || '';
		if ( ! videoId || ranges.length === 0 ) {
			return; // Skip sending if no valid data
		}

		if ( window.analytics ) {
			window.analytics.track( 'video_heatmap', {
				type: 2, // Enum: 2 = Heatmap
				videoId: parseInt( videoId, 10 ),
				jobId,
				ranges,
				videoLength,
			} );
		}
	}
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
