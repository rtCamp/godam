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
	 * @param {Array}            [params.ranges]       - Pre-collected played ranges for the video
	 * @param {number}           [params.videoLength]  - Pre-collected video length
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
	window.analytics.trackVideoEvent = ( { type, videoId, root, sendPageLoad = true, ranges: providedRanges, videoLength: providedLength } = {} ) => {
		if ( ! type ) {
			return false;
		}
		// Type 2: heatmap (derive ranges and length via videojs or use provided data)
		if ( type === 2 ) {
			let vid = videoId;
			let ranges = providedRanges;
			let videoLength = providedLength;

			// If ranges not provided, try to collect from current player
			if ( ! ranges ) {
				const ctx = root && root.querySelector ? root : document;

				// If no videoId provided, automatically find the current video
				if ( ! vid ) {
					const videoEl = ctx.querySelector( '.easydam-player.video-js, .video-js' );
					vid = videoEl ? parseInt( videoEl.getAttribute( 'data-id' ), 10 ) : 0;
				}

				vid = parseInt( vid, 10 ) || 0;
				if ( ! vid ) {
					return false;
				}

				// Send type 1 first (for the current video) if sendPageLoad is true
				// NOTE: This automatically sends a 'page_load' event before the heatmap event, for ease of use.
				// This is intentional behavior but may cause duplicate type 1 events in some scenarios
				if ( sendPageLoad ) {
					window.analytics.track( 'page_load', { type: 1, videoIds: [ vid ] } );
				}

				const el = findVideoElementById( vid, root );
				const player = getPlayer( el );
				if ( ! player ) {
					return false;
				}

				ranges = collectPlayedRanges( player );
				videoLength = Number( player.duration && player.duration() ) || 0;
			} else {
				vid = parseInt( vid, 10 ) || 0;
			}

			// Only send type 2 if there are actually played ranges
			if ( ! ranges || ranges.length === 0 ) {
				return false;
			}

			window.analytics.track( 'video_heatmap', {
				type: 2,
				videoId: vid,
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
		// Skip automatic page_load if filter is set (e.g., in iframe contexts)
		if ( window.godamAnalyticsSkipAutoPageLoad ) {
			// Initialize video analytics without automatic page_load
			playerAnalytics();
			return;
		}

		const videos = document.querySelectorAll( '.easydam-player.video-js' );

		// Collect all video IDs
		const videoIds = Array.from( videos )
			.map( ( video ) => video.getAttribute( 'data-id' ) )
			.filter( ( id ) => id !== null && id !== '' && ! isNaN( id ) ) // Null and empty string check
			.map( ( id ) => parseInt( id, 10 ) ); // Convert to integer

		// Send a single page_load request with all video IDs
		if ( window.analytics && videoIds.length > 0 ) {
			window.analytics.track( 'page_load', {
				type: 1, // Enum: 1 = Page Load
				videoIds, // Array of all video IDs
			} );
		}

		// Initialize video analytics
		playerAnalytics();
	} );
}

function playerAnalytics() {
	const videos = document.querySelectorAll( '.easydam-player.video-js' );

	videos.forEach( ( video ) => {
		// read the data-setup attribute.
		const player = videojs.getPlayer( video ) || videojs( video ); // eslint-disable-line no-undef -- variable is defined globally

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
			if ( ! videoId || ranges.length === 0 ) {
				return; // Skip sending if no valid data
			}

			if ( window.analytics ) {
				window.analytics.track( 'video_heatmap', {
					type: 2, // Enum: 2 = Heatmap
					videoId: parseInt( videoId, 10 ),
					ranges,
					videoLength,
				} );
			}
		}
	} );
}
