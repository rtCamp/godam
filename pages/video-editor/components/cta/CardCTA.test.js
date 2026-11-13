/**
 * Unit tests for the CTA layer's saved image in the Media Editor.
 *
 * Opening a CTA layer loads its image from core's `wp/v2/media` route. Only a
 * missing attachment (404 / `rest_post_invalid_id`) may clear the image from the
 * layer; any other failure (a server error, a firewall block, an expired nonce)
 * must keep it, or saving another edit would lose the image.
 */

/**
 * External dependencies
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import CardCTA, { isMediaGone } from './CardCTA';

jest.mock( '@wordpress/api-fetch', () => jest.fn() );

// The real slice reads page globals at import time; only the action shape matters here.
jest.mock( '../../redux/slice/videoSlice', () => ( {
	updateLayerField: ( payload ) => ( { type: 'updateLayerField', payload } ),
} ) );
jest.mock( '../../onboarding/productGuide', () => ( { isActive: () => false, suspend: jest.fn(), resume: jest.fn() } ) );
jest.mock( '../shared/color-picker/ColorPickerButton.jsx', () => () => null );
jest.mock( '../controls', () => {
	const { createElement: h, Fragment } = require( 'react' );
	const passthrough = ( { children } ) => h( Fragment, null, children );
	return {
		VeSection: passthrough,
		VeField: passthrough,
		VeCollapsible: passthrough,
		VeTextInput: () => null,
		VeTextarea: () => null,
		VeLayoutGrid: () => null,
		VeSlider: () => null,
		VeColorList: () => null,
	};
} );
jest.mock( '@wordpress/components', () => {
	const { createElement: h, Fragment } = require( 'react' );
	return {
		Button: ( { children } ) => h( 'button', { type: 'button' }, children ),
		Notice: ( { children } ) => h( 'div', null, children ),
		Tooltip: ( { children } ) => h( Fragment, null, children ),
	};
} );

const renderWithImage = async () => {
	const actions = [];
	const layer = { id: 'cta-1', type: 'cta', cta_type: 'image', image: 52, cardLayout: 'card-layout--imagecover-text' };
	const store = configureStore( {
		reducer: ( state = { videoReducer: { layers: [ layer ] } }, action ) => {
			actions.push( action );
			return state;
		},
	} );
	const container = document.createElement( 'div' );
	document.body.appendChild( container );
	const root = createRoot( container );
	await act( async () => {
		root.render( <Provider store={ store }><CardCTA layerID="cta-1" /></Provider> );
	} );
	// Let the rejected request settle.
	await act( async () => {
		await new Promise( ( resolve ) => setTimeout( resolve, 0 ) );
	} );
	act( () => root.unmount() );
	container.remove();
	return actions.filter( ( action ) => 'updateLayerField' === action.type && 'image' === action.payload.field );
};

describe( 'CardCTA saved image', () => {
	beforeAll( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
	} );

	beforeEach( () => {
		apiFetch.mockReset();
	} );

	it( 'loads the image through apiFetch', async () => {
		apiFetch.mockResolvedValue( { source_url: 'https://example.test/cta.png', title: { rendered: 'cta' }, media_details: {} } );

		const cleared = await renderWithImage();

		expect( apiFetch ).toHaveBeenCalledWith( { path: '/wp/v2/media/52' } );
		expect( cleared ).toEqual( [] );
	} );

	it( 'clears the image when the attachment is gone', async () => {
		apiFetch.mockRejectedValue( { code: 'rest_post_invalid_id', data: { status: 404 } } );

		const cleared = await renderWithImage();

		expect( cleared ).toEqual( [ { type: 'updateLayerField', payload: { id: 'cta-1', field: 'image', value: 0 } } ] );
	} );

	it.each( [
		[ 'an expired nonce', { code: 'rest_cookie_invalid_nonce', data: { status: 403 } } ],
		[ 'a logged-out answer', { code: 'rest_not_logged_in', data: { status: 401 } } ],
		[ 'a server error', { code: 'internal_server_error', data: { status: 500 } } ],
		[ 'a network failure', { code: 'fetch_error', message: 'You are probably offline.' } ],
	] )( 'keeps the image after %s', async ( label, error ) => {
		apiFetch.mockRejectedValue( error );

		expect( await renderWithImage() ).toEqual( [] );
	} );
} );

describe( 'isMediaGone', () => {
	it( 'is true only for a missing attachment', () => {
		expect( isMediaGone( { code: 'rest_post_invalid_id' } ) ).toBe( true );
		expect( isMediaGone( { data: { status: 404 } } ) ).toBe( true );
		expect( isMediaGone( { code: 'rest_cookie_invalid_nonce', data: { status: 403 } } ) ).toBe( false );
		expect( isMediaGone( undefined ) ).toBe( false );
	} );
} );
