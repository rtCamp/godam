/**
 * Layer API contract tests (#2291): which settings panel opens for a layer.
 *
 * Core types map to their own editors. An add-on type opens when PHP lists it in
 * `godamVideoEditorConfig.layerComponents` and the add-on's script put the named
 * component on `window.godamLayerComponents`. Tests marked "current behaviour"
 * pin something #2292 intends to change on purpose.
 */

/**
 * External dependencies
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Internal dependencies
 */
import Layer from './Layer';

// A function declaration, so it is hoisted along with the jest.mock() calls.
function mockEditor( name ) {
	return {
		__esModule: true,
		default: ( props ) => require( 'react' ).createElement( 'div', { 'data-editor': name, 'data-layer-id': props.layerID } ),
	};
}

jest.mock( './FormLayer', () => mockEditor( 'form' ) );
jest.mock( './CTALayer', () => mockEditor( 'cta' ) );
jest.mock( './HotspotLayer', () => mockEditor( 'hotspot' ) );
jest.mock( './AdsLayer', () => mockEditor( 'ad' ) );
jest.mock( './PollLayer', () => mockEditor( 'poll' ) );

describe( 'Layer API contract: Layer editor dispatch', () => {
	let container, root;

	const render = ( layer, props = {} ) => {
		act( () => {
			root.render( <Layer layer={ layer } goBack={ props.goBack ?? ( () => {} ) } duration={ 90 } /> );
		} );
	};
	const editor = () => container.querySelector( '[data-editor]' )?.dataset.editor;

	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
		window.godamVideoEditorConfig = { layerComponents: {} };
		window.godamLayerComponents = {};
	} );

	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
	} );

	it.each( [ 'form', 'cta', 'hotspot', 'ad', 'poll' ] )( 'opens the core %s editor', ( type ) => {
		render( { id: 'l1', type } );
		expect( editor() ).toBe( type );
		expect( container.querySelector( '[data-layer-id]' ).dataset.layerId ).toBe( 'l1' );
	} );

	it( 'opens an add-on editor and passes it layerID, goBack and duration', () => {
		const AcmeLayer = jest.fn( () => <div data-editor="acme" /> );
		const goBack = jest.fn();
		window.godamVideoEditorConfig.layerComponents = { acme: 'AcmeLayer' };
		window.godamLayerComponents = { AcmeLayer };

		render( { id: 'l2', type: 'acme' }, { goBack } );

		expect( editor() ).toBe( 'acme' );
		expect( AcmeLayer.mock.calls[ 0 ][ 0 ] ).toEqual( { layerID: 'l2', goBack, duration: 90 } );
	} );

	it( 'lets an add-on replace a core editor by listing the same type', () => {
		window.godamVideoEditorConfig.layerComponents = { cta: 'BetterCta' };
		window.godamLayerComponents = { BetterCta: () => <div data-editor="better-cta" /> };
		render( { id: 'l3', type: 'cta' } );
		expect( editor() ).toBe( 'better-cta' );
	} );

	// Current behaviour: #2292 replaces this fallback with a "needs an add-on" notice.
	it( 'falls back to the CTA editor when PHP lists a type whose component never loaded', () => {
		window.godamVideoEditorConfig.layerComponents = { acme: 'AcmeLayer' };
		render( { id: 'l4', type: 'acme' } );
		expect( editor() ).toBe( 'cta' );
	} );

	// Current behaviour: #2292 replaces this fallback with a "needs an add-on" notice.
	it( 'falls back to the CTA editor for an unregistered type', () => {
		render( { id: 'l5', type: 'ghost' } );
		expect( editor() ).toBe( 'cta' );
	} );

	it( 'shows the error notice, not a blank editor, when an add-on editor throws', () => {
		const consoleError = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
		window.godamVideoEditorConfig.layerComponents = { acme: 'AcmeLayer' };
		window.godamLayerComponents = {
			AcmeLayer: () => {
				throw new Error( 'boom' );
			},
		};

		render( { id: 'l6', type: 'acme' } );

		expect( container.querySelector( '.godam-layer-error[role="alert"]' ) ).not.toBeNull();
		consoleError.mockRestore();
	} );
} );
