/**
 * Internal dependencies
 */
import { getSafeLinkUrl } from './safe-url';

describe( 'getSafeLinkUrl', () => {
	it.each( [
		[ 'an http link', 'http://example.com/a?b=1&c=2#d' ],
		[ 'an https link', 'https://example.com/path/' ],
		[ 'an upper-case scheme', 'HTTPS://example.com/' ],
		[ 'a mailto link', 'mailto:hello@example.com?subject=Hi' ],
		[ 'a protocol-relative link', '//example.com/a' ],
		[ 'a root-relative link', '/shop/' ],
		[ 'a page-relative link', 'shop/item' ],
		[ 'a hash link', '#section' ],
	] )( 'returns %s unchanged', ( name, link ) => {
		expect( getSafeLinkUrl( link ) ).toBe( link );
	} );

	it( 'trims surrounding whitespace', () => {
		expect( getSafeLinkUrl( '  https://example.com/  ' ) ).toBe( 'https://example.com/' );
	} );

	it.each( [
		[ 'javascript:', 'javascript:alert(1)' ],
		[ 'javascript: in mixed case', 'JaVaScRiPt:alert(1)' ],
		[ 'javascript: after spaces', '   javascript:alert(1)' ],
		[ 'javascript: after a control character', '\u0001javascript:alert(1)' ],
		[ 'javascript: split by a tab', 'java\tscript:alert(1)' ],
		[ 'javascript: split by a newline', 'java\nscript:alert(1)' ],
		[ 'data:', 'data:text/html,<script>alert(1)</script>' ],
		[ 'vbscript:', 'vbscript:msgbox(1)' ],
		[ 'file:', 'file:///etc/passwd' ],
		[ 'blob:', 'blob:https://example.com/1234' ],
		[ 'ftp:', 'ftp://example.com/file' ],
		[ 'tel:', 'tel:+15555550100' ],
		[ 'a link that cannot be parsed', 'http://' ],
	] )( 'returns an empty string for %s', ( name, link ) => {
		expect( getSafeLinkUrl( link ) ).toBe( '' );
	} );

	it.each( [
		[ 'undefined', undefined ],
		[ 'null', null ],
		[ 'an empty string', '' ],
		[ 'a blank string', '   ' ],
		[ 'a number', 42 ],
		[ 'an object', { href: 'https://example.com/' } ],
		[ 'an array', [ 'https://example.com/' ] ],
	] )( 'returns an empty string for %s', ( name, value ) => {
		expect( getSafeLinkUrl( value ) ).toBe( '' );
	} );
} );
