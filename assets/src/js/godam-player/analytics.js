/**
 * External dependencies
 */
import videojs from 'video.js';
import { Analytics } from 'analytics';
/**
 * Internal dependencies
 */
import videoAnalyticsPlugin from './video-analytics-plugin';
import { getLayerInteractions } from './utils/storage';

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
			return videojs.getPlayer( el );
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

			const ranges = collectPlayedRanges( player );
			if ( ranges.length === 0 ) {
				return false;
			}

			const videoLength = Number( player.duration && player.duration() ) || 0;

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
		const videos = document.querySelectorAll( '.easydam-player.video-js' );

		// Collect all video IDs
		const videoIds = Array.from( videos )
			.map( ( video ) => video.getAttribute( 'data-id' ) )
			.filter( ( id ) => id !== null && id !== '' ) // Null and empty string check
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
	const processedVideos = new Set();

	videos.forEach( ( video ) => {
		// read the data-setup attribute.
		const player = videojs.getPlayer( video ) || videojs( video );

		window.addEventListener( 'beforeunload', () => {
			const played = player.played();
			const ranges = [];
			const videoLength = player.duration();
			const videoId = video.getAttribute( 'data-id' );
			const jobId = video.getAttribute( 'data-job_id' );

			// Extract time ranges from the player.played() object
			for ( let i = 0; i < played.length; i++ ) {
				ranges.push( [ played.start( i ), played.end( i ) ] );
			}

			// Send the ranges using updateHeatmap
			updateHeatmap( ranges, videoLength, videoId, jobId );

			const uniqueKey = videoId || jobId; // pick whichever uniquely identifies

			if ( processedVideos.has( uniqueKey ) ) {
				return; // already attached for this video
			}

			processedVideos.add( uniqueKey );

			const layerInteractions = getLayerInteractions() || '{}';

			trackLayerInteraction( videoId, layerInteractions[ uniqueKey ], jobId, videoLength );
		} );

		/**
		 * Updates the video heatmap by sending watched ranges to the analytics system.
		 *
		 * @async
		 * @function updateHeatmap
		 * @param {Array<{ start: number, end: number }>} ranges       - Array of time ranges (in seconds) that have been watched.
		 * @param {number}                                videoLength  - The total length of the video in seconds.
		 * @param {number|string}                         videoId      - The ID of the video being tracked.
		 * @param {?number|string}                        [jobId=null] - Optional job ID associated with the video.
		 * @return {void} - Does not return a value. Exits early if required params are missing.
		 */
		async function updateHeatmap( ranges, videoLength, videoId, jobId = null ) {
			if ( ! videoId || ranges.length === 0 ) {
				return; // Skip sending if no valid data
			}

			if ( window.analytics ) {
				window.analytics.track( 'video_heatmap', {
					type: 2, // Enum: 2 = Heatmap
					videoId: videoId ? parseInt( videoId, 10 ) : 0,
					ranges,
					videoLength,
					jobId,
				} );
			}
		}

		/**
		 * Tracks user interactions with interactive video layers and sends the data
		 * to the analytics system if available.
		 *
		 * @async
		 * @function trackLayerInteraction
		 * @param {number|string}  videoId           - The ID of the video being tracked.
		 * @param {Object}         layerInteractions - An object containing interaction data for layers,
		 * @param {?number|string} [jobId=null]      - Optional job ID associated with the video.
		 * @param {number}         videoLength       - The total length of the video in seconds.
		 * @return {void} - Does not return a value. Exits early if required params are missing.
		 *
		 */
		async function trackLayerInteraction(
			videoId,
			layerInteractions,
			jobId = null,
			videoLength,
		) {
			if ( ( ! videoId && ! jobId ) || ! layerInteractions || Object.keys( layerInteractions ).length === 0 ) {
				return; // Must have at least a videoId and layerType
			}

			if ( window.analytics ) {
				window.analytics.track( 'layer_interaction', {
					type: 3, // Enum: 3 = Layer Interaction
					videoId: videoId ? parseInt( videoId, 10 ) : 0,
					jobId, // optional
					layers: layerInteractions,
					videoLength,
					ranges: [],
				} );
			}
		}
	} );

	localStorage.removeItem( 'layerInteractions' );
}
