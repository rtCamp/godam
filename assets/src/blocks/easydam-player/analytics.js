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

document.addEventListener( 'DOMContentLoaded', () => {
	analytics.page( {
		meta: { ts: Date.now() }, // Timestamp
		properties: {
			url: window.location.href,
			title: document.title,
			referrer: document.referrer || '', // Include referrer
			width: window.innerWidth, // Screen width
			height: window.innerHeight, // Screen height
			campaign_data: window.campaign_data || {}, // Include campaign data if available
		},
	} );

	// Initialize video analytics
	playerAnalytics();
} );

document.addEventListener( 'DOMContentLoaded', () => playerAnalytics() );

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
					type: 1, // Enum: 1 = Heatmap
					video_id: parseInt( videoId, 10 ),
					ranges,
				} );
			}
		}
	} );
}
