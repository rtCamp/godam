/**
 * Internal dependencies
 */
import { parseDataAttribute } from '../utils/dataHelpers.js';

/**
 * Video.js renders its skip buttons only for these durations (see the
 * SkipForward / SkipBackward components) and hides them for anything else —
 * a missing value or a numeric string included.
 */
const VALID_SKIP_DURATIONS = [ 5, 10, 30 ];
const DEFAULT_SKIP_DURATION = 10;

/**
 * Coerce a skip-buttons config into a value Video.js will actually render.
 *
 * @param {Object|boolean|undefined} skipButtons - Raw skipButtons config.
 * @return {Object} Normalized `{ forward, backward }` config.
 */
function normalizeSkipButtons( skipButtons ) {
	const raw = ( skipButtons && typeof skipButtons === 'object' ) ? skipButtons : {};
	const candidates = [ raw.forward, raw.backward ].map( ( value ) => parseInt( value, 10 ) );
	const duration = candidates.find( ( value ) => VALID_SKIP_DURATIONS.includes( value ) ) ?? DEFAULT_SKIP_DURATION;

	return { forward: duration, backward: duration };
}

/**
 * Configuration Manager
 * Handles video configuration setup and data parsing
 */
export default class ConfigurationManager {
	constructor( video ) {
		this.video = video;
		this.globalAdsSettings = {};
		this.adTagUrl = null;
		this.videoSetupOptions = {};
		this.videoSetupControls = {};
		this.isPreviewEnabled = false;

		this.initialize();
	}

	rearrangeVideoSources( sources ) {
		// Check if safari browser or iOS device
		const isIOS = /iPad|iPhone|iPod/.test( navigator.userAgent ) && ! window.MSStream;
		const isSafari = /^((?!chrome|android).)*safari/i.test( navigator.userAgent );

		// Check if .mpd source exists
		const mpdUrl = sources.find( ( source ) => source.type === 'application/dash+xml' );
		const m3u8Url = sources.find( ( source ) => source.type === 'application/x-mpegURL' );
		const normalUrl = sources.find( ( source ) => source.type !== 'application/x-mpegURL' && source.type !== 'application/dash+xml' );

		const newSources = [];

		if ( isIOS || isSafari ) {
			if ( m3u8Url ) {
				newSources.push( m3u8Url );
			}
			if ( mpdUrl ) {
				newSources.push( mpdUrl );
			}
			if ( normalUrl ) {
				newSources.push( normalUrl );
			}
		} else {
			if ( mpdUrl ) {
				newSources.push( mpdUrl );
			}
			if ( m3u8Url ) {
				newSources.push( m3u8Url );
			}
			if ( normalUrl ) {
				newSources.push( normalUrl );
			}
		}

		return newSources;
	}

	/**
	 * Initialize configuration
	 */
	initialize() {
		this.globalAdsSettings = parseDataAttribute( this.video, 'global_ads_settings', {} );
		this.adTagUrl = this.video.dataset.ad_tag_url;
		this.videoSetupOptions = parseDataAttribute( this.video, 'options', {} );
		const videoSetupControls = parseDataAttribute( this.video, 'controls', this.getDefaultControls() );

		// Disable default autoplay if autoplay-on-view is enabled
		// This allows intersection observer to handle autoplay when video enters viewport
		if ( this.video.dataset.autoplayOnView === 'true' ) {
			videoSetupControls.autoplay = false;
		}

		// Get mpd, m3
		const sources = this.rearrangeVideoSources( videoSetupControls.sources || [] );

		this.videoSetupControls = {
			...videoSetupControls,
			sources,
			// Disable native text tracks to use Video.js custom UI (crucial for Safari/iOS hover menus)
			nativeTextTracks: false,
			// Ensure video plays inline on mobile devices instead of forcing native fullscreen
			playsinline: true,
			html5: {
				// Redundant but safe: ensure HTML5 tech also respects custom text tracks
				nativeTextTracks: false,
				vhs: {
					bandwidth: 14_000_000, // Pretend network can do ~14 Mbps at startup
					bandwidthVariance: 1.0, // allow renditions close to estimate
					limitRenditionByPlayerDimensions: false, // don't cap by video element size
				},
			},
		};

		const isIOS = /iPad|iPhone|iPod/.test( navigator.userAgent ) && ! window.MSStream;
		const isSafari = /^((?!chrome|android).)*safari/i.test( navigator.userAgent );

		if ( isIOS || isSafari ) {
			// forces VHS even on Safari and iOS devices
			// This will override native HLS playback with VHS to support features like quality selection.
			this.videoSetupControls.html5.vhs.overrideNative = true;
			this.videoSetupControls.html5.nativeAudioTracks = false;
			this.videoSetupControls.html5.nativeVideoTracks = false;
			this.videoSetupControls.html5.nativeTextTracks = false;
		}

		this.isPreviewEnabled = this.videoSetupOptions?.preview;

		this.ensureControlBarDefaults();
	}

	/**
	 * Get default control configuration
	 *
	 * @return {Object} Default controls configuration
	 */
	getDefaultControls() {
		return {
			controls: true,
			autoplay: false,
			preload: 'auto',
			fluid: true,
			preview: false,
		};
	}

	/**
	 * Ensure the control bar has default settings.
	 *
	 * Fills in defaults per key rather than all-or-nothing: a `controlBar` that
	 * exists but is missing individual keys (an attachment config saved before
	 * a control existed, a shortcode/page-builder/add-on passing its own
	 * `data-controls`, or already-cached page HTML) must still get the default
	 * for what it doesn't carry.
	 */
	ensureControlBarDefaults() {
		const defaults = {
			playToggle: true,
			volumePanel: true,
			currentTimeDisplay: true,
			timeDivider: true,
			durationDisplay: true,
			fullscreenToggle: true,
			subsCapsButton: true,
			skipButtons: {
				forward: DEFAULT_SKIP_DURATION,
				backward: DEFAULT_SKIP_DURATION,
			},
		};

		const controlBar = ( 'controlBar' in this.videoSetupControls ) && this.videoSetupControls.controlBar !== null && typeof this.videoSetupControls.controlBar === 'object'
			? this.videoSetupControls.controlBar
			: {};

		Object.keys( defaults ).forEach( ( key ) => {
			if ( ! ( key in controlBar ) ) {
				controlBar[ key ] = defaults[ key ];
			}
		} );

		controlBar.skipButtons = normalizeSkipButtons( controlBar.skipButtons );

		this.videoSetupControls.controlBar = controlBar;
	}
}
