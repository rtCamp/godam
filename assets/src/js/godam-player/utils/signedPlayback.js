/**
 * Signed playback sources for GoDAM media.
 *
 * Files set to Organization or Embed only in GoDAM are served from a signed CDN folder, so
 * the URLs saved in WordPress don't play. The player asks the site's own REST route
 * (`godam/v1/playback/<job>`, see class-playback.php) just before it starts, and uses the
 * signed sources it returns. Any failure keeps the saved sources: Public files, older GoDAM
 * servers and sites without the route behave exactly as before.
 */

const TIMEOUT_MS = 5000;

/**
 * Fetch signed sources from the site's playback route.
 *
 * @param {string}   url     The element's `data-playback-url`.
 * @param {Function} fetchFn Injected for tests; defaults to window.fetch.
 * @return {Promise<{sources: Array<{src: string, type: string}>, poster: string, captions: Array<Object>}|null>} Null when there is nothing usable.
 */
export async function fetchSignedSources( url, fetchFn = window.fetch.bind( window ) ) {
	if ( ! url ) {
		return null;
	}
	const controller = typeof AbortController === 'function' ? new AbortController() : null;
	const timer = controller ? setTimeout( () => controller.abort(), TIMEOUT_MS ) : null;
	try {
		const response = await fetchFn( url, {
			credentials: 'same-origin',
			headers: { Accept: 'application/json' },
			signal: controller?.signal,
		} );
		if ( ! response.ok ) {
			return null;
		}
		const data = await response.json();
		const sources = Array.isArray( data?.sources ) ? data.sources.filter( ( source ) => source?.src ) : [];
		const captions = Array.isArray( data?.captions ) ? data.captions : [];
		return sources.length ? { sources, poster: data.poster || '', captions } : null;
	} catch ( error ) {
		return null;
	} finally {
		if ( timer ) {
			clearTimeout( timer );
		}
	}
}

/**
 * Put signed sources (and poster) into the player's setup, in place.
 *
 * @param {Object} setup  The video.js setup object (`configManager.videoSetupControls`).
 * @param {Object} signed What fetchSignedSources returned.
 * @return {boolean} Whether anything changed.
 */
export function applySignedSources( setup, signed ) {
	if ( ! setup || ! signed?.sources?.length ) {
		return false;
	}
	setup.sources = signed.sources;
	if ( signed.poster ) {
		setup.poster = signed.poster;
	}
	return true;
}

/**
 * Before the player starts: swap in the signed sources and poster, if the route has any.
 *
 * @param {HTMLVideoElement} video   The player's video element (its `data-playback-url`).
 * @param {Object}           setup   The video.js setup object, changed in place.
 * @param {Function}         fetchFn Injected for tests; defaults to window.fetch.
 * @return {Promise<Array<Object>|null>} The signed caption tracks for the transcript manager, or null. GoDAM's public caption endpoint refuses these files.
 */
export async function prepareSignedPlayback( video, setup, fetchFn ) {
	// An undefined fetchFn takes fetchSignedSources' default.
	const signed = await fetchSignedSources( video.dataset.playbackUrl, fetchFn );
	if ( applySignedSources( setup, signed ) && signed.poster ) {
		// Load the signed poster now: the stored one is in the old folder and 404s, and the
		// player would only fetch this one once it has started.
		video.poster = signed.poster;
	}
	return signed?.captions?.length ? signed.captions : null;
}

/**
 * The URL of the track to show as the transcript: the default ready one, else the first.
 *
 * @param {Array<Object>|null} captions Signed caption tracks from the playback route.
 * @return {string} The track's URL, or '' when none is ready.
 */
export function defaultCaptionUrl( captions ) {
	const ready = ( captions || [] ).filter( ( caption ) => !! caption?.vtt_path );
	const caption = ready.find( ( track ) => track.is_default ) || ready[ 0 ];
	return caption ? caption.vtt_path : '';
}
