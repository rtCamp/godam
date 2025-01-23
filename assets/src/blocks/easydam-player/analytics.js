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
	console.log( 'DOM LOADED!!!' );
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

		const existingRanges = [];
		let lastTime = 0;

		let rangeStart = 0; // To track the start of the current range
		let debounceTimer = null; // Timer for debouncing
		let seeking = false;
		const debounceDelay = 1000;

		let backupLastTime = 0;

		player.on( 'seeked', function() {
			const currentTime = player.currentTime();

			console.log( 'Seeked to: ', currentTime );

			// Clear the debounce timer (if any)
			clearTimeout( debounceTimer );

			// If this is the start of seeking, send the previous range.
			if ( ! seeking ) {
				console.log( 'Sending Range: ', rangeStart, lastTime );
				console.log("Using backup, sending range: ", rangeStart, backupLastTime);
			}
			seeking = true;

			// Debounce updating the rangeStart
			debounceTimer = setTimeout( () => {
				rangeStart = currentTime; // Update range start
				seeking = false;
				console.log( 'New range start after seeked: ', rangeStart );
			}, debounceDelay );
		} );

		let wasPaused = false;

		player.on( 'timeupdate', function() {
			const currentTime = player.currentTime();
			const played = player.played();

			console.log( currentTime, played, player.seeking(), player.paused(), wasPaused, lastTime, backupLastTime );

			if ( ! seeking ) {
				if ( currentTime !== lastTime && ! player.paused() ) {
					backupLastTime = lastTime;
				}
				lastTime = currentTime;
			}
			else if(player.paused()) {
				clearTimeout( debounceTimer );
				debounceTimer = setTimeout( () => {
					rangeStart = currentTime; // Update range start
					seeking = false;
					console.log( 'New range start after seeked: ', rangeStart );
				}, debounceDelay );
			}
			wasPaused = player.paused();
		} );

		async function updateHeatmap( ranges ) {
			const videoId = video.getAttribute( 'data-id' );

			if ( window.analytics ) {
				window.analytics.track( 'video_heatmap', {
					type: 'Heatmap', // Could be anything like "Heatmap"
					video_id: parseInt( videoId, 10 ),
					ranges,
					license: licenseKey,
				} );
			}
		}
	} );
}
