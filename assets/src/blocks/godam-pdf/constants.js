/**
 * Document formats the Document block accepts.
 *
 * Mirror of rtgodam_get_supported_document_types() in inc/helpers/custom-functions.php,
 * which is the source of truth. tests/php/DocumentSupportTest.php parses this file and
 * asserts the two lists stay identical, so edit both together.
 *
 * Everything except PDF is converted to a preview PDF by GoDAM Central, so the block only
 * ever renders a PDF — but the media library has to accept the original upload first.
 */
export const SUPPORTED_DOCUMENT_TYPES = {
	'application/pdf': 'pdf',
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
	'application/msword': 'doc',
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
	'application/vnd.ms-excel': 'xls',
	'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
	'application/vnd.ms-powerpoint': 'ppt',
	'application/vnd.oasis.opendocument.text': 'odt',
	'application/vnd.oasis.opendocument.spreadsheet': 'ods',
	'application/vnd.oasis.opendocument.presentation': 'odp',
	'text/plain': 'txt',
	'text/csv': 'csv',
	// Some servers report .csv as application/csv; Central accepts both.
	'application/csv': 'csv',
};

/**
 * MIME types, for MediaUpload's `allowedTypes`.
 */
export const ALLOWED_MEDIA_TYPES = Object.keys( SUPPORTED_DOCUMENT_TYPES );

/**
 * Transcoding statuses that mean a job is genuinely in flight.
 *
 * Lowercased mirror of the $status_messages map in inc/classes/rest-api/class-transcoding.php
 * — the only enumeration of what GoDAM Central's status_callback sends — minus the terminal
 * 'Transcoded'. 'Queued' is also written locally the moment Central accepts a job, in
 * RTGODAM_Transcoder_Handler::wp_media_transcoding().
 *
 * Deliberately an allow-list. Central's value is stored verbatim with no enum or validation,
 * so treating everything else as "still working" would leave a document that was never
 * dispatched (no API key) promising a preview forever. An unrecognised status therefore falls
 * through to the download-only panel — if Central adds a stage, add it here.
 *
 * Statuses are lowercased before comparison because casing is mixed: Central and
 * wp_media_transcoding() use Title Case ('Queued', 'Transcoding'), while plugin-authored
 * values are lowercase ('failed', 'blocked', 'not_started', 'transcoded').
 */
export const IN_PROGRESS_TRANSCODING_STATUSES = [
	'queued',
	'downloading',
	'downloaded',
	'transcoding',
];

/**
 * Distinct file extensions, without the leading dot.
 */
export const SUPPORTED_DOCUMENT_EXTENSIONS = [
	...new Set( Object.values( SUPPORTED_DOCUMENT_TYPES ) ),
];

/**
 * Value for the file input's `accept` attribute.
 *
 * Extensions rather than MIME types: browsers are inconsistent about the MIME they report
 * for Office files (a .docx often arrives as application/zip or application/octet-stream),
 * and an accept list of MIME types alone hides those files in the OS picker.
 */
export const DOCUMENT_ACCEPT = SUPPORTED_DOCUMENT_EXTENSIONS.map(
	( extension ) => `.${ extension }`,
).join( ',' );

/**
 * Whether a media object selected in the editor is a format the block can display.
 *
 * The MIME type is authoritative when present. Uploads in flight and some library
 * selections have no MIME yet, so the extension is the fallback — the same order of
 * preference as godam_is_supported_document() on the server.
 *
 * @param {Object} media Media object from MediaUpload / MediaReplaceFlow.
 * @return {boolean} True when the format is supported.
 */
export function isSupportedDocument( media ) {
	if ( ! media ) {
		return false;
	}

	// Library selections expose `mime`, uploads expose `mime_type`. `media.type` is the
	// REST post type ("attachment") for uploads, so it must not be consulted here.
	const mime = media.mime || media.mime_type || '';

	if ( mime ) {
		return Object.prototype.hasOwnProperty.call( SUPPORTED_DOCUMENT_TYPES, mime );
	}

	return isSupportedDocumentUrl( media.url || '' );
}

/**
 * Whether a URL points at a format the block can display, judged by extension alone.
 *
 * @param {string} url Document URL.
 * @return {boolean} True when the extension is supported.
 */
export function isSupportedDocumentUrl( url ) {
	if ( ! url || typeof url !== 'string' ) {
		return false;
	}

	// Strip the query string / fragment before reading the extension.
	const path = url.split( /[?#]/ )[ 0 ];
	const extension = path.split( '.' ).pop().toLowerCase();

	return SUPPORTED_DOCUMENT_EXTENSIONS.includes( extension );
}
