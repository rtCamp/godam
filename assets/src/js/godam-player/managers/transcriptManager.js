/**
 * Transcript Manager
 * Handles fetching and loading AI-generated transcription tracks from the GoDAM API.
 *
 * Uses the public API endpoint with ETag/Cache-Control support:
 * GET /api/method/godam_core.api.process.get_public_transcription_path?job_name=<job_id>
 */
export default class TranscriptManager {
	/**
	 * Create a TranscriptManager instance.
	 *
	 * @param {Object}      player        - Video.js player instance
	 * @param {HTMLElement} video         - Video DOM element
	 * @param {Object}      configManager - Configuration manager instance
	 */
	constructor( player, video, configManager ) {
		this.player = player;
		this.video = video;
		this.configManager = configManager;
		this.jobId = video.dataset.job_id || '';
		this.etag = null;
		this.transcriptUrl = null;
	}

	/**
	 * Get the API base URL from global settings.
	 *
	 * @return {string} The API base URL
	 */
	getApiBase() {
		return window?.godamSettings?.apiBase || 'https://app.godam.io';
	}

	/**
	 * Build the transcription API endpoint URL.
	 * Uses the WordPress REST proxy to avoid CORS issues when fetching
	 * from app.godam.io directly via browser JS.
	 *
	 * @return {string} The full proxy endpoint URL
	 */
	getTranscriptionEndpoint() {
		// Use the WP REST proxy URL (server-side, no CORS).
		return `${ window?.godamRestRoute?.url || '/wp-json/' }godam/v1/transcoding/transcript-path/`;
	}

	/**
	 * Initialize transcript loading.
	 * Fetches transcript URL from API and adds it as a text track.
	 *
	 * @return {Promise<void>}
	 */
	async initialize() {
		if ( ! this.jobId ) {
			return;
		}

		// Check if captions/subtitles are enabled in the player configuration
		if ( ! this.isCaptionsEnabled() ) {
			return;
		}

		try {
			const transcriptData = await this.fetchTranscriptPath();

			if ( transcriptData?.exists && transcriptData?.url ) {
				this.transcriptUrl = transcriptData.url;
				this.addTextTrack( transcriptData.url );
			}
		} catch ( error ) {
			// Silently fail - transcript is optional
			// eslint-disable-next-line no-console
			console.debug( 'GoDAM: Could not load transcript:', error.message );
		}
	}

	/**
	 * Check if captions/subtitles display is enabled in player configuration.
	 *
	 * @return {boolean} True if captions should be displayed
	 */
	isCaptionsEnabled() {
		const controlBar = this.configManager?.videoSetupControls?.controlBar;

		// If subsCapsButton is explicitly set to false, captions are disabled
		if ( controlBar && controlBar.subsCapsButton === false ) {
			return false;
		}

		return true;
	}

	/**
	 * Fetch the transcript path from the GoDAM API.
	 * Supports ETag-based conditional requests for efficient caching.
	 *
	 * @return {Promise<Object>} Response data with exists and url properties
	 */
	async fetchTranscriptPath() {
		const endpoint = this.getTranscriptionEndpoint();
		const url = `${ endpoint }?job_name=${ encodeURIComponent( this.jobId ) }`;

		const headers = {
			Accept: 'application/json',
		};

		// Add If-None-Match header for conditional request if we have a cached ETag
		if ( this.etag ) {
			headers[ 'If-None-Match' ] = this.etag;
		}

		const response = await fetch( url, {
			method: 'GET',
			headers,
		} );

		// Handle 304 Not Modified - use cached data
		if ( response.status === 304 ) {
			return {
				exists: !! this.transcriptUrl,
				url: this.transcriptUrl,
			};
		}

		if ( ! response.ok ) {
			throw new Error( `HTTP ${ response.status }` );
		}

		// Store ETag for future conditional requests
		const newEtag = response.headers.get( 'ETag' );
		if ( newEtag ) {
			this.etag = newEtag;
		}

		const data = await response.json();

		// Handle Frappe-style response wrapper
		if ( data?.message !== undefined ) {
			return data.message;
		}

		return data;
	}

	/**
	 * Add a text track to the video player.
	 *
	 * @param {string} trackUrl        - URL of the VTT transcript file
	 * @param {Object} options         - Track options
	 * @param {string} options.kind    - Track kind (default: 'subtitles')
	 * @param {string} options.label   - Track label (default: 'English')
	 * @param {string} options.srclang - Track language (default: 'en')
	 */
	addTextTrack( trackUrl, options = {} ) {
		const {
			kind = 'subtitles',
			label = 'English',
			srclang = 'en',
		} = options;

		// Check if track with same src already exists
		const existingTracks = this.player.textTracks();
		for ( let i = 0; i < existingTracks.length; i++ ) {
			const track = existingTracks[ i ];
			// Check if this is the same track by comparing language and kind
			if ( track.language === srclang && track.kind === kind ) {
				return; // Track already exists
			}
		}

		// Add the remote text track
		this.player.addRemoteTextTrack(
			{
				kind,
				label,
				srclang,
				src: trackUrl,
			},
			false, // Don't remove on source change
		);
	}

	/**
	 * Refresh the transcript by re-fetching from the API.
	 * Useful when transcription has been updated.
	 *
	 * @return {Promise<void>}
	 */
	async refresh() {
		// Clear cached ETag to force a fresh fetch
		this.etag = null;
		await this.initialize();
	}

	/**
	 * Get the current transcript URL.
	 *
	 * @return {string|null} The transcript URL or null if not loaded
	 */
	getTranscriptUrl() {
		return this.transcriptUrl;
	}

	/**
	 * Check if transcript is loaded.
	 *
	 * @return {boolean} True if transcript is loaded
	 */
	hasTranscript() {
		return !! this.transcriptUrl;
	}
}
