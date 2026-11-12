/**
 * The admin pages' `react/jsx-runtime` must behave like React's own: static
 * children need no keys, a dynamic list still does, and key, ref and children
 * reach the element.
 */

/**
 * External dependencies
 */
import { createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';

/**
 * Internal dependencies
 */
import { jsx, jsxs, Fragment } from './jsx-runtime';

global.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Render in jsdom the way the admin pages do, and return the markup.
 *
 * @param {Object} element React element.
 * @return {string} Rendered HTML.
 */
const renderToStaticMarkup = ( element ) => {
	const container = document.createElement( 'div' );
	const root = createRoot( container );
	act( () => root.render( element ) );
	const html = container.innerHTML;
	act( () => root.unmount() );
	return html;
};

describe( 'pages/jsx-runtime', () => {
	let errors;

	beforeEach( () => {
		errors = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
	} );

	afterEach( () => {
		errors.mockRestore();
	} );

	const keyWarnings = () => errors.mock.calls.filter( ( call ) => String( call[ 0 ] ).includes( 'unique "key" prop' ) );

	it( 'renders static children (jsxs) without key warnings', () => {
		const html = renderToStaticMarkup(
			jsxs( 'div', { children: [ jsx( 'span', { children: 'a' } ), jsx( 'b', { children: 'b' } ) ] } ),
		);

		expect( html ).toBe( '<div><span>a</span><b>b</b></div>' );
		expect( keyWarnings() ).toHaveLength( 0 );
	} );

	it( 'still warns for a dynamic list without keys (jsx with an array child)', () => {
		renderToStaticMarkup( jsx( 'ul', { children: [ jsx( 'li', {} ), jsx( 'li', {} ) ] } ) );

		expect( keyWarnings().length ).toBeGreaterThan( 0 );
	} );

	it( 'passes the key given separately, and refs and single children', () => {
		const ref = createRef();
		const element = jsx( 'input', { ref, defaultValue: 'x' }, 'k1' );

		expect( element.key ).toBe( 'k1' );
		expect( element.ref ).toBe( ref );
		expect( jsx( 'p', { children: 'hi' } ).props.children ).toBe( 'hi' );
		expect( renderToStaticMarkup( jsx( Fragment, { children: 'f' } ) ) ).toBe( 'f' );
	} );
} );
