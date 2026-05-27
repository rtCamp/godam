/**
 * Shared helpers for video analytics.
 *
 * Both the analytics plugin (async path) and the keepalive path
 * (sendPlayerHeatmap) must send identical request bodies.  This module
 * is the single source of truth for the request schema.
 */

/**
 * External dependencies
 */
import { v4 as uuidv4 } from 'uuid';

// Module-scope cache. Generated once on first event, reused for the rest of
// the page load. Every type=1/2/3/4 event from the same page load shares this
// UUID so the microservice can dedup with uniqExact(page_load_session_id).
let _pageLoadSessionId = null;

/**
 * Return a stable UUID v4 for this page load.
 *
 * @return {string} UUID v4 (36 chars).
 */
export function getPageLoadSessionId() {
	if ( ! _pageLoadSessionId ) {
		_pageLoadSessionId = uuidv4();
	}
	return _pageLoadSessionId;
}

/**
 * Normalized browser name (e.g. "Google Chrome", "Apple Safari").
 *
 * Wraps getUserAgent so callers outside this module can produce the same
 * config_browser_name string buildAnalyticsRequestBody emits — guarantees
 * type=1/2/3 and reel-pop type=4 device buckets line up.
 *
 * @return {string} Browser name.
 */
export function getBrowserName() {
	return getUserAgent( window.navigator.userAgent ).name;
}

/**
 * Normalized OS / platform name (e.g. "Macintosh", "Windows", "Linux").
 *
 * @return {string} OS / platform name.
 */
export function getOSName() {
	return getUserAgent( window.navigator.userAgent ).platform;
}

/**
 * Check if we should skip analytics tracking.
 *
 * @return {boolean} True if analytics should be skipped, false otherwise.
 */
export function shouldSkipAnalytics() {
	const { isAdminPage } = window.videoAnalyticsParams || {};

	if ( isAdminPage ) {
		return true;
	}

	const urlParams = new URLSearchParams( window.location.search );
	if ( urlParams.get( 'godam_page' ) === 'video-preview' ) {
		return true;
	}

	return false;
}

/**
 * Parse the browser's user-agent string into structured data.
 *
 * @param {string} userAgent - Raw navigator.userAgent string.
 * @return {Object} Parsed data with userAgent, name, version, and platform.
 */
export function getUserAgent( userAgent ) {
	const uAgent = userAgent;
	let bname = 'Unknown';
	let platform = 'Unknown';
	let version = '';
	let ub = '';

	if ( /(linux)/i.test( uAgent ) ) {
		platform = 'Linux';
	} else if ( /(macintosh|mac os x)/i.test( uAgent ) ) {
		platform = 'Macintosh';
	} else if ( /(windows|win32)/i.test( uAgent ) ) {
		platform = 'Windows';
	}

	if ( /(MSIE)/i.test( uAgent ) && ! /(Opera)/i.test( uAgent ) ) {
		bname = 'Internet Explorer';
		ub = 'MSIE';
	} else if ( /(Firefox)/i.test( uAgent ) ) {
		bname = 'Mozilla Firefox';
		ub = 'Firefox';
	} else if ( /(Chrome)/i.test( uAgent ) ) {
		bname = 'Google Chrome';
		ub = 'Chrome';
	} else if ( /(Safari)/i.test( uAgent ) ) {
		bname = 'Apple Safari';
		ub = 'Safari';
	} else if ( /(Opera)/i.test( uAgent ) ) {
		bname = 'Opera';
		ub = 'Opera';
	} else if ( /(Netscape)/i.test( uAgent ) ) {
		bname = 'Netscape';
		ub = 'Netscape';
	}

	const known = [ 'Version', ub, 'other' ];
	const pattern = new RegExp( '(?<browser>' + known.join( '|' ) + ')[/ ]+(?<version>[0-9.|a-zA-Z.]*)', 'g' );
	const matches = uAgent.matchAll( pattern );
	const matchArray = Array.from( matches );
	const i = matchArray.length;

	if ( i !== 1 ) {
		if ( uAgent.lastIndexOf( 'Version' ) < uAgent.lastIndexOf( ub ) ) {
			version = matchArray[ 0 ].groups.version;
		} else {
			version = matchArray[ 1 ].groups.version;
		}
	} else {
		version = matchArray[ 0 ].groups.version;
	}

	if ( version === null || version === '' ) {
		version = '?';
	}

	return {
		userAgent: uAgent,
		name: bname,
		version,
		platform,
		pattern,
	};
}

/**
 * Build the canonical request body for the analytics endpoint.
 *
 * Every field that the microservice accepts is included so that both
 * the async plugin path and the keepalive path produce identical payloads.
 *
 * @param {Object} opts
 * @param {number} opts.type               Event type (1 = page load, 2 = heatmap, 3 = layer interaction).
 * @param {string} opts.userToken          Anonymous visitor ID (from analytics library).
 * @param {number} [opts.visitorTimestamp] Epoch-ms timestamp; defaults to Date.now().
 * @param {number} [opts.videoId]          Single video ID (type 2/3).
 * @param {string} [opts.jobId]            Transcoding job ID.
 * @param {Array}  [opts.videoIds]         Array of [videoId, jobId] pairs (type 1).
 * @param {Array}  [opts.ranges]           Played time-range pairs (type 2).
 * @param {number} [opts.videoLength]      Duration in seconds (type 2).
 * @param {Array}  [opts.layers]           Array of layer interaction event objects (type 3). Each entry must include layer_id, layer_type, action_type, layer_timestamp. Optional: layer_name, page_url, layer_metadata.
 * @param {number} [opts.reelPopId]        Reel Pop CPT post ID (when event originates from a reel-pop modal).
 * @return {{ endpoint: string|null, body: Object|null }} Object with `endpoint` (the base
 * API URL) and `body` (the request payload). Both are `null` when the plugin token is
 * missing or unverified — callers must check `endpoint` before sending.
 */
export function buildAnalyticsRequestBody( {
	type,
	userToken = '',
	visitorTimestamp,
	videoId = 0,
	jobId = '',
	videoIds = [],
	ranges = [],
	videoLength = 0,
	layers = [],
	reelPopId = 0,
} ) {
	const {
		endpoint,
		token,
		userId,
		emailId,
		locationIP,
		isPost,
		isPage,
		isArchive,
		postType,
		postId,
		postTitle,
		categories,
		tags,
		author,
	} = window.videoAnalyticsParams || {};

	const campaignData = window.campaign_data || {};

	// If the token is unverified or endpoint is missing, signal callers to bail
	// by returning a null endpoint.
	if ( ! endpoint || token === 'unverified' ) {
		return { endpoint: null, body: null };
	}

	const ua = getUserAgent( window.navigator.userAgent );

	const body = {
		site_url: window.location.origin,
		user_token: userToken,
		wp_user_id: parseInt( userId, 10 ) || 0,
		account_token: token || '',
		email: emailId || '',
		visitor_timestamp: visitorTimestamp || Date.now(),
		visit_entry_action_url: window.location.href,
		visit_entry_action_name: document.title,
		referer_type: '',
		referer_name: document.referrer || '',
		referer_url: document.referrer || '',
		referer_keyword: '',
		campaign_keyword: campaignData.keyword || '',
		campaign_medium: campaignData.medium || '',
		campaign_name: campaignData.name || '',
		campaign_source: campaignData.source || '',
		campaign_content: campaignData.content || '',
		campaign_token: campaignData.id || '',
		config_token: ua.userAgent,
		config_os: ua.platform,
		config_browser_name: ua.name,
		config_browser_version: ua.version,
		config_resolution: window.innerWidth + 'x' + window.innerHeight,
		location_browser_lang: navigator.language,
		location_ip: locationIP || '',
		config_cookie: navigator.cookieEnabled,
		param_vars: '',
		is_post: isPost === '1',
		is_page: isPage === '1',
		is_archive: isArchive === '1',
		post_type: postType,
		post_id: parseInt( postId, 10 ) || 0,
		post_title: postTitle,
		categories,
		tags,
		author,
		type,
		video_id: videoId ? parseInt( videoId, 10 ) : 0,
		video_ids: type === 1 ? videoIds : [],
		ranges,
		video_length: videoLength || 0,
		page_load_session_id: getPageLoadSessionId(),
	};

	// Only include job_id when it has a value — an empty string triggers
	// server-side validation that returns HTTP 400.
	if ( jobId ) {
		body.job_id = jobId;
	}

	// Layer interactions (type=3) — array of {layer_id, layer_type, action_type,
	// layer_timestamp, layer_name?, page_url?, layer_metadata?}. The microservice
	// enforces a whitelist on layer_type and a max of 100 entries per request;
	// callers (storage.js / flushLayerInteractions) chunk if needed.
	if ( type === 3 && Array.isArray( layers ) && layers.length > 0 ) {
		body.layers = layers;
	}

	const reelPopIdInt = parseInt( reelPopId, 10 );
	if ( reelPopIdInt > 0 ) {
		body.reel_pop_id = reelPopIdInt;
	}

	return { endpoint, body };
}

// Expose helpers on a global namespace so sibling plugins (e.g. godam-for-woo)
// that are bundled separately can reuse them without a shared import path.
// Reusing these guarantees parity between type=1/2/3 and type=4 envelopes.
window.GoDAM = window.GoDAM || {};
window.GoDAM.getPageLoadSessionId = getPageLoadSessionId;
window.GoDAM.getBrowserName = getBrowserName;
window.GoDAM.getOSName = getOSName;
window.GoDAM.shouldSkipAnalytics = shouldSkipAnalytics;
