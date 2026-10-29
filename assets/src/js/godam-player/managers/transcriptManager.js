/**
 * Transcript Manager
 * Handles loading transcription tracks for the player.
 *
 * Resolution order (see the matching comment in inc/templates/godam-player.php):
 * `data-transcript-url` (the transcript stored on the attachment by the media
 * editor's Transcription tab, generated or user-uploaded) wins;
 * `data-transcript-deleted` means the user deleted it, so show nothing;
 * otherwise fall back to the public API endpoint, which supports
 * ETag/Cache-Control:
 * GET /api/method/godam_core.api.process.get_public_transcription_path?job_name=<job_id>
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
	 * Fetches transcript URL from API and adds it as a text track.
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

		// Prefer first-class caption tracks (multilingual subtitles + uploaded
		// captions) from the SaaS, which also include the generated transcript.
		// Falls back to the legacy single-transcript path for old SaaS responses
		// and for attachments with no job id (purely local media).
		if ( this.jobId && ! this.transcriptDeleted ) {
			try {
				const transcriptData = await this.fetchTranscriptPath();

				const captions = Array.isArray( transcriptData?.caption_tracks )
					? transcriptData.caption_tracks
					: [];

				if ( captions.length ) {
					this.addCaptionTracks( captions );
					return;
				}

				// No caption_tracks (old SaaS): fall back to the single transcript
				// from the same response — but a locally-stored transcript still
				// wins, so defer to it below when present.
				if ( ! this.localTranscriptUrl && transcriptData?.exists && transcriptData?.url ) {
					this.transcriptUrl = transcriptData.url;
					this.addTextTrack( await toWebVttTrackSrc( transcriptData.url ) );
					return;
				}
			} catch ( error ) {
				// Silently fall through to the local transcript — captions are optional.
				// eslint-disable-next-line no-console
				console.debug( 'GoDAM: Could not load caption tracks:', error.message );
			}
		}

		// The transcript stored on the attachment (editor-cached or hand-uploaded)
		// is the fallback when the SaaS has no caption tracks, when the media has
		// no job id, or when the fetch failed.
		if ( this.localTranscriptUrl ) {
			this.transcriptUrl = this.localTranscriptUrl;
			// An uploaded .srt is converted to WebVTT, the only format a track parses.
			this.addTextTrack( await toWebVttTrackSrc( this.localTranscriptUrl ) );
		}
	}

	/**
	 * Add one subtitle/caption `<track>` per first-class caption track.
	 *
	 * Tracks still being generated (no `vtt_path` yet) are skipped. The default
	 * track is added first so the player's auto-enable (see
	 * `setupDefaultSubtitle` in videoPlayer.js) turns on the right language.
	 *
	 * @param {Array<Object>} captions Caption-track rows from the SaaS.
	 */
	addCaptionTracks( captions ) {
		const ready = captions.filter( ( caption ) => !! caption?.vtt_path );
		if ( ! ready.length ) {
			return;
		}

		// Default track first, so it becomes the auto-enabled subtitle.
		ready.sort( ( a, b ) => ( b?.is_default ? 1 : 0 ) - ( a?.is_default ? 1 : 0 ) );

		ready.forEach( ( caption, index ) => {
			const srclang = caption.language || 'en';
			this.addTextTrack( caption.vtt_path, {
				kind: caption.kind === 'captions' ? 'captions' : 'subtitles',
				label: caption.label || srclang,
				srclang,
			} );
			// Remember the default (first) caption as the panel/reader transcript.
			if ( index === 0 ) {
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
