/**
 * Layer API (#2293): the Form layer opens its form provider's panel.
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
import { registerLayerVariation } from '@godam/layers';

/**
 * Internal dependencies
 */
import FormLayer from './FormLayer';
import { registerEditorLayerTypes } from '../../layers';

jest.mock( './CTALayer', () => () => null );
jest.mock( './HotspotLayer', () => () => null );
jest.mock( './PollLayer', () => () => null );
jest.mock( './AdsLayer', () => () => null );
jest.mock( './LayersHeader.js', () => () => null );
jest.mock( '../shared/color-picker/ColorPickerButton.jsx', () => () => null );
jest.mock( '../forms/FormProviderPanel', () => ( props ) =>
	require( 'react' ).createElement( 'div', { 'data-form-panel': `shared:${ props.provider.name }` } ),
);
jest.mock( '../controls', () => {
	const { createElement: h, Fragment } = require( 'react' );
	return {
		VeSection: ( { children } ) => h( Fragment, null, children ),
		VeColorList: ( { children } ) => h( Fragment, null, children ),
		VeToggle: ( { disabled } ) => h( 'input', { type: 'checkbox', 'data-test-id': 'allow-skip', disabled } ),
	};
} );
jest.mock( '../../redux/slice/videoSlice', () => ( {
	updateLayerField: ( payload ) => ( { type: 'updateLayerField', payload } ),
} ) );

window.videoData = { wpformsActive: true };
window.godamVideoEditorConfig = {};
registerEditorLayerTypes();
registerLayerVariation( 'form', { name: 'acme-forms', title: 'Acme Forms', idField: 'acme_form_id' } );

describe( 'Layer API: FormLayer panel', () => {
	let container, root;

	const render = ( layer ) => {
		const store = configureStore( { reducer: { videoReducer: ( state = { layers: [ layer ] } ) => state } } );
		act( () => {
			root.render(
				<Provider store={ store }>
					<FormLayer layerID={ layer.id } goBack={ () => {} } duration={ 60 } />
				</Provider>,
			);
		} );
	};
	const panel = () => container.querySelector( '[data-form-panel]' )?.dataset.formPanel;
	const allowSkip = () => container.querySelector( '[data-test-id="allow-skip"]' );

	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement( 'div' );
		root = createRoot( container );
	} );

	afterEach( () => act( () => root.unmount() ) );

	it( 'opens the layer\'s form provider panel', () => {
		render( { id: 'l1', type: 'form', form_type: 'wpforms' } );
		expect( panel() ).toBe( 'wpforms' );
		expect( allowSkip().disabled ).toBe( false );
	} );

	it( 'opens Gravity Forms for an older layer with no form_type', () => {
		render( { id: 'l1', type: 'form' } );
		expect( panel() ).toBe( 'gravity' );
	} );

	it( 'disables the shared settings when the provider\'s plugin is inactive', () => {
		render( { id: 'l1', type: 'form', form_type: 'cf7' } );
		expect( panel() ).toBe( 'cf7' );
		expect( allowSkip().disabled ).toBe( true );
	} );

	it( 'opens the shared panel for an add-on provider without its own', () => {
		render( { id: 'l1', type: 'form', form_type: 'acme-forms' } );
		expect( panel() ).toBe( 'shared:acme-forms' );
	} );

	it( 'warns when nothing provides the layer\'s form', () => {
		render( { id: 'l1', type: 'form', form_type: 'mystery' } );
		expect( panel() ).toBeUndefined();
		expect( container.textContent ).toContain( 'This layer uses the "mystery" form, which isn\'t available.' );
		expect( allowSkip().disabled ).toBe( true );
	} );
} );
