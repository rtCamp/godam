/**
 * Unit tests for the layer editor error boundary.
 *
 * When a layer editor (often one from an add-on) throws while rendering, the
 * boundary shows a fallback. That is a real failure, so the fallback carries a
 * Contact Support link next to the "Back to layers" button.
 */

/**
 * External dependencies
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Internal dependencies
 */
import LayerErrorBoundary from './LayerErrorBoundary';

const Broken = () => {
	throw new Error( 'layer editor exploded' );
};

describe( 'LayerErrorBoundary', () => {
	let root, container, consoleError;

	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
		// React and the boundary both log the caught error; keep the test output clean.
		consoleError = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
		container = document.createElement( 'div' );
		root = createRoot( container );
	} );

	afterEach( () => {
		act( () => root.unmount() );
		consoleError.mockRestore();
	} );

	it( 'shows the fallback with a Contact Support link when a layer throws', () => {
		act( () => {
			root.render( <LayerErrorBoundary resetKey="L1" goBack={ () => {} }><Broken /></LayerErrorBoundary> );
		} );

		expect( container.textContent ).toContain( 'This layer could not be opened.' );

		const link = container.querySelector( '[data-test-id="godam-video-editor-layer-link-contact-support"]' );
		expect( link ).not.toBeNull();
		expect( link.getAttribute( 'target' ) ).toBe( '_blank' );
		expect( container.textContent ).toContain( 'Back to layers' );
	} );

	it( 'renders the layer and no link when nothing throws', () => {
		act( () => {
			root.render( <LayerErrorBoundary resetKey="L1"><p>fine</p></LayerErrorBoundary> );
		} );

		expect( container.textContent ).toBe( 'fine' );
		expect( container.querySelector( 'a' ) ).toBeNull();
	} );
} );
