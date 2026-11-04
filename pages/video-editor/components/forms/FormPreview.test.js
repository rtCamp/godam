/**
 * Unit tests for FormPreview: the form markup a plugin returns is shown as the
 * form it describes, without anything that would run script in the editor.
 */

/**
 * External dependencies
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Internal dependencies
 */
import FormPreview from './FormPreview';

const FORM = `
<div class="wpcf7 no-js" id="wpcf7-f1-o1" data-wpcf7-id="1">
	<form action="/wp-json/godam/v1/cf7-form?id=1#wpcf7-f1-o1" method="post" class="wpcf7-form init" novalidate="novalidate">
		<fieldset class="hidden-fields-container"><input type="hidden" name="_wpcf7" value="1"></fieldset>
		<p><label>Your name<br><input type="text" name="your-name" class="wpcf7-text" placeholder="Jane" aria-required="true"></label></p>
		<p><select name="topic"><option value="a">A</option></select><textarea name="msg" rows="4"></textarea></p>
		<p style="display: none;"><input type="radio" name="r" value="1"> <label for="r">Yes</label></p>
		<p><a href="https://example.com/terms" target="_blank" rel="noopener">Terms</a> <a href="mailto:hello@example.com">Mail</a></p>
		<input type="submit" value="Send" class="wpcf7-submit">
	</form>
</div>`;

const HOSTILE = `
<img src="x" onerror="window.__ran = 1">
<script>window.__ran = 2;</script>
<a href="javascript:window.__ran = 3" id="evil-link">Click</a>
<form action="javascript:window.__ran = 4"><input type="text" onfocus="window.__ran = 5" autofocus></form>
<div onmouseover="window.__ran = 6" class="kept">Hover</div>
<svg onload="window.__ran = 7"></svg>
<iframe src="https://example.com/"></iframe>`;

/**
 * Render FormPreview into the layer placeholder the editor provides.
 *
 * @param {Object} props FormPreview props.
 * @return {Object} The placeholder element and an unmount callback.
 */
const renderPreview = ( props ) => {
	const placeholder = document.createElement( 'div' );
	placeholder.id = 'easydam-layer-placeholder';
	document.body.appendChild( placeholder );
	const container = document.createElement( 'div' );
	document.body.appendChild( container );
	const root = createRoot( container );

	act( () => {
		root.render( <FormPreview { ...props } /> );
	} );

	return {
		placeholder,
		unmount: () => {
			act( () => root.unmount() );
			placeholder.remove();
			container.remove();
		},
	};
};

describe( 'FormPreview', () => {
	let rendered;

	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
		window.__ran = 0;
	} );

	afterEach( () => {
		rendered?.unmount();
		rendered = null;
	} );

	it( 'renders a form plugin’s markup as the form it describes', () => {
		rendered = renderPreview( { html: FORM, containerClassName: 'rtgodam-wpcf7-form' } );
		const { placeholder } = rendered;

		const body = placeholder.querySelector( '.form-container.rtgodam-wpcf7-form' );
		expect( body ).not.toBeNull();
		expect( body.querySelector( 'form.wpcf7-form' ).getAttribute( 'action' ) ).toBe( '/wp-json/godam/v1/cf7-form?id=1#wpcf7-f1-o1' );
		expect( body.querySelector( 'input[name="your-name"]' ).getAttribute( 'placeholder' ) ).toBe( 'Jane' );
		expect( body.querySelector( 'input[name="_wpcf7"]' ).getAttribute( 'type' ) ).toBe( 'hidden' );
		expect( body.querySelector( 'select[name="topic"] option' ).textContent ).toBe( 'A' );
		expect( body.querySelector( 'textarea[name="msg"]' ) ).not.toBeNull();
		expect( body.querySelector( 'label[for="r"]' ).textContent ).toBe( 'Yes' );
		expect( body.querySelector( 'input[type="submit"]' ).getAttribute( 'value' ) ).toBe( 'Send' );
		expect( body.querySelector( 'p[style]' ).getAttribute( 'style' ) ).toBe( 'display: none;' );
		expect( body.querySelector( '[data-wpcf7-id="1"]' ) ).not.toBeNull();
	} );

	it( 'keeps links to normal destinations, opening in a new tab where the markup says so', () => {
		rendered = renderPreview( { html: FORM } );
		const links = rendered.placeholder.querySelectorAll( '.form-container a' );

		expect( links ).toHaveLength( 2 );
		expect( links[ 0 ].getAttribute( 'href' ) ).toBe( 'https://example.com/terms' );
		expect( links[ 0 ].getAttribute( 'target' ) ).toBe( '_blank' );
		expect( links[ 1 ].getAttribute( 'href' ) ).toBe( 'mailto:hello@example.com' );
	} );

	it( 'keeps a leading style block', () => {
		rendered = renderPreview( { html: '<style>.x{color:red}</style><div class="x">Hi</div>' } );

		expect( rendered.placeholder.querySelector( '.form-container style' ).textContent ).toBe( '.x{color:red}' );
	} );

	it( 'drops scripts, event handlers and script URLs from the markup', () => {
		rendered = renderPreview( { html: HOSTILE } );
		const body = rendered.placeholder.querySelector( '.form-container' );

		expect( body.querySelector( 'script' ) ).toBeNull();
		expect( body.querySelector( 'iframe' ) ).toBeNull();
		expect( body.querySelector( '[onerror], [onfocus], [onmouseover], [onload]' ) ).toBeNull();
		expect( body.querySelector( '#evil-link' ).hasAttribute( 'href' ) ).toBe( false );
		expect( body.querySelector( 'form' ).hasAttribute( 'action' ) ).toBe( false );
		// The harmless parts of the same markup are still there.
		expect( body.querySelector( '#evil-link' ).textContent ).toBe( 'Click' );
		expect( body.querySelector( '.kept' ).textContent ).toBe( 'Hover' );
		expect( window.__ran ).toBe( 0 );
	} );

	it( 'shows the loading and error states instead of the markup', () => {
		rendered = renderPreview( { html: FORM, isFetching: true } );
		expect( rendered.placeholder.textContent ).toContain( 'Loading form…' );
		expect( rendered.placeholder.querySelector( 'form' ) ).toBeNull();
		rendered.unmount();

		rendered = renderPreview( { html: FORM, error: 'No such form' } );
		expect( rendered.placeholder.textContent ).toContain( 'No such form' );
		expect( rendered.placeholder.querySelector( 'form' ) ).toBeNull();
	} );

	it( 'renders nothing in the body when there is no markup', () => {
		rendered = renderPreview( { html: '' } );

		expect( rendered.placeholder.querySelector( '.form-container' ) ).toBeNull();
	} );

	it( 'renders custom children in place of the markup', () => {
		rendered = renderPreview( { html: FORM, children: <p className="custom">Custom</p> } );

		expect( rendered.placeholder.querySelector( '.custom' ).textContent ).toBe( 'Custom' );
		expect( rendered.placeholder.querySelector( 'form' ) ).toBeNull();
	} );
} );
