/**
 * Signed thumbnails and previews for GoDAM files served from a signed folder.
 *
 * The saved thumbnail and preview URLs of an Organization or Embed only file are in the old
 * folder and fail. When one of them fails to load, this asks the site's playback route
 * (`godam/v1/playback/<job>`, the job from `data-godam-job`) once per file and swaps in the
 * signed poster or MP4. Public files load as before and never reach the route.
 */

const SELECTOR = 'img[data-godam-job], [data-godam-job] img, [data-godam-job] video';
const answers = new Map();

/**
 * The route's answer for a job, fetched once per page.
 *
 * @param {string} job GoDAM job id.
 * @return {Promise<Object|null>} The answer, or null.
 */
export function playbackFor( job ) {
	if ( ! answers.has( job ) ) {
		const base = window.godamRestRoute?.url || '/wp-json/';
		answers.set(
			job,
			fetch( `${ base }godam/v1/playback/${ encodeURIComponent( job ) }`, {
				credentials: 'same-origin',
				headers: { Accept: 'application/json' },
			} )
				.then( ( response ) => ( response.ok ? response.json() : null ) )
				.catch( () => null ),
		);
	}
	return answers.get( job );
}

/**
 * Swap a failed GoDAM thumbnail or preview for its signed copy, once.
 *
 * @param {HTMLImageElement|HTMLVideoElement} el The element that failed.
 * @return {Promise<boolean>} Whether it was swapped.
 */
export async function useSignedCopy( el ) {
	const job = el.dataset.godamJob || el.closest( '[data-godam-job]' )?.dataset.godamJob;
	if ( ! job || el.dataset.godamSigned ) {
		return false;
	}
	el.dataset.godamSigned = '1';
	const answer = await playbackFor( job );
	if ( el instanceof HTMLImageElement && answer?.poster ) {
		// A srcset would win over src; the signed poster is the one image there is.
		el.removeAttribute( 'srcset' );
		el.removeAttribute( 'sizes' );
		el.src = answer.poster;
		return true;
	}
	const mp4 = ( answer?.sources || [] ).find( ( source ) => source.type === 'video/mp4' );
	if ( el instanceof HTMLVideoElement && mp4 ) {
		el.src = mp4.src;
		return true;
	}
	return false;
}

/**
 * Whether an element already failed before this script ran.
 *
 * @param {Element} el An image or video.
 * @return {boolean} True when it failed to load.
 */
const hasFailed = ( el ) =>
	( el instanceof HTMLImageElement && el.complete && el.currentSrc && el.naturalWidth === 0 ) ||
	( el instanceof HTMLVideoElement && !! el.error );

/**
 * Watch the page for failed GoDAM thumbnails and previews.
 *
 * @param {Document} doc The document.
 */
export function init( doc = document ) {
	// Load errors don't bubble: listen in the capture phase.
	doc.addEventListener(
		'error',
		( event ) => {
			const el = event.target;
			if ( ( el instanceof HTMLImageElement || el instanceof HTMLVideoElement ) && el.matches( SELECTOR ) ) {
				useSignedCopy( el );
			}
		},
		true,
	);
	// This script loads in the footer: an image may have failed already.
	doc.querySelectorAll( SELECTOR ).forEach( ( el ) => hasFailed( el ) && useSignedCopy( el ) );
}
