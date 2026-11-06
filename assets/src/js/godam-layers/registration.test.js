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
	registerLayerVariation,
	unregisterLayerVariation,
	getLayerVariationByName,
	getUnavailableReason,
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

	it( 'lets an add-on keep the un-namespaced name its layers were saved under before the Layer API', () => {
		expect( registerLayerType( { name: 'woo', title: 'WooCommerce' } ) ).toMatchObject( { name: 'woo' } );
		expect( registerLayerType( { name: 'shop', title: 'Shop' } ) ).toBeUndefined();
	} );

	it( 'fills in the metadata the type registered in PHP, letting the script override it', () => {
		const Edit = () => null;
		window.godamVideoEditorConfig = {
			layerTypes: {
				'acme/countdown': { name: 'acme/countdown', title: 'Countdown (PHP)', color: '#e24a4a', attributes: { endsAt: { type: 'string', default: '' } } },
			},
		};

		const registered = registerLayerType( 'acme/countdown', { edit: Edit, title: 'Countdown' } );

		expect( registered ).toMatchObject( { title: 'Countdown', color: '#e24a4a', edit: Edit } );
		expect( registered.attributes.endsAt ).toMatchObject( { type: 'string', default: '' } );
		delete window.godamVideoEditorConfig;
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

describe( 'Layer API: registerLayerVariation', () => {
	let error;

	beforeEach( () => {
		error = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
	} );

	afterEach( () => {
		getLayerTypes().forEach( ( { name } ) => unregisterLayerType( name ) );
		error.mockRestore();
	} );

	const registerForm = ( settings = {} ) =>
		registerLayerType( { name: 'form', title: 'Form' }, { variationAttribute: 'form_type', ...settings } );

	it( 'adds variations in registration order, selected by the type\'s variationAttribute', () => {
		registerForm();
		registerLayerVariation( 'form', { name: 'gravity', title: 'Gravity Forms' } );
		registerLayerVariation( 'form', { name: 'acme-forms', title: 'Acme Forms', idField: 'acme_form_id' } );

		expect( getLayerType( 'form' ).variations ).toEqual( [
			{ name: 'gravity', title: 'Gravity Forms', attributes: { form_type: 'gravity' } },
			{ name: 'acme-forms', title: 'Acme Forms', idField: 'acme_form_id', attributes: { form_type: 'acme-forms' } },
		] );
		expect( getLayerVariationByName( 'form', 'acme-forms' ).idField ).toBe( 'acme_form_id' );
	} );

	it( 'keeps a variation\'s own attributes', () => {
		registerForm();
		registerLayerVariation( 'form', { name: 'dark', title: 'Dark', attributes: { theme: 'dark' } } );
		expect( getLayerVariationByName( 'form', 'dark' ).attributes ).toEqual( { theme: 'dark' } );
	} );

	it( 'holds a variation registered before its type and adds it when the type registers', () => {
		registerLayerVariation( 'form', { name: 'acme-forms', title: 'Acme Forms' } );
		expect( getLayerType( 'form' ) ).toBeUndefined();

		registerForm( { variations: [ { name: 'gravity', title: 'Gravity Forms' } ] } );

		expect( getLayerType( 'form' ).variations.map( ( { name, attributes } ) => [ name, attributes.form_type ] ) ).toEqual( [
			[ 'gravity', 'gravity' ],
			[ 'acme-forms', 'acme-forms' ],
		] );
	} );

	it( 'rejects a duplicate name, and a variation without a name or title', () => {
		registerForm();
		registerLayerVariation( 'form', { name: 'gravity', title: 'Gravity Forms' } );

		expect( registerLayerVariation( 'form', { name: 'gravity', title: 'Again' } ) ).toBeUndefined();
		expect( registerLayerVariation( 'form', { title: 'No name' } ) ).toBeUndefined();
		expect( registerLayerVariation( 'form', { name: 'untitled' } ) ).toBeUndefined();
		expect( getLayerType( 'form' ).variations.map( ( { name } ) => name ) ).toEqual( [ 'gravity' ] );
	} );

	it( 'unregisters a variation and keeps the others', () => {
		registerForm();
		registerLayerVariation( 'form', { name: 'gravity', title: 'Gravity Forms' } );
		registerLayerVariation( 'form', { name: 'acme-forms', title: 'Acme Forms' } );

		expect( unregisterLayerVariation( 'form', 'gravity' ).name ).toBe( 'gravity' );
		expect( getLayerType( 'form' ).variations.map( ( { name } ) => name ) ).toEqual( [ 'acme-forms' ] );
		expect( unregisterLayerVariation( 'form', 'gravity' ) ).toBeUndefined();
	} );

	it( 'keeps the type\'s place in the registry when a variation is added', () => {
		registerForm();
		registerLayerType( { name: 'acme/countdown', title: 'Countdown' } );
		registerLayerVariation( 'form', { name: 'gravity', title: 'Gravity Forms' } );
		expect( getLayerTypes().map( ( { name } ) => name ) ).toEqual( [ 'form', 'acme/countdown' ] );
	} );

	it( 'exposes variation registration on window.godam.layers', () => {
		expect( window.godam.layers.registerLayerVariation ).toBe( registerLayerVariation );
		expect( window.godam.layers.unregisterLayerVariation ).toBe( unregisterLayerVariation );
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

	it( 'reads a variation\'s unavailable reason from a string or a function', () => {
		expect( getUnavailableReason( { unavailableReason: 'Activate Acme' } ) ).toBe( 'Activate Acme' );
		expect( getUnavailableReason( { unavailableReason: () => 'Connect Acme' } ) ).toBe( 'Connect Acme' );
		expect( getUnavailableReason( {} ) ).toBe( '' );
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
