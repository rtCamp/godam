/**
 * Layer API contract tests (#2291): the front-end layer registry.
 *
 * Add-ons (e.g. godam-for-woo) register front-end layer types through
 * `window.godamLayerRegistry`, or push to `window.godamLayerRegistryQueue` when
 * they load before the player. #2294 backs this API with the Layer API runtime
 * registry (`window.godam.layers`); these tests are what it must keep passing.
 */

const reset = () => {
	delete window.godam;
	delete window.godamLayerRegistry;
	delete window.godamLayerRegistryQueue;
};

const loadRegistry = () => {
	let registry;
	jest.isolateModules( () => {
		registry = require( './layer-registry.js' );
	} );
	return registry;
};

const loadInit = () => {
	jest.isolateModules( () => {
		require( './layer-registry-init.js' );
	} );
};

const validator = () => true;

describe( 'Layer API contract: layer registry', () => {
	let warn, error;

	beforeEach( () => {
		reset();
		warn = jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		error = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
	} );

	afterEach( () => {
		warn.mockRestore();
		error.mockRestore();
		reset();
	} );

	it( 'registers a type with its label, validator and manager', () => {
		const registry = loadRegistry();
		class AcmeManager {}

		expect( registry.registerLayerType( 'acme', { label: 'Acme', validator, manager: AcmeManager } ) ).toBe( true );

		expect( registry.isLayerTypeRegistered( 'acme' ) ).toBe( true );
		expect( registry.getLayerValidator( 'acme' ) ).toBe( validator );
		expect( registry.getLayerManager( 'acme' ) ).toBe( AcmeManager );
		expect( registry.getAllRegisteredLayerTypes() ).toEqual( { acme: { label: 'Acme', manager: AcmeManager } } );
	} );

	it( 'treats the manager as optional', () => {
		const registry = loadRegistry();
		registry.registerLayerType( 'acme', { label: 'Acme', validator } );
		expect( registry.getLayerManager( 'acme' ) ).toBeNull();
		expect( registry.getAllRegisteredLayerTypes() ).toEqual( { acme: { label: 'Acme' } } );
	} );

	it.each( [
		[ 'no label', { validator } ],
		[ 'no validator', { label: 'Acme' } ],
	] )( 'rejects a registration with %s', ( _, config ) => {
		const registry = loadRegistry();
		expect( registry.registerLayerType( 'acme', config ) ).toBe( false );
		expect( registry.getAllRegisteredLayerTypes() ).toEqual( {} );
	} );

	it( 'keeps the first registration and rejects a duplicate id', () => {
		const registry = loadRegistry();
		const second = () => false;
		registry.registerLayerType( 'acme', { label: 'Acme', validator } );
		expect( registry.registerLayerType( 'acme', { label: 'Other', validator: second } ) ).toBe( false );
		expect( registry.getLayerValidator( 'acme' ) ).toBe( validator );
	} );

	it( 'always reports the four core types as registered, without registering them', () => {
		const registry = loadRegistry();
		[ 'form', 'cta', 'poll', 'hotspot' ].forEach( ( type ) => expect( registry.isLayerTypeRegistered( type ) ).toBe( true ) );
		expect( registry.isLayerTypeRegistered( 'ad' ) ).toBe( false );
		expect( registry.isLayerTypeRegistered( 'ghost' ) ).toBe( false );
		expect( registry.getAllRegisteredLayerTypes() ).toEqual( {} );
	} );

	it( 'lists core types plus registered types, keyed by upper-case id', () => {
		const registry = loadRegistry();
		registry.registerLayerType( 'acme', { label: 'Acme', validator } );
		expect( registry.getLayerTypes() ).toEqual( { FORM: 'form', CTA: 'cta', POLL: 'poll', HOTSPOT: 'hotspot', ACME: 'acme' } );
	} );

	it( 'calls registry hooks with ( "register", id, config )', () => {
		const registry = loadRegistry();
		const hook = jest.fn();
		const config = { label: 'Acme', validator };
		registry.addLayerRegistryHook( hook );
		registry.registerLayerType( 'acme', config );
		expect( hook ).toHaveBeenCalledWith( 'register', 'acme', config );
	} );

	it( 'shares one store between separately bundled copies of the registry', () => {
		const playerCopy = loadRegistry();
		const imageCopy = loadRegistry();
		class AcmeManager {}

		imageCopy.registerLayerType( 'acme', { label: 'Acme', validator, manager: AcmeManager } );

		expect( playerCopy.getLayerManager( 'acme' ) ).toBe( AcmeManager );
	} );

	it( 'registers each type as a Layer API runtime', () => {
		const registry = loadRegistry();
		class AcmeManager {}
		const check = jest.fn( () => false );
		registry.registerLayerType( 'acme', { label: 'Acme', validator: check, manager: AcmeManager } );

		const runtime = window.godam.layers.getLayerRuntime( 'acme' );
		expect( runtime ).toMatchObject( { name: 'acme', title: 'Acme', supports: { media: [ 'video' ] } } );
		expect( runtime.validate( { id: 'l1' }, { dependencies: { woocommerce: true } } ) ).toBe( false );
		expect( check ).toHaveBeenCalledWith( { id: 'l1' }, { woocommerce: true } );
	} );

	it( 'runs a manager on images only when it has the image methods the Woo manager has', () => {
		const registry = loadRegistry();
		class ImageManager {
			createProductHotspots() {}
		}
		registry.registerLayerType( 'woo', { label: 'Woo', validator, manager: ImageManager } );
		expect( window.godam.layers.getLayerRuntime( 'woo' ).supports.media ).toEqual( [ 'video', 'image' ] );
	} );

	it( 'rejects a type that already has a Layer API runtime', () => {
		const registry = loadRegistry();
		require( '../../godam-layers/runtime/registry.js' ).registerLayerRuntime( 'acme', { mount: () => ( {} ) } );
		expect( registry.registerLayerType( 'acme', { label: 'Acme', validator } ) ).toBe( false );
		expect( warn ).toHaveBeenCalledWith( 'Layer type "acme" is already registered. Skipping duplicate registration.' );
	} );

	describe( 'window.godamLayerRegistry', () => {
		it( 'exposes the registry API on window', () => {
			loadInit();
			expect( Object.keys( window.godamLayerRegistry ).sort() ).toEqual( [
				'addLayerRegistryHook',
				'getAllRegisteredLayerTypes',
				'getLayerManager',
				'getLayerTypes',
				'getLayerValidator',
				'isLayerTypeRegistered',
				'registerLayerType',
			] );
		} );

		it( 'registers types an add-on queued before the registry loaded, then clears the queue', () => {
			class AcmeManager {}
			window.godamLayerRegistryQueue = [ { id: 'acme', config: { label: 'Acme', validator, manager: AcmeManager } } ];

			loadInit();

			expect( window.godamLayerRegistry.getLayerManager( 'acme' ) ).toBe( AcmeManager );
			expect( window.godamLayerRegistryQueue ).toBeUndefined();
		} );

		it( 'keeps the first window API when a second bundle initializes', () => {
			loadInit();
			const first = window.godamLayerRegistry;
			loadInit();
			expect( window.godamLayerRegistry ).toBe( first );
		} );
	} );
} );
