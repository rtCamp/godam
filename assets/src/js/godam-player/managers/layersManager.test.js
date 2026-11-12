/**
 * LayersManager suppression gate: while a hover preview plays, no layer may
 * appear — core, add-on, or created through GoDAMAPI (#2294).
 */

/**
 * Internal dependencies
 */
import LayersManager from './layersManager';
import { registerLayerRuntime, registerLayerRuntimeVariation } from '../../godam-layers/runtime/registry.js';

jest.mock( '../utils/pluginLoader.js', () => ( {
	loadFontAwesome: jest.fn( () => Promise.resolve() ),
} ) );

/**
 * Minimal Video.js player stub that records event handlers for dispatch.
 *
 * @return {Object} Stub player with an `emit( event )` test helper.
 */
const createPlayer = () => {
	const handlers = {};
	return {
		on: ( event, cb ) => ( handlers[ event ] = handlers[ event ] || [] ).push( cb ),
		emit: ( event ) => ( handlers[ event ] || [] ).forEach( ( cb ) => cb() ),
		el: () => document.body,
		isFullscreen: () => false,
	};
};

/**
 * Builds a LayersManager with one add-on layer on the page.
 *
 * @param {Object}  player                     - Player stub.
 * @param {Object}  [options]                  - Options.
 * @param {boolean} [options.isPreviewEnabled] - Whether the video has the hover preview (`preview="true"`).
 * @return {Object} `{ manager, handlers, mount }`; `handlers` holds the add-on's jest.fn() handlers.
 */
const createManager = ( player, { isPreviewEnabled = false } = {} ) => {
	const handlers = {
		onTimeUpdate: jest.fn(),
		onPause: jest.fn(),
		onEnded: jest.fn(),
		onResize: jest.fn(),
	};
	const mount = jest.fn( () => handlers );
	registerLayerRuntime( 'acme/probe', { mount } );

	document.body.innerHTML = '<div id="layer-1-p"></div>';
	const video = document.createElement( 'video' );
	video.dataset.instanceId = '1';
	const config = { isPreviewEnabled, videoSetupOptions: { layers: [ { id: 'p', type: 'acme/probe' } ] } };
	return { manager: new LayersManager( player, video, config, {}, 'player-1' ), handlers, mount };
};

describe( 'LayersManager suppression gate', () => {
	afterEach( () => {
		delete window.godam;
	} );

	it( 'defaults to not suppressed', () => {
		const { manager } = createManager( createPlayer() );
		expect( manager.areLayersSuppressed() ).toBe( false );
	} );

	it( 'is suppressed only when the predicate returns strictly true', () => {
		const { manager } = createManager( createPlayer() );

		manager.setSuppressionCheck( () => true );
		expect( manager.areLayersSuppressed() ).toBe( true );

		// A truthy-but-not-true value must not suppress (strict `=== true`).
		manager.setSuppressionCheck( () => 'yes' );
		expect( manager.areLayersSuppressed() ).toBe( false );

		manager.setSuppressionCheck( () => false );
		expect( manager.areLayersSuppressed() ).toBe( false );
	} );

	it( 'holds time updates back from every layer while suppressed', async () => {
		const { manager, handlers } = createManager( createPlayer() );
		await manager.setupLayers();

		manager.setSuppressionCheck( () => true );
		manager.handleTimeUpdate( 5 );
		expect( handlers.onTimeUpdate ).not.toHaveBeenCalled();

		manager.setSuppressionCheck( () => false );
		manager.handleTimeUpdate( 5 );
		expect( handlers.onTimeUpdate ).toHaveBeenCalledWith( 5 );
	} );

	it( 'holds the pause and ended triggers back while suppressed', async () => {
		const player = createPlayer();
		const { manager, handlers } = createManager( player );
		await manager.setupLayers(); // registers the pause / ended handlers

		manager.setSuppressionCheck( () => true );
		player.emit( 'pause' );
		player.emit( 'ended' );
		expect( handlers.onPause ).not.toHaveBeenCalled();
		expect( handlers.onEnded ).not.toHaveBeenCalled();

		manager.setSuppressionCheck( () => false );
		player.emit( 'pause' );
		player.emit( 'ended' );
		expect( handlers.onPause ).toHaveBeenCalled();
		expect( handlers.onEnded ).toHaveBeenCalled();
	} );

	it( 'keeps resizing layers while suppressed', async () => {
		const { manager, handlers } = createManager( createPlayer() );
		await manager.setupLayers();
		manager.setSuppressionCheck( () => true );

		manager.handleVideoResize();

		expect( handlers.onResize ).toHaveBeenCalled();
	} );
} );

describe( 'LayersManager on a video with the hover preview', () => {
	afterEach( () => {
		delete window.godam;
	} );

	it( 'mounts no layer while the preview plays', async () => {
		const { manager, mount } = createManager( createPlayer(), { isPreviewEnabled: true } );
		await manager.setupLayers();
		manager.handlePreviewStateChange( true );

		expect( mount ).not.toHaveBeenCalled();
	} );

	it( 'mounts the saved layers and their triggers once real playback starts', async () => {
		const player = createPlayer();
		const { manager, handlers, mount } = createManager( player, { isPreviewEnabled: true } );
		await manager.setupLayers();

		manager.handlePreviewStateChange( false );
		manager.handleTimeUpdate( 3 );
		player.emit( 'pause' );
		player.emit( 'ended' );

		expect( mount ).toHaveBeenCalledTimes( 1 );
		expect( handlers.onTimeUpdate ).toHaveBeenCalledWith( 3 );
		expect( handlers.onPause ).toHaveBeenCalledTimes( 1 );
		expect( handlers.onEnded ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'mounts the layers and installs the triggers only once', async () => {
		const player = createPlayer();
		const { manager, handlers, mount } = createManager( player, { isPreviewEnabled: true } );
		await manager.setupLayers();

		manager.handlePreviewStateChange( false );
		manager.handlePreviewStateChange( true );
		manager.handlePreviewStateChange( false );
		player.emit( 'pause' );

		expect( mount ).toHaveBeenCalledTimes( 1 );
		expect( handlers.onPause ).toHaveBeenCalledTimes( 1 );
	} );
} );

describe( 'LayersManager with view scripts that load late', () => {
	afterEach( () => {
		delete window.godam;
		document.body.innerHTML = '';
	} );

	const createManagerFor = ( layers ) => {
		document.body.innerHTML = layers.map( ( { id } ) => `<div id="layer-1-${ id }"></div>` ).join( '' );
		const video = document.createElement( 'video' );
		video.dataset.instanceId = '1';
		const config = { isPreviewEnabled: false, videoSetupOptions: { layers } };
		return new LayersManager( createPlayer(), video, config, {}, 'player-1' );
	};

	it( 'mounts a layer once its variation (e.g. an add-on form provider) registers', async () => {
		const mount = jest.fn( () => ( {} ) );
		registerLayerRuntime( 'acme/forms', {
			mount,
			variationAttribute: 'provider',
			validate: ( layer ) => Boolean( window.godam.layers.getLayerRuntimeVariation( 'acme/forms', layer ) ),
		} );
		await createManagerFor( [ { id: 'f', type: 'acme/forms', provider: 'late' } ] ).setupLayers();
		expect( mount ).not.toHaveBeenCalled();

		registerLayerRuntimeVariation( 'acme/forms', { name: 'late' } );

		expect( mount ).toHaveBeenCalledTimes( 1 );
		expect( mount.mock.calls[ 0 ][ 0 ].layer.id ).toBe( 'f' );
	} );

	it( 'keeps mounting the other layers when an add-on\'s validate() throws', async () => {
		const error = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
		const mount = jest.fn( () => ( {} ) );
		registerLayerRuntime( 'acme/broken', {
			mount,
			validate: () => {
				throw new Error( 'boom' );
			},
		} );
		registerLayerRuntime( 'acme/fine', { mount } );

		const manager = createManagerFor( [ { id: 'b', type: 'acme/broken' }, { id: 'ok', type: 'acme/fine' } ] );
		await expect( manager.setupLayers() ).resolves.toBeUndefined();

		expect( mount.mock.calls.map( ( [ ctx ] ) => ctx.layer.id ) ).toEqual( [ 'ok' ] );
		error.mockRestore();
	} );
} );
