/**
 * Which image URL the GoDAM Image block shows in the editor.
 *
 * The block saves the image URL when it is picked. That URL goes stale: it can be the
 * local uploads file of an image GoDAM now serves from its CDN, or an older version of
 * an image that was replaced since. The front end (render.php) prints the attachment's
 * current URL instead; the editor shows the same image so hotspots are placed on what
 * visitors see. Same rule as rtgodam_is_attachment_image_url() in
 * inc/helpers/custom-functions.php.
 */

const EXTENSION = /\.[a-z0-9]+$/i;

/**
 * Host and path of a URL, or null when it can't be parsed as an absolute URL.
 *
 * @param {string} url URL.
 * @return {{host: string, path: string}|null} Lower-case host and the path.
 */
function parts( url ) {
	if ( 'string' !== typeof url || '' === url ) {
		return null;
	}
	try {
		const parsed = new URL( url );
		return { host: parsed.host.toLowerCase(), path: parsed.pathname };
	} catch ( error ) {
		return null;
	}
}

/**
 * The folder part of a path, with its trailing slash.
 *
 * @param {string} path Path.
 * @return {string} Folder.
 */
function folderOf( path ) {
	return path.slice( 0, path.lastIndexOf( '/' ) + 1 );
}

/**
 * Whether an image URL saved on a block is this attachment's image.
 *
 * True for the attachment's current URL ignoring the query string (`?v=v2` and `?v=v3`
 * are versions of one file), for the local upload with any extension, on any domain,
 * and for a file in the same folder as the attachment's GoDAM CDN copy, which keeps its
 * folder when the image is replaced. Anything else is another image: a block copied
 * from another site, where the same ID is a different image.
 *
 * @param {string} savedUrl URL saved on the block.
 * @param {Object} media    Attachment record from the REST API (`source_url`, `media_details.file`).
 * @return {boolean} Whether the saved URL shows this attachment.
 */
export function isAttachmentImageUrl( savedUrl, media ) {
	const saved = parts( savedUrl );
	const current = parts( media?.source_url );
	if ( ! saved || ! current ) {
		return false;
	}

	if ( saved.host === current.host && saved.path === current.path ) {
		return true;
	}

	// The local upload: `media_details.file` is relative to the uploads folder.
	const file = 'string' === typeof media?.media_details?.file ? media.media_details.file.replace( /^\/+/, '' ) : '';
	const fileStem = file ? '/' + file.replace( EXTENSION, '' ) : '';
	if ( fileStem && saved.path.replace( EXTENSION, '' ).endsWith( fileStem ) ) {
		return true;
	}

	// The current URL is GoDAM's CDN copy (not the local upload): a file in its folder.
	const currentIsLocal = fileStem && current.path.replace( EXTENSION, '' ).endsWith( fileStem );
	const folder = folderOf( current.path );
	return ! currentIsLocal && folder.length > 1 && saved.host === current.host && folderOf( saved.path ) === folder;
}

/**
 * The image URL to show in the editor: the attachment's current URL when the saved URL
 * is this attachment's image, otherwise the saved URL.
 *
 * @param {string}      savedUrl URL saved on the block.
 * @param {Object|null} media    Attachment record, or null while loading or when it is gone.
 * @return {string} URL to show.
 */
export function getCurrentImageUrl( savedUrl, media ) {
	if ( ! media?.source_url ) {
		return savedUrl;
	}
	// GoDAM's URL filter returns an esc_url()'d URL, which encodes `&`.
	const currentUrl = media.source_url.replace( /&#0?38;|&amp;/g, '&' );
	if ( ! savedUrl ) {
		return currentUrl;
	}
	return isAttachmentImageUrl( savedUrl, { ...media, source_url: currentUrl } ) ? currentUrl : savedUrl;
}
