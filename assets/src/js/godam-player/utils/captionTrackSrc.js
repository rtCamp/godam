/**
 * Internal dependencies
 */
import { parseCaptions } from './parseCaptions.js';

const SRT_URL = /\.srt(?:[?#]|$)/i;

// One conversion per transcript URL, shared by the captions track and the
// transcript panel so the file is fetched once.
const conversions = new Map();

/**
 * Whether a caption file URL points at an .srt file.
 *
 * @param {string} url Caption file URL.
 * @return {boolean} True for an .srt URL (query string and hash ignored).
 */
export function isSrtUrl( url ) {
	return SRT_URL.test( String( url || '' ) );
}

/**
 * Format seconds as a WebVTT timestamp (`hh:mm:ss.mmm`).
 *
 * @param {number} seconds Seconds.
 * @return {string} Timestamp.
 */
function toVttStamp( seconds ) {
	const totalMs = Math.max( 0, Math.round( ( seconds || 0 ) * 1000 ) );
	const pad = ( value, size = 2 ) => String( value ).padStart( size, '0' );
	const hours = Math.floor( totalMs / 3600000 );
	const minutes = Math.floor( ( totalMs % 3600000 ) / 60000 );
	const secs = Math.floor( ( totalMs % 60000 ) / 1000 );
	return `${ pad( hours ) }:${ pad( minutes ) }:${ pad( secs ) }.${ pad( totalMs % 1000, 3 ) }`;
}

/**
 * Write cues as a WebVTT document.
 *
 * @param {Array<{start:number,end:number,text:string}>} cues Ordered cues.
 * @return {string} WebVTT text.
 */
export function cuesToWebVtt( cues ) {
	const blocks = cues.map( ( cue ) => {
		// The WebVTT timing arrow "-->" inside cue text would end the cue
		// early. (A plain split rather than a regex: this is cue syntax, not
		// HTML filtering.)
		const text = String( cue.text ).split( '-->' ).join( '->' );
		return `${ toVttStamp( cue.start ) } --> ${ toVttStamp( Math.max( cue.end, cue.start ) ) }\n${ text }`;
	} );
	return `WEBVTT\n\n${ blocks.join( '\n\n' ) }\n`;
}

/**
 * Get a `<track>` source the browser can parse for a transcript file.
 *
 * Browsers only parse WebVTT in a text track, so an .srt transcript (which
 * the media editor accepts) would load with no cues: no captions and no
 * transcript panel. An .srt URL is fetched, converted and returned as a
 * `blob:` URL of the same cues in WebVTT. Any other URL, or any failure
 * (network, CORS, an unreadable file), returns the URL unchanged.
 *
 * @param {string} url Transcript file URL.
 * @return {Promise<string>} A URL to use as the track's `src`.
 */
export function toWebVttTrackSrc( url ) {
	if ( ! isSrtUrl( url ) || typeof fetch !== 'function' || typeof window.URL?.createObjectURL !== 'function' ) {
		return Promise.resolve( url );
	}

	if ( ! conversions.has( url ) ) {
		const conversion = ( async () => {
			try {
				const response = await fetch( url );
				if ( ! response.ok ) {
					return url;
				}
				const cues = parseCaptions( await response.text() );
				if ( cues.length === 0 ) {
					return url;
				}
				return window.URL.createObjectURL( new Blob( [ cuesToWebVtt( cues ) ], { type: 'text/vtt' } ) );
			} catch ( error ) {
				return url;
			}
		} )();
		conversions.set( url, conversion );
		// Keep only a converted file. A fallback is forgotten once it settles,
		// so a one-off failure does not leave the page without captions and a
		// transcript: the next request fetches again.
		conversion.then( ( src ) => {
			if ( src === url && conversions.get( url ) === conversion ) {
				conversions.delete( url );
			}
		} );
	}

	return conversions.get( url );
}
