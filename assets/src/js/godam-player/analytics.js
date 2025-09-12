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

// Track which videos have been processed to avoid duplicates
const processedVideos = new Set();

// Track video states for proper heatmap handling
const videoState = new Map(); // videoId -> { hasPlayed: false, sent: false, ranges: [], duration: 0 }

// Function to send page_load for a single video
function sendPageLoadForVideo( videoId ) {
	if ( window.analytics && videoId ) {
		window.analytics.track( 'page_load', {
			type: 1, // Enum: 1 = Page Load
			videoIds: [ parseInt( videoId, 10 ) ],
		} );
	}
}

// Function to setup tracking for a video
function setupTracking( videoElement ) {
	const videoId = videoElement.getAttribute( 'data-id' );
	if ( ! videoId || videoState.has( videoId ) ) {
		return;
	}

	const player = videojs( videoElement );
	videoState.set( videoId, {
		hasPlayed: false,
		sent: false,
		playedObject: null, // Store the played object directly
		duration: 0,
	} );

	const updateCache = () => {
		const state = videoState.get( videoId );
		if ( ! state ) {
			return;
		}

		try {
			// Store the played object directly
			state.playedObject = player.played();
			state.duration = Number( player.duration() ) || 0;
		} catch ( error ) {
			// Player might be disposed
		}
	};

	// Track when video starts playing
	player.on( 'play', () => {
		const state = videoState.get( videoId );
		if ( state ) {
			state.hasPlayed = true;
		}
	} );

	// Track time updates and cache ranges
	player.on( 'timeupdate', () => {
		const state = videoState.get( videoId );
		if ( ! state ) {
			return;
		}
		if ( player.currentTime() > 0.01 && ! state.hasPlayed ) {
			state.hasPlayed = true;
		}
		updateCache();
	} );

	player.on( 'pause', updateCache );
	player.on( 'ended', () => {
		const state = videoState.get( videoId );
		if ( state ) {
			state.hasPlayed = true;
		}
		updateCache();
	} );

	// Send heatmap data when player is disposed
	player.on( 'dispose', () => {
		flushHeatmap( videoId );
	} );
}

// Function to flush heatmap data for a video
function flushHeatmap( videoId ) {
	const state = videoState.get( videoId );
	if ( ! state || state.sent ) {
		return;
	}

	// Only send if video was actually played and has meaningful data
	if ( ! state.hasPlayed || ! state.playedObject || ! state.duration ) {
		return;
	}

	// Do the processing of the played object
	const ranges = [];
	for ( let i = 0; i < state.playedObject.length; i++ ) {
		ranges.push( [ state.playedObject.start( i ), state.playedObject.end( i ) ] );
	}

	if ( ranges.length === 0 ) {
		return;
	}

	if ( window.analytics ) {
		window.analytics.track( 'video_heatmap', {
			type: 2, // Enum: 2 = Heatmap
			videoId: parseInt( videoId, 10 ),
			ranges,
			videoLength: state.duration,
		} );
	}
	state.sent = true;
}

// MutationObserver to detect new videos (only after initial page load)
let observerStarted = false;

const observer = new MutationObserver( ( mutations ) => {
	// Only process if observer has been started (after initial page load)
	if ( ! observerStarted ) {
		return;
	}

	for ( const mutation of mutations ) {
		mutation.addedNodes.forEach( ( node ) => {
			if ( ! ( node instanceof Element ) ) {
				return;
			}

			// If the node itself is a player
			if ( node.matches && node.matches( '.easydam-player.video-js' ) ) {
				const videoId = node.getAttribute( 'data-id' );
				if ( videoId && ! processedVideos.has( videoId ) ) {
					processedVideos.add( videoId );
					sendPageLoadForVideo( videoId );
					setupTracking( node );
				}
			}

			// Or contains players inside it
			const nested = node.querySelectorAll ? node.querySelectorAll( '.easydam-player.video-js' ) : [];
			nested.forEach( ( video ) => {
				const videoId = video.getAttribute( 'data-id' );
				if ( videoId && ! processedVideos.has( videoId ) ) {
					processedVideos.add( videoId );
					sendPageLoadForVideo( videoId );
					setupTracking( video );
				}
			} );
		} );

		// Handle removals
		mutation.removedNodes.forEach( ( node ) => {
			if ( ! ( node instanceof Element ) ) {
				return;
			}
			// Check if removed node is a video
			if ( node.matches && node.matches( '.easydam-player.video-js' ) ) {
				const videoId = node.getAttribute( 'data-id' );
				if ( videoId ) {
					flushHeatmap( videoId );
				}
			}

			// Check if removed node contains videos
			const nestedVideos = node.querySelectorAll ? node.querySelectorAll( '.easydam-player.video-js' ) : [];
			if ( nestedVideos.length > 0 ) {
				nestedVideos.forEach( ( video ) => {
					const videoId = video.getAttribute( 'data-id' );
					if ( videoId ) {
						flushHeatmap( videoId );
					}
				} );
			}
		} );
	}
} );

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

		// Mark initial videos as processed and setup tracking
		videos.forEach( ( videoElement ) => {
			const idAttr = videoElement.getAttribute( 'data-id' );
			if ( ! idAttr ) {
				return;
			}
			processedVideos.add( idAttr );
			setupTracking( videoElement );
		} );

		// Initialize video analytics
		playerAnalytics();

		// NOW start the observer for new videos
		observerStarted = true;
		observer.observe( document.documentElement, { childList: true, subtree: true } );
	} );
}

function playerAnalytics() {
	const videos = document.querySelectorAll( '.easydam-player.video-js' );

	window.addEventListener( 'beforeunload', () => {
		// Flush all unsent heatmap data on page exit
		videoState.forEach( ( state, videoId ) => {
			flushHeatmap( videoId );
		} );
	} );

	// Per-video initialization (no global listeners here)
	videos.forEach( ( video ) => {
		videojs( video );
	} );
}
