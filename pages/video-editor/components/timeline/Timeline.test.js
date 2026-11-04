/**
 * Layer API (#2292): timeline markers come from the layer registry.
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
import { registerLayerType } from '@godam/layers';

/**
 * Internal dependencies
 */
import Timeline from './Timeline';
import { registerEditorLayerTypes } from '../../layers';

jest.mock( '../layers/CTALayer', () => () => null );
jest.mock( '../layers/HotspotLayer', () => () => null );
jest.mock( '../layers/FormLayer', () => () => null );
jest.mock( '../layers/PollLayer', () => () => null );
jest.mock( '../layers/AdsLayer', () => () => null );
jest.mock( '../../utils/formUtils', () => ( { getFormIdFromLayer: () => null } ) );
jest.mock( '../../onboarding/productGuide', () => ( { notify: jest.fn() } ) );
jest.mock( '../../redux/slice/videoSlice', () => ( {
	setCurrentLayer: ( payload ) => ( { type: 'setCurrentLayer', payload } ),
	setAddLayerModalTime: ( payload ) => ( { type: 'setAddLayerModalTime', payload } ),
	updateLayerField: ( payload ) => ( { type: 'updateLayerField', payload } ),
} ) );

window.godamVideoEditorConfig = {
	layerOptions: [ { type: 'woo', title: 'WooCommerce', layerText: 'WooCommerce', iconUrl: 'woo.svg' } ],
};
registerEditorLayerTypes();
registerLayerType( { name: 'acme/countdown', title: 'Countdown', color: '#123456', icon: 'https://example.com/clock.svg' } );
registerLayerType( { name: 'acme/hidden', title: 'Hidden', supports: { timeline: false } } );

describe( 'Layer API: timeline markers', () => {
	let container, root;

	const render = ( layers ) => {
		const store = configureStore( {
			reducer: {
				videoReducer: ( state = { layers, chapters: [], currentLayer: null, currentTab: 'layers' } ) => state,
			},
		} );
		act( () => {
			root.render(
				<Provider store={ store }>
					<Timeline currentTime={ 0 } duration={ 100 } onSeek={ () => {} } formatTimeForInput={ ( t ) => String( t ) } />
				</Provider>,
			);
		} );
	};
	const markers = () => [ ...container.querySelectorAll( '.godam-ve-timeline__marker' ) ];
	const label = ( marker ) => marker.querySelector( '.godam-ve-timeline__chip-label' ).textContent;

	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
	} );

	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
	} );

	it( 'labels each marker with its type title and colour', () => {
		render( [
			{ id: 'c', type: 'cta', displayTime: 10 },
			{ id: 'a', type: 'acme/countdown', displayTime: 20 },
		] );

		const [ cta, countdown ] = markers();
		expect( label( cta ) ).toBe( 'CTA · 0:10' );
		expect( cta.style.getPropertyValue( '--marker-color' ) ).toBe( '#3858e9' );
		expect( label( countdown ) ).toBe( 'Countdown · 0:20' );
		expect( countdown.style.getPropertyValue( '--marker-color' ) ).toBe( '#123456' );
		expect( countdown.querySelector( 'img' ).getAttribute( 'src' ) ).toBe( 'https://example.com/clock.svg' );
	} );

	it( 'shows a form layer\'s form plugin, Marketo and HubSpot included', () => {
		render( [
			{ id: 'f1', type: 'form', form_type: 'wpforms', displayTime: 5 },
			{ id: 'f2', type: 'form', form_type: 'marketo', displayTime: 15 },
		] );

		const [ wpforms, marketo ] = markers();
		expect( label( wpforms ) ).toBe( 'WPForms · 0:05' );
		expect( wpforms.classList.contains( 'godam-ve-timeline__marker--form' ) ).toBe( true );
		expect( label( marketo ) ).toBe( 'Marketo · 0:15' );
		expect( marketo.querySelector( 'img' ) ).not.toBeNull();
	} );

	it( 'uses a type\'s marker icon over its icon URL (the Woo cart)', () => {
		render( [ { id: 'w', type: 'woo', displayTime: 30 } ] );
		const [ woo ] = markers();
		expect( woo.querySelector( 'img' ) ).toBeNull();
		expect( woo.querySelector( 'svg circle' ) ).not.toBeNull();
	} );

	it( 'leaves out unregistered types and types that opt out of the timeline', () => {
		render( [
			{ id: 'c', type: 'cta', displayTime: 10 },
			{ id: 'g', type: 'ghost', displayTime: 20 },
			{ id: 'h', type: 'acme/hidden', displayTime: 30 },
		] );
		expect( markers().map( label ) ).toEqual( [ 'CTA · 0:10' ] );
	} );
} );
