/**
 * Whether a media selection can be used by the GoDAM Audio block.
 *
 * Reads the MIME string rather than `media.type`: the latter is the top-level type
 * ("audio") for library selections but the REST post type ("attachment") for freshly
 * uploaded files, which would reject every uploaded audio file. `mime` is set on library
 * selections, `mime_type` on uploads.
 *
 * Audio-only .webm and .mp4 uploads are stored as audio/webm and audio/mp4 (see
 * Media_Library_Ajax::store_audio_only_upload_as_audio()), and GoDAM-tab recordings are
 * reported as audio, so both pass as audio. One video type is still accepted: a .webm
 * uploaded before that, stored as video/webm, that has no picture size. WordPress gives a
 * video's width and height only when the file has a picture, so a WebM with video is
 * refused like any other video.
 *
 * @since 2.4.0
 *
 * @param {Object} media Media object from the media modal or an upload.
 * @return {boolean} False when the MIME type names a non-audio format, or a video/webm with a picture.
 */
export default function isAudioMedia( media ) {
	const mime = media?.mime || media?.mime_type || '';
	const mediaType = mime.split( '/' )[ 0 ];

	if ( 'video/webm' === mime ) {
		const width = media?.width || media?.media_details?.width;
		const height = media?.height || media?.media_details?.height;

		return ! width && ! height;
	}

	return ! mediaType || 'audio' === mediaType;
}
