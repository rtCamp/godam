/**
 * Layer API (#2292): the editor's core layer types, the bridge from the old
 * add-on hooks, and the hooks settings panels use.
 */

/**
 * External dependencies
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import {
	getLayerType,
	getLayerTypes,
	unregisterLayerType,
	getAvailability,
	getDefaultAttributes,
	getLayerVariation,
	supportsMedia,
} from '@godam/layers';

/**
 * Internal dependencies
 */
import { registerEditorLayerTypes } from './index';
import { getLegacyEditComponent } from './legacy';
import { LayerContext, useLayer, useLayerAttributes } from './hooks';
import { getFormIdFromLayer } from '../utils/formUtils';

jest.mock( '../components/layers/CTALayer', () => function CTALayer() {} );
jest.mock( '../components/layers/HotspotLayer', () => function HotspotLayer() {} );
jest.mock( '../components/layers/FormLayer', () => function FormLayer() {} );
jest.mock( '../components/layers/PollLayer', () => function PollLayer() {} );
jest.mock( '../components/layers/AdsLayer', () => function AdsLayer() {} );
jest.mock( '../utils/formUtils', () => ( { getFormIdFromLayer: jest.fn() } ) );
jest.mock( '../redux/slice/videoSlice', () => ( {
	updateLayerField: ( payload ) => ( { type: 'updateLayerField', payload } ),
} ) );

const resetRegistry = () => getLayerTypes().forEach( ( { name } ) => unregisterLayerType( name ) );

describe( 'Layer API: core layer types', () => {
	beforeAll( () => {
		window.videoData = { gfActive: true };
		window.easydamMediaLibrary = { isPollPluginActive: false };
		window.godamVideoEditorConfig = {};
		registerEditorLayerTypes();
	} );

	afterAll( resetRegistry );

	it( 'registers the five core types in "Add layer" menu order', () => {
		expect( getLayerTypes().map( ( { name } ) => name ) ).toEqual( [ 'cta', 'hotspot', 'form', 'poll', 'ad' ] );
	} );

	it( 'gives each core type its panel, colour and translated title', () => {
		expect( getLayerType( 'cta' ) ).toMatchObject( { title: 'CTA', color: '#3858e9', edit: expect.any( Function ) } );
		expect( getLayerType( 'hotspot' ).edit.name ).toBe( 'HotspotLayer' );
		expect( getLayerType( 'ad' ).description ).toBe( 'Insert an advertisement' );
	} );

	it( 'puts Hotspot on images and every other core type on video only', () => {
		expect( supportsMedia( getLayerType( 'hotspot' ), 'image' ) ).toBe( true );
		[ 'cta', 'form', 'poll', 'ad' ].forEach( ( name ) => expect( supportsMedia( getLayerType( name ), 'image' ) ).toBe( false ) );
	} );

	it( 'is safe to register twice', () => {
		const error = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
		registerEditorLayerTypes();
		expect( error ).not.toHaveBeenCalled();
		expect( getLayerTypes() ).toHaveLength( 5 );
		error.mockRestore();
	} );

	it( 'offers one form variation per form plugin, Gravity Forms by default', () => {
		const form = getLayerType( 'form' );
		expect( form.variations.map( ( { name } ) => name ) ).toEqual( [
			'gravity', 'wpforms', 'cf7', 'jetpack', 'sureforms', 'forminator',
			'fluentforms', 'everestforms', 'ninjaforms', 'metform', 'marketo', 'hubspot',
		] );
		expect( getDefaultAttributes( form ).form_type ).toBe( 'gravity' );
		expect( getLayerVariation( form, {} ).name ).toBe( 'gravity' );
		expect( getLayerVariation( form, { form_type: 'marketo' } ).title ).toBe( 'Marketo' );
	} );

	it( 'reads form plugin availability when asked, not at import', () => {
		const wpforms = getLayerType( 'form' ).variations.find( ( { name } ) => name === 'wpforms' );
		expect( wpforms.isAvailable() ).toBe( false );
		window.videoData.wpformsActive = true;
		expect( wpforms.isAvailable() ).toBe( true );
	} );

	it( 'explains why HubSpot is unavailable based on its settings', () => {
		const hubspot = getLayerType( 'form' ).variations.find( ( { name } ) => name === 'hubspot' );
		window.videoData.hubspotEnabled = false;
		expect( hubspot.unavailableReason ).toMatch( /Turn on HubSpot/ );
		window.videoData.hubspotEnabled = true;
		window.videoData.hubspotChosenSource = 'leadin';
		expect( hubspot.unavailableReason ).toMatch( /Activate and connect the HubSpot plugin/ );
	} );

	it( 'keeps Form available with no form plugin active, because Marketo needs none', () => {
		const saved = window.videoData;
		window.videoData = {};
		expect( getAvailability( getLayerType( 'form' ) ) ).toEqual( { available: true } );
		window.videoData = saved;
	} );

	it( 'refuses to save a form layer with no form picked', () => {
		const { validate } = getLayerType( 'form' );
		getFormIdFromLayer.mockReturnValueOnce( null ).mockReturnValueOnce( 12 );
		expect( validate( { form_type: 'gravity' } ) ).toBe( false );
		expect( validate( { form_type: 'gravity', gf_id: 12 } ) ).toBe( true );
	} );

	it( 'disables Poll when WP-Polls is inactive', () => {
		expect( getAvailability( getLayerType( 'poll' ) ) ).toEqual( { available: false, reason: 'Poll plugin is not active' } );
	} );

	it( 'disables new Ad layers with an ad server but keeps existing ones editable', () => {
		expect( getAvailability( getLayerType( 'ad' ), { videoConfig: { adServer: 'ad-server' } } ) ).toMatchObject( {
			available: false,
			disablesExisting: false,
		} );
		expect( getAvailability( getLayerType( 'ad' ), { videoConfig: { adServer: 'self-hosted' } } ).available ).toBe( true );
	} );
} );

describe( 'Layer API: bridge from the old add-on hooks', () => {
	beforeEach( () => {
		resetRegistry();
		window.godamVideoEditorConfig = {
			layerOptions: [
				{ type: 'woo', title: 'WooCommerce', layerText: 'WooCommerce', iconUrl: 'woo.svg', isActive: false, tooltipMessage: 'Add your API key' },
				{ type: 'acme', title: 'Acme', layerText: 'Acme Layer Text' },
			],
			layerComponents: { woo: 'WoocommerceLayer' },
		};
		window.godamLayerComponents = {};
		window.godamLayerCreators = {};
		registerEditorLayerTypes();
	} );

	afterAll( resetRegistry );

	it( 'registers each add-on type after the core types', () => {
		expect( getLayerTypes().map( ( { name } ) => name ).slice( -2 ) ).toEqual( [ 'woo', 'acme' ] );
	} );

	it( 'maps the old option fields onto the layer type', () => {
		expect( getLayerType( 'acme' ) ).toMatchObject( { title: 'Acme', label: 'Acme Layer Text', description: 'Acme Layer Text' } );
		expect( getLayerType( 'woo' ).iconUrl ).toBe( 'woo.svg' );
	} );

	it( 'keeps what core used to hard-code for the Woo layer', () => {
		const woo = getLayerType( 'woo' );
		expect( woo.color ).toBe( '#873eff' );
		expect( typeof woo.markerIcon ).toBe( 'function' );
		expect( supportsMedia( woo, 'image' ) ).toBe( true );
		expect( supportsMedia( getLayerType( 'acme' ), 'image' ) ).toBe( false );
	} );

	it( 'reports isActive: false as unavailable, with the add-on\'s message', () => {
		expect( getAvailability( getLayerType( 'woo' ) ) ).toEqual( { available: false, reason: 'Add your API key' } );
		expect( getAvailability( getLayerType( 'acme' ) ).available ).toBe( true );
	} );

	it( 'looks the creator up when a layer is added, so late add-on scripts still count', () => {
		const create = getLayerType( 'acme' ).create;
		expect( create( { currentTime: 1 } ) ).toBeUndefined();
		window.godamLayerCreators.acme = ( { currentTime } ) => ( { type: 'acme', displayTime: currentTime } );
		expect( create( { currentTime: 3 } ) ).toEqual( { type: 'acme', displayTime: 3 } );
	} );

	it( 'looks the settings panel up when it opens', () => {
		expect( getLegacyEditComponent( 'woo' ) ).toBeUndefined();
		const WoocommerceLayer = () => null;
		window.godamLayerComponents.WoocommerceLayer = WoocommerceLayer;
		expect( getLegacyEditComponent( 'woo' ) ).toBe( WoocommerceLayer );
		expect( getLegacyEditComponent( 'acme' ) ).toBeUndefined();
	} );

	it( 'does not re-register a type an add-on already registered through the Layer API', () => {
		resetRegistry();
		window.godam.layers.__unstableRegisterLegacyLayerType( { name: 'woo', title: 'Registered first' } );
		registerEditorLayerTypes();
		expect( getLayerType( 'woo' ).title ).toBe( 'Registered first' );
	} );
} );

describe( 'Layer API: settings panel hooks', () => {
	let container, root, store, dispatched;

	const renderHook = ( hook, layerId = 'l1' ) => {
		let result;
		const Probe = () => {
			result = hook();
			return null;
		};
		act( () => {
			root.render(
				<Provider store={ store }>
					<LayerContext.Provider value={ layerId }>
						<Probe />
					</LayerContext.Provider>
				</Provider>,
			);
		} );
		return () => result;
	};

	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement( 'div' );
		root = createRoot( container );
		dispatched = [];
		store = configureStore( {
			reducer: {
				videoReducer: ( state = { layers: [ { id: 'l1', type: 'acme/countdown', label: 'Hi' }, { id: 'l2', type: 'cta' } ] }, action ) => {
					dispatched.push( action );
					return state;
				},
			},
		} );
	} );

	afterEach( () => act( () => root.unmount() ) );

	it( 'useLayer() returns the open layer, or the one with the given id', () => {
		expect( renderHook( () => useLayer() )() ).toMatchObject( { id: 'l1' } );
		expect( renderHook( () => useLayer( 'l2' ) )() ).toMatchObject( { id: 'l2' } );
	} );

	it( 'useLayerAttributes() merges changes but never touches id or type', () => {
		const result = renderHook( () => useLayerAttributes() );
		const [ layer, setAttributes ] = result();
		expect( layer.label ).toBe( 'Hi' );

		act( () => setAttributes( { label: 'Bye', endsAt: '10:00', id: 'x', type: 'cta' } ) );

		expect( dispatched.filter( ( a ) => a.type === 'updateLayerField' ).map( ( a ) => a.payload ) ).toEqual( [
			{ id: 'l1', field: 'label', value: 'Bye' },
			{ id: 'l1', field: 'endsAt', value: '10:00' },
		] );
	} );
} );
