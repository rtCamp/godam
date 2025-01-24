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
		videoAnalyticsPlugin( {
			token: 'example_token',
			endpoint: '/example-endpoint/',
		} ),
	],
} );
window.analytics = analytics;

if ( ! window.pageLoadEventTracked ) {
	window.pageLoadEventTracked = true; // Mark as tracked to avoid duplicate execution

	document.addEventListener( 'DOMContentLoaded', () => {
		// Track a "page_load" event when the page loads
		if ( window.analytics ) {
			window.analytics.track( 'page_load', {
				type: 1, // Enum: 1 = Page Load
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

		const videoSetupOptions = video.dataset.setup
			? JSON.parse( video.dataset.setup )
			: {
				controls: true,
				autoplay: false,
				preload: 'auto',
				fluid: true,
			};

		const player = videojs( video, videoSetupOptions );

		window.addEventListener( 'beforeunload', ( e ) => {
			const played = player.played();
			const ranges = [];

			e.preventDefault();

			// Extract time ranges from the player.played() object
			for ( let i = 0; i < played.length; i++ ) {
				ranges.push( [ played.start( i ), played.end( i ) ] );
			}

			// Send the ranges using updateHeatmap
			updateHeatmap( ranges );
		} );

		async function updateHeatmap( ranges ) {
			const videoId = video.getAttribute( 'data-id' );

			if ( window.analytics ) {
				window.analytics.track( 'video_heatmap', {
					type: 2, // Enum: 2 = Heatmap
					videoId: parseInt( videoId, 10 ),
					ranges,
				} );
			}
		}
	} );
}
