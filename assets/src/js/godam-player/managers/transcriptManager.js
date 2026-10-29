/**
 * Transcript Manager
 * Handles loading transcription tracks for the player.
 *
 * Resolution order (see the matching comment in inc/templates/godam-player.php):
 * `data-transcript-deleted` means the user deleted it, so show nothing.
 * Otherwise a `data-transcript-url` with `data-transcript-source="upload"` (a
 * file the user uploaded in WordPress) is added first, then every ready
 * caption track from the public API endpoint, default first. The endpoint
 * supports ETag/Cache-Control:
 * GET /api/method/godam_core.api.process.get_public_transcription_path?job_name=<job_id>
 * If the endpoint fails or sends no caption tracks, the cached
 * `data-transcript-url` is used, else the endpoint's single legacy transcript.
 */

/**
 * Internal dependencies
 */
import { toWebVttTrackSrc } from '../utils/captionTrackSrc.js';

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
		// Transcript cached on the attachment and printed by the server.
		this.localTranscriptUrl = video.dataset.transcriptUrl || '';
		this.transcriptDeleted = video.dataset.transcriptDeleted === 'true';
		// `upload` when the transcript above was uploaded in WordPress rather
		// than cached from the SaaS.
		this.localTranscriptSource = video.dataset.transcriptSource || '';
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
	 *
	 * @return {string} The full API endpoint URL
	 */
	getTranscriptionEndpoint() {
		const apiBase = this.getApiBase();
		return `${ apiBase }/api/method/godam_core.api.process.get_public_transcription_path`;
	}

	/**
	 * Initialize transcript loading.
	 * Adds the WordPress-uploaded transcript and the SaaS caption tracks as
	 * text tracks, in the order described at the top of this file.
	 *
	 * @return {Promise<void>}
	 */
	async initialize() {
		if ( this.video.dataset.disableTranscript === 'true' ) {
			return;
		}

		// Check if captions/subtitles are enabled in the player configuration
		if ( ! this.isCaptionsEnabled() ) {
			return;
		}

		// Deleted in the editor — don't resurrect it from the SaaS.
		if ( this.transcriptDeleted ) {
			return;
		}

		// A file uploaded in WordPress never reaches the SaaS, so it goes first
		// and becomes the default subtitle.
		const hasLocalUpload = !! this.localTranscriptUrl && this.localTranscriptSource === 'upload';
		if ( hasLocalUpload ) {
			await this.addLocalTranscript();
		}

		let transcriptData = null;
		if ( this.jobId ) {
			try {
				transcriptData = await this.fetchTranscriptPath();
			} catch ( error ) {
				// Silently fall through to the cached transcript — captions are optional.
				// eslint-disable-next-line no-console
				console.debug( 'GoDAM: Could not load caption tracks:', error.message );
			}
		}

		// Every ready caption track (one per language), when the SaaS sends them.
		if ( Array.isArray( transcriptData?.caption_tracks ) ) {
			this.addCaptionTracks( transcriptData.caption_tracks );
			return;
		}

		if ( hasLocalUpload ) {
			return;
		}

		// SaaS unreachable or too old for caption tracks: use the cached copy of
		// its transcript, else the single transcript it reported.
		if ( this.localTranscriptUrl ) {
			await this.addLocalTranscript();
		} else if ( transcriptData?.exists && transcriptData?.url ) {
			this.transcriptUrl = transcriptData.url;
			this.addTextTrack( await toWebVttTrackSrc( transcriptData.url ) );
		}
	}

	/**
	 * Add the transcript stored on the attachment as a text track.
	 *
	 * @return {Promise<void>}
	 */
	async addLocalTranscript() {
		this.transcriptUrl = this.localTranscriptUrl;
		// An uploaded .srt is converted to WebVTT, the only format a track parses.
		this.addTextTrack( await toWebVttTrackSrc( this.localTranscriptUrl ) );
	}

	/**
	 * Add one subtitle/caption `<track>` per first-class caption track.
	 *
	 * Tracks still being generated (no `vtt_path` yet) are skipped. The default
	 * track is added first so the player's auto-enable (see
	 * `setupDefaultSubtitle` in videoPlayer.js) turns on the right language,
	 * unless a WordPress-uploaded transcript was already added ahead of it.
	 *
	 * @param {Array<Object>} captions Caption-track rows from the SaaS.
	 */
	addCaptionTracks( captions ) {
		const ready = captions.filter( ( caption ) => !! caption?.vtt_path );

		// Default track first, so it becomes the auto-enabled subtitle.
		ready.sort( ( a, b ) => ( b?.is_default ? 1 : 0 ) - ( a?.is_default ? 1 : 0 ) );

		ready.forEach( ( caption ) => {
			const srclang = caption.language || 'en';
			this.addTextTrack( caption.vtt_path, {
				kind: caption.kind === 'captions' ? 'captions' : 'subtitles',
				label: caption.label || srclang,
				srclang,
			} );
			// The first track added is the panel/reader transcript.
			if ( ! this.transcriptUrl ) {
				this.transcriptUrl = caption.vtt_path;
			}
		} );
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

		// Dedup by source URL, not by language: a video can carry several caption
		// tracks in the same language (e.g. two uploaded Spanish files), so only a
		// matching src means we already added this exact track (e.g. on refresh).
		const existingEls = this.player.remoteTextTrackEls?.();
		if ( existingEls ) {
			for ( let i = 0; i < existingEls.length; i++ ) {
				if ( existingEls[ i ]?.src === trackUrl ) {
					return; // This exact track is already present.
				}
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
