/**
 * Internal dependencies
 */
import { sanitizePreviewMarkup } from './sanitizeMarkup';

describe( 'sanitizePreviewMarkup', () => {
	it( 'keeps form controls, labels, classes, data attributes and styles', () => {
		const markup = '<form class="f" action="/submit?x=1#y" method="post"><label for="a">A</label><input id="a" type="text" name="a" placeholder="p" data-x="1"><select name="s"><option value="1">One</option></select><textarea name="t"></textarea><button type="submit" style="color: red;">Go</button></form>';

		expect( sanitizePreviewMarkup( markup ) ).toBe( markup );
	} );

	it( 'keeps links, including ones that open in a new tab', () => {
		const markup = '<a href="https://example.com/a" target="_blank" rel="noopener">A</a><a href="mailto:hi@example.com">B</a><a href="#top">C</a>';

		expect( sanitizePreviewMarkup( markup ) ).toBe( markup );
	} );

	it( 'keeps a leading style block', () => {
		expect( sanitizePreviewMarkup( '<style>.x{color:red}</style><div class="x">Hi</div>' ) )
			.toBe( '<style>.x{color:red}</style><div class="x">Hi</div>' );
	} );

	it( 'removes scripts, frames, event handlers and script URLs', () => {
		const out = sanitizePreviewMarkup(
			'<img src="x" onerror="alert(1)"><script>alert(2)</script><iframe src="https://example.com/"></iframe>' +
			'<a href="javascript:alert(3)">link</a><form action="javascript:alert(4)"></form><div onclick="alert(5)">text</div>',
		);

		expect( out ).toBe( '<img src="x"><a>link</a><form></form><div>text</div>' );
	} );

	it( 'removes data: and vbscript: links', () => {
		const out = sanitizePreviewMarkup( '<a href="data:text/html,<script>alert(1)</script>">a</a><a href="vbscript:msgbox(1)">b</a>' );

		expect( out ).toBe( '<a>a</a><a>b</a>' );
	} );

	it.each( [
		[ 'undefined', undefined ],
		[ 'null', null ],
		[ 'an empty string', '' ],
		[ 'a number', 5 ],
		[ 'an object', { html: '<p>x</p>' } ],
	] )( 'returns an empty string for %s', ( name, value ) => {
		expect( sanitizePreviewMarkup( value ) ).toBe( '' );
	} );
} );
