/**
 * Layer API (#2292): layer type registration and helpers.
 */

/**
 * WordPress dependencies
 */
import { addFilter, removeFilter } from '@wordpress/hooks';

/**
 * Internal dependencies
 */
import {
	registerLayerType,
	unregisterLayerType,
	getLayerType,
	getLayerTypes,
	getDefaultAttributes,
	getLayerVariation,
	getDefaultVariation,
	isVariationAvailable,
	getAvailability,
	supportsMedia,
	__unstableRegisterLegacyLayerType,
} from './index';

describe( 'Layer API: registerLayerType', () => {
	let error;

	beforeEach( () => {
		error = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
	} );

	afterEach( () => {
		getLayerTypes().forEach( ( { name } ) => unregisterLayerType( name ) );
		error.mockRestore();
	} );

	it( 'registers a namespaced type from layer.json metadata plus settings', () => {
		const Edit = () => null;
		const registered = registerLayerType( { name: 'acme/countdown', title: 'Countdown' }, { edit: Edit } );

		expect( registered ).toMatchObject( { name: 'acme/countdown', title: 'Countdown', edit: Edit } );
		expect( getLayerType( 'acme/countdown' ) ).toBe( registered );
	} );

	it( 'fills in defaults for supports, label, description, attributes and variations', () => {
		const registered = registerLayerType( { name: 'acme/countdown', title: 'Countdown', supports: { media: [ 'video', 'image' ] } } );

		expect( registered ).toMatchObject( {
			apiVersion: 1,
			label: 'Countdown',
			description: '',
			attributes: {},
			variations: [],
			supports: { media: [ 'video', 'image' ], timeline: true, duplicate: true, skip: false, rawHtml: false },
		} );
	} );

	it( 'treats a URL icon as an image icon', () => {
		const registered = registerLayerType( { name: 'acme/countdown', title: 'Countdown', icon: 'https://example.com/clock.svg' } );
		expect( registered.iconUrl ).toBe( 'https://example.com/clock.svg' );
		expect( registered.icon ).toBeUndefined();
	} );

	it.each( [ 'countdown', 'Acme/Countdown', 'acme/count down', undefined ] )( 'rejects the name %p', ( name ) => {
		expect( registerLayerType( { name, title: 'Countdown' } ) ).toBeUndefined();
		expect( getLayerTypes() ).toEqual( [] );
	} );

	it( 'accepts the un-namespaced core names', () => {
		expect( registerLayerType( { name: 'cta', title: 'CTA' } ) ).toBeDefined();
	} );

	it( 'rejects a duplicate and keeps the first registration', () => {
		registerLayerType( { name: 'acme/countdown', title: 'First' } );
		expect( registerLayerType( { name: 'acme/countdown', title: 'Second' } ) ).toBeUndefined();
		expect( getLayerType( 'acme/countdown' ).title ).toBe( 'First' );
	} );

	it( 'requires a title', () => {
		expect( registerLayerType( { name: 'acme/countdown' } ) ).toBeUndefined();
	} );

	it( 'drops managed keys and keeps only the default of shared keys', () => {
		const registered = registerLayerType( {
			name: 'acme/countdown',
			title: 'Countdown',
			attributes: {
				id: { type: 'string' },
				displayTime: { type: 'number' },
				duration: { type: 'string', format: 'url', default: 9 },
				allow_skip: { type: 'boolean' },
				endsAt: { type: 'string', default: '' },
			},
		} );

		expect( registered.attributes ).toEqual( {
			duration: { default: 9 },
			allow_skip: {},
			endsAt: { type: 'string', default: '' },
		} );
	} );

	it( 'runs settings through the godam.layers.registerLayerType filter', () => {
		addFilter( 'godam.layers.registerLayerType', 'test/color', ( settings, name ) =>
			name === 'acme/countdown' ? { ...settings, color: '#123456' } : settings,
		);

		expect( registerLayerType( { name: 'acme/countdown', title: 'Countdown' } ).color ).toBe( '#123456' );

		removeFilter( 'godam.layers.registerLayerType', 'test/color' );
	} );

	it( 'does not let the filter rename the type', () => {
		addFilter( 'godam.layers.registerLayerType', 'test/rename', ( settings ) => ( { ...settings, name: 'acme/other' } ) );
		registerLayerType( { name: 'acme/countdown', title: 'Countdown' } );
		removeFilter( 'godam.layers.registerLayerType', 'test/rename' );

		expect( getLayerType( 'acme/countdown' ) ).toBeDefined();
		expect( getLayerType( 'acme/other' ) ).toBeUndefined();
	} );

	it( 'lists types in registration order and unregisters them', () => {
		registerLayerType( { name: 'acme/b', title: 'B' } );
		registerLayerType( { name: 'acme/a', title: 'A' } );
		expect( getLayerTypes().map( ( { name } ) => name ) ).toEqual( [ 'acme/b', 'acme/a' ] );

		expect( unregisterLayerType( 'acme/b' ).title ).toBe( 'B' );
		expect( getLayerTypes().map( ( { name } ) => name ) ).toEqual( [ 'acme/a' ] );
	} );

	it( 'registers a legacy add-on type without a namespace', () => {
		expect( __unstableRegisterLegacyLayerType( { name: 'woo', title: 'WooCommerce' } ) ).toMatchObject( { name: 'woo' } );
	} );

	it( 'exposes the API on window.godam.layers', () => {
		expect( window.godam.layers.registerLayerType ).toBe( registerLayerType );
		expect( window.godam.layers.getLayerTypes ).toBe( getLayerTypes );
	} );
} );

describe( 'Layer API: helpers', () => {
	const formType = {
		attributes: {
			form_type: { type: 'string', default: 'gravity' },
			fields: { type: 'array', default: [] },
		},
		variations: [
			{ name: 'gravity', title: 'Gravity Forms', attributes: { form_type: 'gravity' } },
			{ name: 'wpforms', title: 'WPForms', attributes: { form_type: 'wpforms' }, isDefault: true },
		],
	};

	it( 'copies default attribute values so layers never share them', () => {
		const first = getDefaultAttributes( formType );
		first.fields.push( 'x' );
		expect( getDefaultAttributes( formType ) ).toEqual( { form_type: 'gravity', fields: [] } );
	} );

	it( 'applies a variation over the defaults', () => {
		expect( getDefaultAttributes( formType, formType.variations[ 1 ] ) ).toEqual( { form_type: 'wpforms', fields: [] } );
	} );

	it( 'finds a saved layer\'s variation, reading missing keys as defaults', () => {
		expect( getLayerVariation( formType, { form_type: 'wpforms' } ).name ).toBe( 'wpforms' );
		expect( getLayerVariation( formType, {} ).name ).toBe( 'gravity' );
		expect( getLayerVariation( formType, { form_type: 'mystery' } ) ).toBeUndefined();
	} );

	it( 'picks the isDefault variation, else the first', () => {
		expect( getDefaultVariation( formType ).name ).toBe( 'wpforms' );
		expect( getDefaultVariation( { variations: [ { name: 'a' }, { name: 'b' } ] } ).name ).toBe( 'a' );
		expect( getDefaultVariation( {} ) ).toBeUndefined();
	} );

	it( 'treats a variation as available unless isAvailable() says otherwise', () => {
		expect( isVariationAvailable( {} ) ).toBe( true );
		expect( isVariationAvailable( { isAvailable: () => false } ) ).toBe( false );
	} );

	it( 'reports availability from getAvailability( context ), defaulting to available', () => {
		expect( getAvailability( {} ) ).toEqual( { available: true } );
		const ad = { getAvailability: ( { videoConfig } ) => ( videoConfig.adServer === 'ad-server' ? { available: false, reason: 'No' } : null ) };
		expect( getAvailability( ad, { videoConfig: { adServer: 'ad-server' } } ) ).toEqual( { available: false, reason: 'No' } );
		expect( getAvailability( ad, { videoConfig: {} } ) ).toEqual( { available: true } );
	} );

	it( 'checks media support', () => {
		expect( supportsMedia( { supports: { media: [ 'video', 'image' ] } }, 'image' ) ).toBe( true );
		expect( supportsMedia( { supports: { media: [ 'video' ] } }, 'audio' ) ).toBe( false );
	} );
} );
