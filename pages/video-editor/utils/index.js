/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

const MEDIA_ENDPOINT = '/wp-json/wp/v2/media';

function createBlockDelimiter( { blockName, attrs = {}, innerHTML = '' } ) {
	const name = blockName.replace( /^core\//, '' );
	const hasAttributes = Object.keys( attrs ).length > 0;
	const attrString = hasAttributes ? ` ${ JSON.stringify( attrs ) }` : '';

	if ( ! innerHTML ) {
		return `<!-- wp:${ name }${ attrString } /-->`;
	}

	return `<!-- wp:${ name }${ attrString } -->${ innerHTML }<!-- /wp:${ name } -->`;
}

function createGoDAMVideoBlockMarkup( attrs ) {
	const innerHTML = `<div class="wp-block-godam-video"></div>`;

	return createBlockDelimiter( {
		blockName: 'godam/video',
		attrs,
		innerHTML,
	} );
}

function createVideoAttributes( attachmentId, mediaData ) {
	const baseAttrs = {
		id: Number( attachmentId ),
		aspectRatio: '16/9',
	};

	if ( ! mediaData ) {
		return baseAttrs;
	}

	const { source_url: sourceUrl, mime_type: mimeType } = mediaData;

	if ( sourceUrl ) {
		// Convert .mov files to video/mp4 type to match editor behavior
		const adjustedMimeType = mimeType === 'video/quicktime' ? 'video/mp4' : mimeType;

		return {
			...baseAttrs,
			src: sourceUrl,
			sources: [ {
				src: sourceUrl,
				type: adjustedMimeType,
			} ],
		};
	}

	return baseAttrs;
}

async function fetchMediaData( attachmentId ) {
	try {
		const endpoint = `${ MEDIA_ENDPOINT }/${ attachmentId }`;
		return await apiFetch( { path: endpoint } );
	} catch ( error ) {
		return null;
	}
}

export const copyGoDAMVideoBlock = async ( attachmentId ) => {
	// Check clipboard API availability.
	if ( ! navigator.clipboard?.writeText ) {
		return false;
	}

	try {
		const mediaData = await fetchMediaData( attachmentId );

		const attrs = createVideoAttributes( attachmentId, mediaData );

		const html = createGoDAMVideoBlockMarkup( attrs );

		await navigator.clipboard.writeText( html );

		return true;
	} catch ( error ) {
		return false;
	}
};
