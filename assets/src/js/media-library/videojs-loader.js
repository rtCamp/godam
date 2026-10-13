/**
 * Lazy loader for Video.js in the media library.
 *
 * Video.js is a large dependency but is only needed inside the media library when a
 * (virtual/GoDAM proxy) video attachment's detail panel is opened — which most sessions
 * never do. Statically importing it pulled the whole library into the always-loaded
 * media-library bundle. Loading it through a dynamic `import()` splits it into its own
 * async chunk (webpackChunkName "videojs") that is fetched on demand and then cached, so
 * the base bundle stays small.
 */

let cachedVideojs = null;
let loadingPromise = null;

/**
 * Dynamically load (and cache) Video.js.
 *
 * @return {Promise<Function>} Resolves with the videojs factory function.
 */
export function loadVideoJs() {
	if ( cachedVideojs ) {
		return Promise.resolve( cachedVideojs );
	}

	if ( ! loadingPromise ) {
		loadingPromise = import( /* webpackChunkName: "videojs" */ 'video.js' ).then( ( mod ) => {
			cachedVideojs = mod.default || mod;
			return cachedVideojs;
		} ).catch( ( error ) => {
			// Do not cache a rejected import: leaving the failed promise in
			// `loadingPromise` would make every later loadVideoJs() return that
			// same rejection, so a single transient chunk/network failure would
			// break previews until a full page reload. Clear it so the next open
			// retries the import.
			loadingPromise = null;
			throw error;
		} );
	}

	return loadingPromise;
}

/**
 * Synchronously return the already-loaded Video.js, or null if it hasn't been loaded yet.
 *
 * Use this where Video.js is only relevant if a player already exists (e.g. cleanup, or
 * updating a poster on a player that must have been created earlier): if it was never
 * loaded, there is nothing to act on and the caller can safely skip.
 *
 * @return {Function|null} The videojs factory, or null when not yet loaded.
 */
export function getLoadedVideoJs() {
	return cachedVideojs;
}
