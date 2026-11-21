/**
 * Signed sources for the editor's preview of GoDAM media served from a signed folder.
 *
 * Organization and Embed only files don't play from the URLs saved on the attachment. The
 * preview asks the same route the front end uses (`godam/v1/playback/<job>`). The signed
 * URLs expire, so they are only shown, never saved into the block.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { useSelect } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import { store as coreStore } from '@wordpress/core-data';

/**
 * @param {number} attachmentId The block's attachment id.
 * @return {{sources: Array, poster: string}|null} Signed sources, or null to keep the saved ones.
 */
export default function useSignedPreview( attachmentId ) {
	const jobId = useSelect(
		( select ) => ( attachmentId ? select( coreStore ).getMedia( attachmentId )?.meta?.rtgodam_transcoding_job_id || '' : '' ),
		[ attachmentId ],
	);
	const [ signed, setSigned ] = useState( null );

	useEffect( () => {
		setSigned( null );
		if ( ! jobId ) {
			return undefined;
		}
		let live = true;
		apiFetch( { path: `/godam/v1/playback/${ encodeURIComponent( jobId ) }` } )
			.then( ( data ) => {
				if ( live && Array.isArray( data?.sources ) && data.sources.length ) {
					setSigned( { sources: data.sources, poster: data.poster || '' } );
				}
			} )
			.catch( () => {} );
		return () => {
			live = false;
		};
	}, [ jobId ] );

	return signed;
}

/**
 * The poster and sources the editor's preview shows: the signed ones when there are any.
 * A custom poster the user chose (on another host) wins over the signed GoDAM one; the
 * saved GoDAM poster is in the old folder, so the signed copy replaces it.
 *
 * @param {{sources: Array, poster: string}|null} signed              What useSignedPreview returned.
 * @param {Object}                                saved               The block's own values.
 * @param {string}                                saved.poster        The saved poster URL.
 * @param {Array}                                 saved.sources       The saved sources.
 * @param {string}                                saved.defaultPoster The poster to fall back to.
 * @return {{poster: string, sources: Array}} What to preview.
 */
export function previewMedia( signed, { poster, sources, defaultPoster } ) {
	const useSignedPoster = signed?.poster && ( ! poster || sameHost( poster, signed.poster ) );
	return {
		poster: ( useSignedPoster ? signed.poster : poster ) || defaultPoster,
		sources: signed?.sources || sources,
	};
}

/**
 * Whether two URLs are on the same host (the saved poster is GoDAM's own copy).
 *
 * @param {string} a A URL.
 * @param {string} b Another URL.
 * @return {boolean} True when both parse and share a host.
 */
function sameHost( a, b ) {
	try {
		return new URL( a ).host === new URL( b ).host;
	} catch ( error ) {
		return false;
	}
}
