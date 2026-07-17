const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

const MEDIA_ENDPOINT = 'wp/v2/media';

/**
 * Validates if the given string is a valid URL.
 *
 * @param {string} url The URL string to validate.
 * @return {boolean} True if valid, false otherwise.
 */
export const isValidURL = ( url ) => {
	if ( ! url || url.trim() === '' ) {
		return true; // optional field
	}

	const value = url.trim();

	try {
		const parsed = new URL( value );

		// Must be proper http/https
		if ( ! [ 'http:', 'https:' ].includes( parsed.protocol ) ) {
			return false;
		}

		// Must include a hostname
		if ( ! parsed.hostname ) {
			return false;
		}

		// Prevent cases like "https:google.com"
		// These are parsed with empty hostname
		// Use case-insensitive check to allow mixed-case protocols like HTTP:// or Https://
		const lowerValue = value.toLowerCase();
		if ( ! lowerValue.startsWith( 'http://' ) && ! lowerValue.startsWith( 'https://' ) ) {
			return false;
		}

		return true;
	} catch {
		return false;
	}
};

function createBlockDelimiter( { blockName, attrs = {}, innerHTML = '' } ) {
	const name = blockName.replace( /^core\//, '' );
	const hasAttributes = Object.keys( attrs ).length > 0;
	const attrString = hasAttributes ? ` ${ JSON.stringify( attrs ) }` : '';

	if ( ! innerHTML ) {
		return `<!-- wp:${ name }${ attrString } /-->`;
	}

	return `<!-- wp:${ name }${ attrString } -->${ innerHTML }<!-- /wp:${ name } -->`;
}

function createGoDAMVideoBlockMarkup( attrs, blockName = 'godam/video' ) {
	// The audio and image blocks are dynamic (their save() returns null), so
	// Gutenberg stores them as a self-closing block comment with no inner HTML.
	// Serialize that way — wrapping in a <div> would make the pasted block invalid.
	if ( blockName === 'godam/audio' || blockName === 'godam/image' ) {
		return createBlockDelimiter( { blockName, attrs, innerHTML: '' } );
	}

	// e.g. 'godam/video' -> 'wp-block-godam-video'.
	const className = `wp-block-${ blockName.replace( '/', '-' ) }`;
	const innerHTML = `<div class="${ className }"></div>`;

	return createBlockDelimiter( {
		blockName,
		attrs,
		innerHTML,
	} );
}

function createVideoAttributes( attachmentId, mediaData ) {
	const baseAttrs = {
		id: Number( attachmentId ),
		aspectRatio: 'responsive',
	};

	if ( ! mediaData ) {
		return baseAttrs;
	}

	const {
		source_url: sourceUrl,
		mime_type: mimeType,
		media_details: mediaDetails,
		meta,
	} = mediaData;

	const videoWidth = mediaDetails?.width || meta?.width;
	const videoHeight = mediaDetails?.height || meta?.height;
	const dimensionAttrs = ( videoWidth && videoHeight )
		? {
			videoWidth: `${ videoWidth }`,
			videoHeight: `${ videoHeight }`,
		}
		: {};

	if ( sourceUrl ) {
		// Convert .mov files to video/mp4 type to match editor behavior
		const adjustedMimeType = mimeType === 'video/quicktime' ? 'video/mp4' : mimeType;

		return {
			...baseAttrs,
			...dimensionAttrs,
			src: sourceUrl,
			sources: [ {
				src: sourceUrl,
				type: adjustedMimeType,
			} ],
		};
	}

	return {
		...baseAttrs,
		...dimensionAttrs,
	};
}

/**
 * Strip HTML tags from a rendered string and collapse whitespace.
 *
 * @param {string} html Rendered HTML (or plain string).
 * @return {string} Plain text.
 */
function stripHtmlToText( html ) {
	if ( ! html || typeof html !== 'string' ) {
		return '';
	}
	const el = document.createElement( 'div' );
	el.innerHTML = html;
	return ( el.textContent || '' ).replace( /\s+/g, ' ' ).trim();
}

function createAudioAttributes( attachmentId, mediaData ) {
	// Matches how the godam/audio block stores its attributes (see the block's
	// edit.js onSelectAudio): id + src + title/caption/description, plus the
	// default block class. The block is dynamic, so this is serialized as a
	// self-closing comment (see createGoDAMVideoBlockMarkup).
	const baseAttrs = {
		id: Number( attachmentId ),
		className: 'wp-block-godam-audio',
	};

	if ( ! mediaData ) {
		return baseAttrs;
	}

	// WordPress can seed an attachment's description with the raw media URL;
	// strip any URLs so the file path is never copied into the block (mirrors
	// the block's own guard in edit.js onSelectAudio).
	const clean = ( value ) => stripHtmlToText( value )
		.replace( /https?:\/\/\S+/g, '' )
		.replace( /\s+/g, ' ' )
		.trim();

	const title = stripHtmlToText( mediaData.title?.rendered ?? mediaData.title );
	const description = clean( mediaData.description?.rendered ?? mediaData.description );
	// The GoDAM audio cover lives in post meta (an external CDN URL, so no
	// thumbnailId). Carry it into the copied block so the pasted player shows the
	// same cover the editor/front end does.
	const thumbnail = mediaData.meta?.rtgodam_media_audio_thumbnail || '';

	return {
		id: Number( attachmentId ),
		src: mediaData.source_url || '',
		audioTitle: title,
		description,
		thumbnail,
		className: 'wp-block-godam-audio',
	};
}

/**
 * Build the attributes for a copied `godam/image` block. Matches how the block
 * stores them (see its edit.js onSelectImage): id + url + alt + dimensions, and
 * `showImageLayers` on so the pasted block shows the authored layers. The block
 * is dynamic, so this is serialized as a self-closing comment.
 *
 * @param {number} attachmentId Attachment ID.
 * @param {Object} mediaData    The `/wp/v2/media/:id` payload (may be null).
 * @return {Object} Block attributes.
 */
function createImageAttributes( attachmentId, mediaData ) {
	const baseAttrs = {
		id: Number( attachmentId ),
		showImageLayers: true,
		className: 'wp-block-godam-image',
	};

	if ( ! mediaData ) {
		return baseAttrs;
	}

	const width = mediaData.media_details?.width || mediaData.meta?.width;
	const height = mediaData.media_details?.height || mediaData.meta?.height;

	return {
		...baseAttrs,
		...( mediaData.source_url ? { url: mediaData.source_url } : {} ),
		...( mediaData.alt_text ? { alt: stripHtmlToText( mediaData.alt_text ) } : {} ),
		...( width && height ? { width: Number( width ), height: Number( height ) } : {} ),
	};
}

/**
 * Build the block attributes appropriate to the media type. Video keeps its
 * full source/dimension attributes; audio needs only id + src (title,
 * description and thumbnail are block-level, user-entered values); image carries
 * id + url + dimensions + the layers toggle.
 *
 * @param {number} attachmentId Attachment ID.
 * @param {Object} mediaData    The `/wp/v2/media/:id` payload (may be null).
 * @param {string} mediaType    `'video' | 'audio' | 'image'`.
 * @return {Object} Block attributes.
 */
function createBlockAttributes( attachmentId, mediaData, mediaType ) {
	if ( mediaType === 'audio' ) {
		return createAudioAttributes( attachmentId, mediaData );
	}
	if ( mediaType === 'image' ) {
		return createImageAttributes( attachmentId, mediaData );
	}
	return createVideoAttributes( attachmentId, mediaData );
}

async function fetchMediaData( attachmentId ) {
	try {
		const endpoint = window.pathJoin( [ restURL, `/${ MEDIA_ENDPOINT }/${ attachmentId }` ] );
		const response = await fetch( endpoint, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		} );
		if ( ! response.ok ) {
			return null;
		}
		return await response.json();
	} catch ( error ) {
		return null;
	}
}

// Cache for media data, keyed by `${attachmentId}::${blockName}` so audio and
// video markup for the same attachment don't collide.
const mediaDataCache = new Map();

const cacheKey = ( attachmentId, blockName ) => `${ attachmentId }::${ blockName }`;

export const prefetchMediaDataForCopy = async ( attachmentId, { blockName = 'godam/video', mediaType = 'video' } = {} ) => {
	const key = cacheKey( attachmentId, blockName );
	if ( mediaDataCache.has( key ) ) {
		return; // Already cached
	}
	try {
		const mediaData = await fetchMediaData( attachmentId );
		const attrs = createBlockAttributes( attachmentId, mediaData, mediaType );
		const html = createGoDAMVideoBlockMarkup( attrs, blockName );
		mediaDataCache.set( key, html );
	} catch {
	}
};

/**
 * Build the GoDAM block markup for an attachment (without touching the
 * clipboard). Used by the product guide's "add it to a page" flow to seed a new
 * draft page. Reuses the cached payload populated by the copy/prefetch helpers.
 *
 * @param {number} attachmentId        Attachment ID.
 * @param {Object} [options]           Options.
 * @param {string} [options.blockName] Block to emit (default `godam/video`).
 * @param {string} [options.mediaType] Media type for attribute building.
 * @return {Promise<string>} Serialized block markup.
 */
export const getGoDAMVideoBlockMarkup = async ( attachmentId, { blockName = 'godam/video', mediaType = 'video' } = {} ) => {
	const key = cacheKey( attachmentId, blockName );
	if ( mediaDataCache.has( key ) ) {
		return mediaDataCache.get( key );
	}
	const mediaData = await fetchMediaData( attachmentId );
	const attrs = createBlockAttributes( attachmentId, mediaData, mediaType );
	const html = createGoDAMVideoBlockMarkup( attrs, blockName );
	mediaDataCache.set( key, html );
	return html;
};

export const copyGoDAMVideoBlock = async ( attachmentId, { blockName = 'godam/video', mediaType = 'video' } = {} ) => {
	// Check clipboard API availability.
	if ( ! navigator.clipboard?.writeText ) {
		return false;
	}
	const key = cacheKey( attachmentId, blockName );
	// Check if we have cached data
	if ( mediaDataCache.has( key ) ) {
		const html = mediaDataCache.get( key );
		await navigator.clipboard.writeText( html );
		return true;
	}

	try {
		const mediaData = await fetchMediaData( attachmentId );

		const attrs = createBlockAttributes( attachmentId, mediaData, mediaType );

		const html = createGoDAMVideoBlockMarkup( attrs, blockName );

		mediaDataCache.set( key, html );
		await navigator.clipboard.writeText( html );

		return true;
	} catch ( error ) {
		return false;
	}
};
