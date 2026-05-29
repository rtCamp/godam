/**
 * localStorage buffer for layer interaction events.
 *
 * All layer managers (CTA, Form, Hotspot, and any add-on like the Woo
 * hotspot manager in godam-for-woo) push events here via
 * `window.GoDAM.addLayerInteraction`. The buffer is flushed once per
 * page session, on `pagehide`, by `trackLayerInteraction()` in analytics.js.
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
 * Safely read and JSON-parse a localStorage key.
 *
 * @param {string} key          The localStorage key.
 * @param {*}      defaultValue Value returned when the key is missing or unparseable.
 * @return {*} Parsed value, or defaultValue on miss/error.
 */
function readJSON( key, defaultValue ) {
	try {
		const raw = localStorage.getItem( key );
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
 * Safely JSON-stringify a value and write it to localStorage.
 *
 * Silently swallows errors (quota exceeded, private-mode restrictions);
 * analytics is best-effort and must not break user-facing video playback.
 *
 * @param {string} key
 * @param {*}      value
 */
function writeJSON( key, value ) {
	try {
		localStorage.setItem( key, JSON.stringify( value ) );
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
 * Append a layer interaction event to the buffer.
 *
 * @param {string} videoKey data-id or job_id of the video. Required and non-empty.
 * @param {Object} event    Event object. Must include layer_id, layer_type, action_type, layer_timestamp.
 */
export function addLayerInteraction( videoKey, event ) {
	if ( ! videoKey || typeof videoKey !== 'string' ) {
		return;
	}
	if ( ! event || typeof event !== 'object' ) {
		return;
	}
	if ( ! event.layer_id || ! event.layer_type || ! event.action_type ) {
		// Defensive — the manager classes set these, but if any caller forgets
		// we silently drop rather than emit a malformed event the server will 4xx.
		return;
	}

	const buffer = getLayerInteractions();
	if ( ! Array.isArray( buffer[ videoKey ] ) ) {
		buffer[ videoKey ] = [];
	}
	// Drop new events past the cap rather than risk a quota-exceeded throw.
	if ( buffer[ videoKey ].length >= MAX_EVENTS_PER_VIDEO ) {
		return;
	}
	buffer[ videoKey ].push( event );
	writeJSON( STORAGE_KEY, buffer );
}

/**
 * Clear the entire layer-interactions buffer. Called by the flush function
 * after a successful POST to /analytics/.
 */
export function clearLayerInteractions() {
	try {
		localStorage.removeItem( STORAGE_KEY );
	} catch ( e ) {
		// Silent fail.
	}
}
