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
		const player = videojs( video );

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
