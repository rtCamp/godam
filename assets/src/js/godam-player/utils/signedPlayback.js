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
 * @return {Promise<{sources: Array<{src: string, type: string}>, poster: string, transcript: string}|null>} Null when there is nothing usable.
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
		return sources.length ? { sources, poster: data.poster || '', transcript: data.transcript || '' } : null;
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
 * Point the player's transcript at the signed copy, in place on the video's dataset.
 *
 * Only when the stored transcript is GoDAM's own (or there is none): a caption uploaded to
 * WordPress keeps playing from WordPress, and one deleted in the editor stays deleted.
 *
 * @param {DOMStringMap} dataset The video element's dataset.
 * @param {Object}       signed  What fetchSignedSources returned.
 * @return {boolean} Whether the transcript changed.
 */
export function applySignedTranscript( dataset, signed ) {
	if ( ! dataset || ! signed?.transcript || dataset.transcriptDeleted === 'true' ) {
		return false;
	}
	const stored = dataset.transcriptUrl || '';
	if ( stored && hostOf( stored ) !== hostOf( signed.transcript ) ) {
		return false;
	}
	dataset.transcriptUrl = signed.transcript;
	return true;
}

function hostOf( url ) {
	try {
		return new URL( url, window.location.href ).host;
	} catch ( error ) {
		return '';
	}
}
