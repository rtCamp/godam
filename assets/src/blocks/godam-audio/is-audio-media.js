/**
 * Whether a media selection can be used by the GoDAM Audio block.
 *
 * Reads the MIME string rather than `media.type`: the latter is the top-level type
 * ("audio") for library selections but the REST post type ("attachment") for freshly
 * uploaded files, which would reject every uploaded audio file. `mime` is set on library
 * selections, `mime_type` on uploads.
 *
 * WordPress types every .webm file video/webm, audio-only recordings included (Chrome
 * records audio as WebM), so that one video type is accepted as well.
 *
 * video/mp4 is not accepted, so a Safari audio recording (.mp4) uploaded straight into the
 * picker is refused: an .mp4 is usually real video. GoDAM-tab recordings are not affected,
 * because the server already reports them as audio/webm or audio/mp4.
 *
 * @since 2.4.0
 *
 * @param {Object} media Media object from the media modal or an upload.
 * @return {boolean} False when the MIME type names a non-audio format, except video/webm.
 */
export default function isAudioMedia( media ) {
	const mime = media?.mime || media?.mime_type || '';
	const mediaType = mime.split( '/' )[ 0 ];

	return ! mediaType || 'audio' === mediaType || 'video/webm' === mime;
}
