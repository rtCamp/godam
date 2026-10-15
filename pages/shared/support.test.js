/**
 * Unit tests for createSupportLink, the Contact Support link added to error
 * messages on screens that build their DOM by hand.
 */

/**
 * Internal dependencies
 */
import { createSupportLink, SUPPORT_URL } from './support';

describe( 'createSupportLink', () => {
	it( 'opens the helpdesk in a new tab without leaking the opener', () => {
		const link = createSupportLink( 'godam-media-library-link-contact-support' );

		expect( link.tagName ).toBe( 'A' );
		expect( link.href ).toBe( SUPPORT_URL );
		expect( link.target ).toBe( '_blank' );
		expect( link.rel ).toBe( 'noopener noreferrer' );
		expect( link.className ).toBe( 'godam-contact-support godam-contact-support--link' );
		expect( link.getAttribute( 'data-test-id' ) ).toBe( 'godam-media-library-link-contact-support' );
	} );

	it( 'reads "Contact Support" and tells screen readers it opens a new tab', () => {
		const link = createSupportLink( 'godam-dashboard-widget-link-contact-support' );

		expect( link.firstChild.textContent ).toBe( 'Contact Support' );
		expect( link.querySelector( '.screen-reader-text' ).textContent ).toBe( ' (opens in a new tab)' );
	} );
} );
