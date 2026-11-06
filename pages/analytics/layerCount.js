/**
 * Count the saved interactive layers on a `/wp/v2/media/{id}` response.
 *
 * `rtgodam_meta` is a top-level REST field (see `register_rest_field` in
 * class-meta-rest-fields.php), not part of `meta`. It is `null` for users who
 * can't edit the attachment, which counts as zero layers.
 *
 * @param {?Object} attachment Media REST response.
 * @return {number} Number of saved layers.
 */
export function getLayerCount( attachment ) {
	const layers = attachment?.rtgodam_meta?.layers;
	return Array.isArray( layers ) ? layers.length : 0;
}
