/**
 * GTM Video Analytics Tracker
 * Tracks video progress and sends dataLayer events for GTM
 *
 * @package
 * @since 1.0.0
 */

/**
 * GTM Video Tracker Class
 * Handles video progress tracking and GTM dataLayer events
 */
class GTMVideoTracker {
	constructor( player, videoElement ) {
		this.player = player;
		this.videoElement = videoElement;
		this.videoId = videoElement.getAttribute( 'data-id' );
		this.trackingInterval = null;
		this.trackedProgress = new Set(); // Track which progress milestones have been sent
		this.isTracking = false;
		this.lastPlayedDuration = 0;

		// Initialize tracking
		this.init();
	}

	/**
	 * Initialize the tracker
	 */
	init() {
		// Wait for player to be ready
		this.player.ready( () => {
			this.setupEventListeners();
		} );
	}

	/**
	 * Setup VideoJS event listeners
	 */
	setupEventListeners() {
		// Start tracking when video starts playing
		this.player.on( 'play', () => {
			if ( ! this.trackedProgress.has( 0 ) ) {
				this.sendGTMEvent( 'video_start', 0 );
				this.trackedProgress.add( 0 );
			}
			this.startTracking();
		} );

		// Stop tracking when video pauses
		this.player.on( 'pause', () => {
			this.stopTracking();
		} );

		// Stop tracking when video ends
		this.player.on( 'ended', () => {
			const progressPercentage = this.calculatePlayedPercentage();
			if ( progressPercentage >= 99 && ! this.trackedProgress.has( 100 ) ) {
				this.sendGTMEvent( 'video_complete', 100 );
				this.trackedProgress.add( 100 );
			}
			this.stopTracking();
		} );

		// Stop tracking when video is seeking
		this.player.on( 'seeking', () => {
			this.stopTracking();
		} );

		// Resume tracking after seeking
		this.player.on( 'seeked', () => {
			if ( ! this.player.paused() ) {
				this.startTracking();
			}
		} );

		// Clean up on disposal
		this.player.on( 'dispose', () => {
			this.stopTracking();
		} );
	}

	/**
	 * Start progress tracking
	 */
	startTracking() {
		if ( this.isTracking ) {
			return;
		}

		this.isTracking = true;

		// Check progress every 2.5 seconds
		this.trackingInterval = setInterval( () => {
			this.checkProgress();
		}, 2500 );
	}

	/**
	 * Stop progress tracking
	 */
	stopTracking() {
		if ( this.trackingInterval ) {
			clearInterval( this.trackingInterval );
			this.trackingInterval = null;
		}
		this.isTracking = false;
	}

	/**
	 * Check video progress and send milestone events
	 */
	checkProgress() {
		const progressPercentage = this.calculatePlayedPercentage();

		// Check for progress milestones
		if ( progressPercentage >= 25 && ! this.trackedProgress.has( 25 ) ) {
			this.trackedProgress.add( 25 );
			this.sendGTMEvent( 'video_progress', 25 );
		}

		if ( progressPercentage >= 50 && ! this.trackedProgress.has( 50 ) ) {
			this.trackedProgress.add( 50 );
			this.sendGTMEvent( 'video_progress', 50 );
		}

		if ( progressPercentage >= 75 && ! this.trackedProgress.has( 75 ) ) {
			this.trackedProgress.add( 75 );
			this.sendGTMEvent( 'video_progress', 75 );
		}

		if ( progressPercentage >= 99 && ! this.trackedProgress.has( 100 ) ) {
			this.trackedProgress.add( 100 );
			this.sendGTMEvent( 'video_complete', 100 );
		}
	}

	/**
	 * Calculate the percentage of video that has been played
	 * Uses player.played() ranges to get accurate played duration
	 *
	 * @return {number} Percentage of video played (0-100)
	 */
	calculatePlayedPercentage() {
		try {
			const played = this.player.played();
			const totalDuration = this.player.duration();

			if ( ! played || ! totalDuration || totalDuration === 0 ) {
				return 0;
			}

			let totalPlayedDuration = 0;

			// Sum up all played ranges
			for ( let i = 0; i < played.length; i++ ) {
				const startTime = played.start( i );
				const endTime = played.end( i );
				totalPlayedDuration += ( endTime - startTime );
			}

			// Calculate percentage
			const percentage = ( totalPlayedDuration / totalDuration ) * 100;
			return Math.min( Math.round( percentage ), 100 ); // Cap at 100%
		} catch ( error ) {
			return 0;
		}
	}

	/**
	 * Send GTM dataLayer event
	 *
	 * @param {string} eventName          - Name of the event
	 * @param {number} progressPercentage - Progress percentage
	 */
	sendGTMEvent( eventName, progressPercentage ) {
		try {
			// Ensure dataLayer exists
			if ( typeof window.dataLayer === 'undefined' ) {
				window.dataLayer = [];
			}

			const eventData = {
				event: eventName,
				video_id: this.videoId ? parseInt( this.videoId, 10 ) : null,
				video_url: this.player.currentSrc() || '',
				video_title: this.videoElement.getAttribute( 'data-video-title' ) || '',
				video_duration: this.player.duration() || 0,
				video_progress_percentage: progressPercentage,
				video_current_time: this.player.currentTime() || 0,
				page_url: window.location.href,
				page_title: document.title,
				timestamp: new Date().toISOString(),
			};

			// Push to dataLayer
			window.dataLayer.push( eventData );
		} catch {
			// Error is silently ignored, not console logged.
		}
	}

	/**
	 * Reset tracking state (useful for video restarts)
	 */
	reset() {
		this.trackedProgress.clear();
		this.lastPlayedDuration = 0;
		this.stopTracking();
	}

	/**
	 * Get current tracking status
	 *
	 * @return {boolean} Whether tracking is currently active
	 */
	isCurrentlyTracking() {
		return this.isTracking;
	}

	/**
	 * Get tracked progress milestones
	 *
	 * @return {Set} Set of tracked progress percentages
	 */
	getTrackedProgress() {
		return new Set( this.trackedProgress );
	}
}

// Export for use in other modules
export default GTMVideoTracker;

// Also make available globally for backward compatibility
if ( typeof window !== 'undefined' ) {
	window.GTMVideoTracker = GTMVideoTracker;
}
