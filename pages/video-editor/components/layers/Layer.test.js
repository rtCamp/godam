/**
 * Layer API contract tests (#2291): which settings panel opens for a layer.
 *
 * Core types map to their own editors. An add-on type opens when PHP lists it in
 * `godamVideoEditorConfig.layerComponents` and the add-on's script put the named
 * component on `window.godamLayerComponents`. Since #2292 the panel comes from
 * the layer registry, and a layer whose type has no panel gets a "needs an
 * add-on" notice instead of the CTA editor (RFC D2).
 */

/**
 * Internal dependencies
 */
import '../../../../tests/js/mock-form-provider-panels';

/**
 * External dependencies
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import Layer from './Layer';
import { registerCoreLayerTypes } from '../../layers/core';

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
jest.mock( '../../utils/formUtils', () => ( { getFormIdFromLayer: () => null } ) );

// The real slice reads page globals at import time; only the action shapes matter here.
jest.mock( '../../redux/slice/videoSlice', () => ( {
	removeLayer: ( payload ) => ( { type: 'removeLayer', payload } ),
	updateLayerField: ( payload ) => ( { type: 'updateLayerField', payload } ),
} ) );

registerCoreLayerTypes();

describe( 'Layer API contract: Layer editor dispatch', () => {
	let container, root, dispatched;

	const render = ( layer, props = {} ) => {
		const store = configureStore( {
			reducer: {
				videoReducer: ( state = { layers: [ layer ] }, action ) => {
					dispatched.push( action );
					return state;
				},
			},
		} );
		act( () => {
			root.render(
				<Provider store={ store }>
					<Layer layer={ layer } goBack={ props.goBack ?? ( () => {} ) } duration={ 90 } />
				</Provider>,
			);
		} );
	};
	const editor = () => container.querySelector( '[data-editor]' )?.dataset.editor;
	const notice = () => container.querySelector( '[data-test-id="godam-video-editor-unregistered-layer"]' );

	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
		dispatched = [];
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
		expect( console ).toHaveWarnedWith( 'GoDAM: window.godamLayerComponents is deprecated since version 2.7.0 and will be removed in version 2.9.0. Use the `edit` setting of registerLayerType() instead.' );
	} );

	it( 'lets an add-on replace a core editor by listing the same type', () => {
		window.godamVideoEditorConfig.layerComponents = { cta: 'BetterCta' };
		window.godamLayerComponents = { BetterCta: () => <div data-editor="better-cta" /> };
		render( { id: 'l3', type: 'cta' } );
		expect( editor() ).toBe( 'better-cta' );
	} );

	it( 'shows the "needs an add-on" notice when PHP lists a type whose component never loaded', () => {
		window.godamVideoEditorConfig.layerComponents = { acme: 'AcmeLayer' };
		render( { id: 'l4', type: 'acme' } );
		expect( editor() ).toBeUndefined();
		expect( notice() ).not.toBeNull();
	} );

	it( 'shows the "needs an add-on" notice for an unregistered type, never another type\'s editor', () => {
		render( { id: 'l5', type: 'ghost' } );
		expect( editor() ).toBeUndefined();
		expect( notice().textContent ).toContain( 'ghost' );
	} );

	it( 'lets the notice delete the layer and go back', () => {
		const goBack = jest.fn();
		render( { id: 'l6', type: 'ghost' }, { goBack } );

		act( () => [ ...notice().querySelectorAll( 'button' ) ].find( ( b ) => b.textContent === 'Delete layer' ).click() );

		expect( dispatched ).toContainEqual( { type: 'removeLayer', payload: { id: 'l6' } } );
		expect( goBack ).toHaveBeenCalled();
	} );

	it( 'shows the error notice, not a blank editor, when an add-on editor throws', () => {
		const consoleError = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
		window.godamVideoEditorConfig.layerComponents = { acme: 'AcmeLayer' };
		window.godamLayerComponents = {
			AcmeLayer: () => {
				throw new Error( 'boom' );
			},
		};

		render( { id: 'l7', type: 'acme' } );

		expect( container.querySelector( '.godam-layer-error[role="alert"]' ) ).not.toBeNull();
		consoleError.mockRestore();
	} );
} );
