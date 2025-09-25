/**
 * External dependencies
 */
import videojs from 'video.js';
import { Analytics } from 'analytics';
/**
 * Internal dependencies
 */
import videoAnalyticsPlugin from './video-analytics-plugin';

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

	videos.forEach( ( video ) => {
		// read the data-setup attribute.
		const player = videojs( video );

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
