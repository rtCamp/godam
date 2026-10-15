/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * GoDAM helpdesk, where a site owner opens or follows a support ticket.
 *
 * Every admin-facing error message links here: React screens through
 * ContactSupportLink, hand-built DOM through createSupportLink(). PHP uses
 * rtgodam_get_support_url().
 *
 * @type {string}
 */
export const SUPPORT_URL = 'https://app.godam.io/helpdesk/my-tickets';

/**
 * "Contact Support" link for screens that build their DOM by hand (the WP
 * Dashboard widget, the media library), where the React ContactSupportLink
 * can't be used.
 *
 * @param {string} testId data-test-id for the link.
 * @return {HTMLAnchorElement} The link, opening the GoDAM helpdesk in a new tab.
 */
export const createSupportLink = ( testId ) => {
	const link = document.createElement( 'a' );
	link.className = 'godam-contact-support godam-contact-support--link';
	link.href = SUPPORT_URL;
	link.target = '_blank';
	link.rel = 'noopener noreferrer';
	link.setAttribute( 'data-test-id', testId );
	link.textContent = __( 'Contact Support', 'godam' );

	const hint = document.createElement( 'span' );
	hint.className = 'screen-reader-text';
	hint.textContent = ` ${ __( '(opens in a new tab)', 'godam' ) }`;
	link.append( hint );

	return link;
};
