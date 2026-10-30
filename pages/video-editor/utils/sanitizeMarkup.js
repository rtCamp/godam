/**
 * External dependencies
 */
import DOMPurify from 'isomorphic-dompurify';

/**
 * What a form or poll preview needs on top of DOMPurify's defaults, which already
 * keep form controls, labels, classes, `data-*` and `style`, and drop scripts, event
 * handler attributes, frames and script URLs.
 */
const PREVIEW_MARKUP_CONFIG = {
	// Keeps a leading `<style>` block, which the parser would otherwise file under
	// `<head>` and discard.
	FORCE_BODY: true,
	// Lets a link in the markup open in a new tab, rather than replacing the editor.
	ADD_ATTR: [ 'target' ],
};

/**
 * Make the markup a form plugin or poll returns safe to show in a preview.
 *
 * @since n.e.x.t
 *
 * @param {*} markup Markup fetched for the preview.
 * @return {string} The markup without scripts, event handlers or script URLs; '' when there is none.
 */
export function sanitizePreviewMarkup( markup ) {
	if ( 'string' !== typeof markup || '' === markup ) {
		return '';
	}

	return DOMPurify.sanitize( markup, PREVIEW_MARKUP_CONFIG );
}
