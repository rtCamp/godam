/**
 * Per-tab sessionStorage buffer for layer interaction events.
 *
 * All layer managers (CTA, Form, Hotspot, and any add-on like the Woo
 * hotspot manager in godam-for-woo) push events here via
 * `window.GoDAM.addLayerInteraction`. The buffer is flushed once per
 * page session, on `pagehide`, by `trackLayerInteraction()` in analytics.js.
 *
 * Uses `sessionStorage` (per browser tab), NOT `localStorage`. The flush
 * stamps the request with the tab's per-pageload `page_load_session_id` and
 * clears the buffer. With a shared `localStorage` buffer, a second tab/page
 * with a GoDAM video — and the flush fires on `visibilitychange:hidden`, i.e.
 * every tab switch — would read the *other* tab's buffered events, stamp them
 * with its own session id, and clear them: distinct converting sessions get
 * undercounted and events lost. `sessionStorage` is scoped to the tab, so each
 * tab buffers and flushes only its own events under a single session id.
 *
 * Key: 'godamLayerInteractions' (single map keyed by videoKey, which is
 * the video's data-id or job_id).
 *
 * Storage layout: an object mapping videoKey strings to arrays of event
 * objects, where each event includes layer_id, layer_type, action_type,
 * layer_timestamp, and optionally layer_name, page_url, layer_metadata.
 *
 * Safety properties:
 * - All reads and writes are wrapped in try/catch — quota or parse errors
 * silently degrade to in-memory no-op, never throw to the caller.
 * - The buffer is opaque to callers; only the four exported functions
 * should touch the underlying key.
 */

const STORAGE_KEY = 'godamLayerInteractions';

// Defensive upper bound on buffered events per video per page session.
// Per-session dedupe in the manager classes already bounds normal growth to
// one event per (layer_id, action_type), but a pathological page (hundreds of
// sub-hotspots) shouldn't be able to grow the buffer until setItem throws on
// quota. Generous vs. the server's 100-events-per-POST chunking.
const MAX_EVENTS_PER_VIDEO = 1000;

/**
 * Safely read and JSON-parse a sessionStorage key.
 *
 * @param {string} key          The sessionStorage key.
 * @param {*}      defaultValue Value returned when the key is missing or unparseable.
 * @return {*} Parsed value, or defaultValue on miss/error.
 */
function readJSON( key, defaultValue ) {
	try {
		const raw = sessionStorage.getItem( key );
		if ( ! raw ) {
			return defaultValue;
		}
		const parsed = JSON.parse( raw );
		return parsed ?? defaultValue;
	} catch ( e ) {
		return defaultValue;
	}
}

/**
 * Safely JSON-stringify a value and write it to sessionStorage.
 *
 * Silently swallows errors (quota exceeded, private-mode restrictions);
 * analytics is best-effort and must not break user-facing video playback.
 *
 * @param {string} key
 * @param {*}      value
 */
function writeJSON( key, value ) {
	try {
		sessionStorage.setItem( key, JSON.stringify( value ) );
	} catch ( e ) {
		// Silent fail — analytics is best-effort.
	}
}

/**
 * Get the entire layer-interactions buffer.
 *
 * @return {Object<string, Array<Object>>} videoKey → array of event objects.
 */
export function getLayerInteractions() {
	const data = readJSON( STORAGE_KEY, {} );
	return typeof data === 'object' && data !== null ? data : {};
}

/**
 * Append many layer interaction events in ONE sessionStorage round trip.
 *
 * Reading, parsing, stringifying and writing the buffer is synchronous and
 * costs O(buffer) every time. A layer becoming visible emits one event for the
 * layer plus one per hotspot, so calling the single-event writer in a loop
 * would repeat that whole cost N+1 times back to back, during playback. This
 * pays it once regardless of batch size.
 *
 * @param {string}        videoKey data-id or job_id of the video. Required and non-empty.
 * @param {Array<Object>} events   Event objects. Each must include layer_id,
 *                                 layer_type, action_type, layer_timestamp.
 *                                 Malformed entries are skipped, not fatal.
 */
export function addLayerInteractions( videoKey, events ) {
	if ( ! videoKey || typeof videoKey !== 'string' ) {
		return;
	}
	if ( ! Array.isArray( events ) || events.length === 0 ) {
		return;
	}

	// Defensive — the manager classes set these, but if any caller forgets
	// we silently drop rather than emit a malformed event the server will 4xx.
	const valid = events.filter(
		( event ) =>
			event &&
			typeof event === 'object' &&
			event.layer_id &&
			event.layer_type &&
			event.action_type,
	);
	if ( valid.length === 0 ) {
		return;
	}

	const buffer = getLayerInteractions();
	if ( ! Array.isArray( buffer[ videoKey ] ) ) {
		buffer[ videoKey ] = [];
	}

	// Drop new events past the cap rather than risk a quota-exceeded throw.
	const room = MAX_EVENTS_PER_VIDEO - buffer[ videoKey ].length;
	if ( room <= 0 ) {
		return;
	}

	buffer[ videoKey ].push( ...valid.slice( 0, room ) );
	writeJSON( STORAGE_KEY, buffer );
}

/**
 * Append a single layer interaction event to the buffer.
 *
 * @param {string} videoKey data-id or job_id of the video. Required and non-empty.
 * @param {Object} event    Event object. Must include layer_id, layer_type, action_type, layer_timestamp.
 */
export function addLayerInteraction( videoKey, event ) {
	addLayerInteractions( videoKey, [ event ] );
}

/**
 * Clear the entire layer-interactions buffer. Called by the flush function
 * after a successful POST to /analytics/.
 */
export function clearLayerInteractions() {
	try {
		sessionStorage.removeItem( STORAGE_KEY );
	} catch ( e ) {
		// Silent fail.
	}
}
