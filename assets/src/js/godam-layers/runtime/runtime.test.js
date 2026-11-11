/**
 * Layer API (#2294): the front-end runtime registry and the layer host.
 */

/**
 * Internal dependencies
 */
import {
	registerLayerRuntime,
	unregisterLayerRuntime,
	whenLayerRuntime,
	whenLayerRuntimeVariation,
	getLayerRuntime,
	getLayerRuntimes,
	registerLayerRuntimeVariation,
	unregisterLayerRuntimeVariation,
	getLayerRuntimeVariation,
	supportsMedia,
	shouldMountLayer,
	layersUseIconFont,
	runtimeUsesIconFont,
} from './registry';
import { createLayerHost } from './host';

const mount = () => ( {} );

describe( 'Layer API: runtime registry', () => {
	let error;

	beforeEach( () => {
		delete window.godam;
		error = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
	} );

	afterEach( () => {
		error.mockRestore();
		delete window.godam;
	} );

	it( 'matches a variation whose attributes hold an array or object by value', () => {
		registerLayerRuntime( 'acme/forms', {
			mount,
			variations: [ { name: 'tagged', attributes: { tags: [ 'a', 'b' ], meta: { x: 1 } } } ],
		} );
		expect( getLayerRuntimeVariation( 'acme/forms', { tags: [ 'a', 'b' ], meta: { x: 1 } } )?.name ).toBe( 'tagged' );
		expect( getLayerRuntimeVariation( 'acme/forms', { tags: [ 'a' ], meta: { x: 1 } } ) ).toBeUndefined();
	} );

	it( 'runs a variation waiter once a matching variation registers, and not before', () => {
		registerLayerRuntime( 'acme/forms', { mount, variationAttribute: 'provider' } );
		const callback = jest.fn();
		whenLayerRuntimeVariation( 'acme/forms', { provider: 'late' }, callback );

		registerLayerRuntimeVariation( 'acme/forms', { name: 'other' } );
		expect( callback ).not.toHaveBeenCalled();

		registerLayerRuntimeVariation( 'acme/forms', { name: 'late' } );
		expect( callback ).toHaveBeenCalledTimes( 1 );
		expect( callback.mock.calls[ 0 ][ 0 ].variations.map( ( { name } ) => name ) ).toEqual( [ 'other', 'late' ] );

		// Already there: runs at once.
		const now = jest.fn();
		whenLayerRuntimeVariation( 'acme/forms', { provider: 'late' }, now );
		expect( now ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'treats a validate() or usesIconFont() that throws as no, and logs it', () => {
		const broken = registerLayerRuntime( 'acme/broken', {
			mount,
			validate: () => {
				throw new Error( 'boom' );
			},
			usesIconFont: () => {
				throw new Error( 'boom' );
			},
		} );
		expect( shouldMountLayer( broken, { type: 'acme/broken' } ) ).toBe( false );
		expect( runtimeUsesIconFont( broken, { type: 'acme/broken' } ) ).toBe( false );
		expect( layersUseIconFont( [ { type: 'acme/broken' } ] ) ).toBe( false );
		expect( error ).toHaveBeenCalledWith( 'GoDAM: the validate() of layer runtime "acme/broken" failed.', expect.any( Error ) );
	} );

	it( 'registers a runtime, defaulting its title and to video only', () => {
		const runtime = registerLayerRuntime( 'acme/countdown', { mount } );
		expect( runtime ).toMatchObject( { name: 'acme/countdown', title: 'acme/countdown', supports: { media: [ 'video' ] }, variations: [] } );
		expect( getLayerRuntime( 'acme/countdown' ) ).toBe( runtime );
		expect( getLayerRuntimes() ).toEqual( [ runtime ] );
		expect( supportsMedia( runtime, 'image' ) ).toBe( false );
	} );

	it.each( [
		[ 'no name', '', { mount }, 'GoDAM: a layer runtime needs a layer type name.' ],
		[ 'no mount()', 'acme/x', {}, 'GoDAM: the runtime for layer type "acme/x" needs a mount() function.' ],
	] )( 'rejects a runtime with %s', ( _, name, settings, message ) => {
		expect( registerLayerRuntime( name, settings ) ).toBeUndefined();
		expect( error ).toHaveBeenCalledWith( message );
		expect( getLayerRuntimes() ).toEqual( [] );
	} );

	it( 'keeps the first runtime for a type', () => {
		const first = registerLayerRuntime( 'acme/x', { mount } );
		expect( registerLayerRuntime( 'acme/x', { mount, title: 'Other' } ) ).toBeUndefined();
		expect( getLayerRuntime( 'acme/x' ) ).toBe( first );
		expect( error ).toHaveBeenCalledWith( 'GoDAM: a runtime for layer type "acme/x" is already registered.' );
	} );

	it( 'runs a callback once a runtime registers, or now if it already has', () => {
		const late = jest.fn();
		whenLayerRuntime( 'acme/late', late );
		expect( late ).not.toHaveBeenCalled();
		registerLayerRuntime( 'acme/late', { mount } );
		expect( late ).toHaveBeenCalledWith( expect.objectContaining( { name: 'acme/late' } ) );

		const now = jest.fn();
		whenLayerRuntime( 'acme/late', now );
		expect( now ).toHaveBeenCalledTimes( 1 );

		const cancelled = jest.fn();
		const stop = whenLayerRuntime( 'acme/never', cancelled );
		stop();
		registerLayerRuntime( 'acme/never', { mount } );
		expect( cancelled ).not.toHaveBeenCalled();
	} );

	it( 'unregisters a runtime', () => {
		registerLayerRuntime( 'acme/x', { mount } );
		unregisterLayerRuntime( 'acme/x' );
		expect( getLayerRuntime( 'acme/x' ) ).toBeUndefined();
	} );

	it( 'publishes the API on window.godam.layers without replacing the editor API there', () => {
		window.godam = { layers: { registerLayerType: 'editor' } };
		registerLayerRuntime( 'acme/x', { mount } );
		expect( window.godam.layers.registerLayerType ).toBe( 'editor' );
		expect( window.godam.layers.getLayerRuntime( 'acme/x' ).name ).toBe( 'acme/x' );
		expect( typeof window.godam.layers.registerLayerRuntimeVariation ).toBe( 'function' );
	} );

	it( 'shares one registry between separately bundled copies', () => {
		let copy;
		jest.isolateModules( () => {
			copy = require( './registry' );
		} );
		copy.registerLayerRuntime( 'acme/x', { mount } );
		expect( getLayerRuntime( 'acme/x' ).name ).toBe( 'acme/x' );
	} );

	describe( 'variations', () => {
		it( 'selects a variation by its attributes, defaulting them from variationAttribute', () => {
			registerLayerRuntime( 'acme/form', { mount, variationAttribute: 'form_type' } );
			registerLayerRuntimeVariation( 'acme/form', { name: 'one', title: 'One' } );
			registerLayerRuntimeVariation( 'acme/form', { name: 'two', title: 'Two', attributes: { kind: 'b' } } );

			expect( getLayerRuntime( 'acme/form' ).variations[ 0 ].attributes ).toEqual( { form_type: 'one' } );
			expect( getLayerRuntimeVariation( 'acme/form', { form_type: 'one' } ).title ).toBe( 'One' );
			expect( getLayerRuntimeVariation( 'acme/form', { kind: 'b' } ).title ).toBe( 'Two' );
			expect( getLayerRuntimeVariation( 'acme/form', { form_type: 'nope' } ) ).toBeUndefined();
			expect( getLayerRuntimeVariation( 'acme/missing', {} ) ).toBeUndefined();
		} );

		it( 'keeps a variation registered before its runtime', () => {
			registerLayerRuntimeVariation( 'acme/form', { name: 'early', title: 'Early' } );
			registerLayerRuntime( 'acme/form', { mount, variationAttribute: 'form_type' } );
			expect( getLayerRuntimeVariation( 'acme/form', { form_type: 'early' } ).title ).toBe( 'Early' );
		} );

		it( 'rejects a variation with no name or a name already used', () => {
			registerLayerRuntime( 'acme/form', { mount } );
			expect( registerLayerRuntimeVariation( 'acme/form', { title: 'No name' } ) ).toBeUndefined();
			registerLayerRuntimeVariation( 'acme/form', { name: 'one' } );
			expect( registerLayerRuntimeVariation( 'acme/form', { name: 'one' } ) ).toBeUndefined();
			expect( getLayerRuntime( 'acme/form' ).variations ).toHaveLength( 1 );
		} );

		it( 'unregisters a variation', () => {
			registerLayerRuntime( 'acme/form', { mount, variationAttribute: 'form_type' } );
			registerLayerRuntimeVariation( 'acme/form', { name: 'one' } );
			unregisterLayerRuntimeVariation( 'acme/form', 'one' );
			expect( getLayerRuntime( 'acme/form' ).variations ).toEqual( [] );
		} );
	} );

	it( 'mounts a layer when its runtime has no validate(), or validate() says yes', () => {
		const validate = jest.fn( ( layer, { dependencies } ) => dependencies.acme === true );
		registerLayerRuntime( 'acme/open', { mount } );
		registerLayerRuntime( 'acme/gated', { mount, validate } );

		expect( shouldMountLayer( getLayerRuntime( 'acme/open' ), {} ) ).toBe( true );
		expect( shouldMountLayer( getLayerRuntime( 'acme/gated' ), { id: 1 }, { acme: false } ) ).toBe( false );
		expect( shouldMountLayer( getLayerRuntime( 'acme/gated' ), { id: 1 }, { acme: true } ) ).toBe( true );
		expect( validate ).toHaveBeenCalledWith( { id: 1 }, { dependencies: { acme: true } } );
		expect( shouldMountLayer( undefined, {} ) ).toBe( false );
	} );

	it( 'asks each layer\'s runtime whether it needs FontAwesome', () => {
		registerLayerRuntime( 'acme/icons', { mount, usesIconFont: ( layer ) => layer.icon === 'star' } );
		expect( layersUseIconFont( [ { type: 'acme/icons', icon: 'none' } ] ) ).toBe( false );
		expect( layersUseIconFont( [ { type: 'ghost' }, { type: 'acme/icons', icon: 'star' } ] ) ).toBe( true );
		expect( layersUseIconFont( null ) ).toBe( false );
	} );
} );

describe( 'Layer API: layer host', () => {
	let player, host, info;

	const container = () => {
		const el = document.createElement( 'div' );
		el.classList.add( 'hidden' );
		return el;
	};

	beforeEach( () => {
		delete window.godam;
		info = jest.spyOn( console, 'info' ).mockImplementation( () => {} );
		player = {
			el: () => ( { getAttribute: ( attr ) => ( attr === 'data-id' ? '42' : null ) } ),
			pause: jest.fn(),
			play: jest.fn( () => Promise.resolve() ),
			currentTime: jest.fn( () => 7 ),
		};
		host = createLayerHost( { player, media: { type: 'video' }, instanceId: 'p1', isSuppressed: () => suppressed } );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		delete window.GoDAM;
	} );

	let suppressed = false;

	it( 'sends each event once to handlers several layers share', () => {
		const handlers = { onTimeUpdate: jest.fn() };
		registerLayerRuntime( 'acme/shared', { mount: ( ctx ) => ctx.shared( 'acme', () => handlers ) } );
		host.mount( { id: 1, type: 'acme/shared' }, container() );
		host.mount( { id: 2, type: 'acme/shared' }, container() );

		host.dispatch( 'onTimeUpdate', 3 );

		expect( handlers.onTimeUpdate.mock.calls ).toEqual( [ [ 3 ] ] );
	} );

	it( 'holds back only the events that reveal layers while suppressed', () => {
		const handlers = { onTimeUpdate: jest.fn(), onPause: jest.fn(), onEnded: jest.fn(), onResize: jest.fn(), onPlay: jest.fn() };
		registerLayerRuntime( 'acme/x', { mount: () => handlers } );
		host.mount( { id: 1, type: 'acme/x' }, container() );

		suppressed = true;
		[ 'onTimeUpdate', 'onPause', 'onEnded', 'onResize', 'onPlay' ].forEach( ( event ) => host.dispatch( event ) );
		suppressed = false;

		expect( handlers.onTimeUpdate ).not.toHaveBeenCalled();
		expect( handlers.onPause ).not.toHaveBeenCalled();
		expect( handlers.onEnded ).not.toHaveBeenCalled();
		expect( handlers.onResize ).toHaveBeenCalled();
		expect( handlers.onPlay ).toHaveBeenCalled();
	} );

	it( 'skips runtimes that do not support the media', () => {
		const imageOnly = jest.fn( () => ( {} ) );
		registerLayerRuntime( 'acme/image', { supports: { media: [ 'image' ] }, mount: imageOnly } );
		expect( host.mount( { id: 1, type: 'acme/image' }, container() ) ).toBeNull();
		expect( imageOnly ).not.toHaveBeenCalled();
	} );

	it( 'destroys shared handlers once their last layer unmounts', () => {
		const handlers = { destroy: jest.fn(), onResize: jest.fn() };
		registerLayerRuntime( 'acme/shared', { mount: ( ctx ) => ctx.shared( 'acme', () => handlers ) } );
		const first = host.mount( { id: 1, type: 'acme/shared' }, container() );
		const second = host.mount( { id: 2, type: 'acme/shared' }, container() );

		first();
		expect( handlers.destroy ).not.toHaveBeenCalled();
		second();
		expect( handlers.destroy ).toHaveBeenCalledTimes( 1 );
		host.dispatch( 'onResize' );
		expect( handlers.onResize ).not.toHaveBeenCalled();
	} );

	it( 'keeps calling other layers when one handler throws', () => {
		const error = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
		const healthy = { onTimeUpdate: jest.fn() };
		registerLayerRuntime( 'acme/broken', { mount: () => ( { onTimeUpdate: () => {
			throw new Error( 'boom' );
		} } ) } );
		registerLayerRuntime( 'acme/healthy', { mount: () => healthy } );
		host.mount( { id: 1, type: 'acme/broken' }, container() );
		host.mount( { id: 2, type: 'acme/healthy' }, container() );

		host.dispatch( 'onTimeUpdate', 1 );

		expect( healthy.onTimeUpdate ).toHaveBeenCalledWith( 1 );
		expect( error ).toHaveBeenCalledWith( 'GoDAM: a layer\'s onTimeUpdate handler failed.', expect.any( Error ) );
	} );

	it( 'gives mount() an api for the layer and its player', () => {
		let api;
		registerLayerRuntime( 'acme/x', { mount: ( ctx ) => {
			api = ctx.api;
			return {};
		} } );
		const el = container();
		host.mount( { id: 1, type: 'acme/x' }, el );

		api.show();
		expect( api.isVisible() ).toBe( true );
		api.hide();
		expect( el.classList.contains( 'hidden' ) ).toBe( true );
		api.pause();
		api.play();
		api.seek( 12 );
		expect( player.pause ).toHaveBeenCalled();
		expect( player.play ).toHaveBeenCalled();
		expect( player.currentTime ).toHaveBeenCalledWith( 12 );
		expect( api.currentTime() ).toBe( 7 );
		suppressed = true;
		expect( api.isSuppressed() ).toBe( true );
		suppressed = false;
	} );

	describe( 'api.track()', () => {
		let events, apiFor;

		beforeEach( () => {
			events = [];
			window.GoDAM = { addLayerInteraction: ( key, event ) => events.push( { key, ...event } ) };
			apiFor = ( layer ) => {
				let api;
				const name = `track/${ layer.type }`;
				host.mount( layer, container(), { name, supports: { media: [ 'video' ] }, mount: ( ctx ) => {
					api = ctx.api;
					return {};
				} } );
				return api;
			};
		} );

		it( 'records an interaction once per layer and action', () => {
			const api = apiFor( { id: 'w1', type: 'woo', displayTime: 2 } );
			api.track( 'clicked', { product: 9 } );
			api.track( 'clicked' );

			expect( events ).toHaveLength( 1 );
			expect( events[ 0 ] ).toMatchObject( {
				key: '42',
				layer_id: 'w1',
				layer_type: 'woo',
				action_type: 'clicked',
				layer_timestamp: 2,
				layer_metadata: { parent_layer_id: 'w1', product: 9 },
			} );
		} );

		it( 'records nothing for a type analytics does not accept yet, and says so once', () => {
			const api = apiFor( { id: 'a1', type: 'acme/countdown' } );
			api.track( 'viewed' );
			api.track( 'clicked' );

			expect( events ).toEqual( [] );
			expect( info.mock.calls ).toEqual( [ [ 'GoDAM: analytics doesn\'t record layer type "acme/countdown" yet.' ] ] );
		} );
	} );
} );
