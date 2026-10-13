/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';

/**
 * Markup for the line in the deactivation modal that says what "Submit & Deactivate"
 * sends to godam.io and why, and that "Skip & Deactivate" sends nothing.
 *
 * @param {string} privacyUrl URL of the GoDAM privacy policy.
 * @return {string} HTML for the line.
 */
export const getPrivacyNoteMarkup = ( privacyUrl ) => {
	const note = sprintf(
		/* translators: 1: "Submit & Deactivate" button label, 2: "Skip & Deactivate" button label, 3: opening link tag to the GoDAM privacy policy, 4: closing link tag. */
		__( '%1$s sends your site URL, the reason you pick, your comment, and your name and email to godam.io, so the GoDAM team can reply to you. %2$s sends nothing. %3$sPrivacy Policy%4$s', 'godam' ),
		__( 'Submit & Deactivate', 'godam' ),
		__( 'Skip & Deactivate', 'godam' ),
		`<a href="${ privacyUrl }" target="_blank" rel="noopener noreferrer">`,
		'</a>',
	);

	return `<p class="rt-godam-modal__privacy-note">${ note }</p>`;
};
