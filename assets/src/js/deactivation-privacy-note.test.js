/**
 * Internal dependencies
 */
import { getPrivacyNoteMarkup } from './deactivation-privacy-note';

const PRIVACY_URL = 'https://godam.io/privacy-policy/';

const renderNote = () => {
	document.body.innerHTML = getPrivacyNoteMarkup( PRIVACY_URL );
	return document.querySelector( '.rt-godam-modal__privacy-note' );
};

describe( 'deactivation modal privacy note', () => {
	afterEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'says what Submit & Deactivate sends and why', () => {
		const text = renderNote().textContent;

		expect( text ).toContain( 'Submit & Deactivate sends your site URL, the reason you pick, your comment, and your username and email to godam.io' );
		expect( text ).toContain( 'so the GoDAM team can reply to you' );
	} );

	it( 'says Skip & Deactivate sends nothing', () => {
		expect( renderNote().textContent ).toContain( 'Skip & Deactivate sends nothing' );
	} );

	it( 'links the GoDAM privacy policy safely in a new tab', () => {
		const link = renderNote().querySelector( 'a' );

		expect( link.getAttribute( 'href' ) ).toBe( PRIVACY_URL );
		expect( link.textContent ).toBe( 'Privacy Policy' );
		expect( link.getAttribute( 'target' ) ).toBe( '_blank' );
		expect( link.getAttribute( 'rel' ) ).toBe( 'noopener noreferrer' );
	} );
} );
