/**
 * Global unit-test setup.
 *
 * jsdom doesn't provide `fetch`, and RTK Query's `fetchBaseQuery` logs a warning
 * at import time when it's missing (the analytics API is created the moment
 * useVideoLayerData is imported, even though the unit tests never issue
 * requests). A no-op stub keeps the output clean.
 */
if ( typeof global.fetch === 'undefined' ) {
	global.fetch = () => Promise.resolve();
}
