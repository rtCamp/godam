/**
 * LayersManager suppression gate: while a hover preview plays, no layer may
 * appear — core, add-on, or created through GoDAMAPI (#2294).
 */

/**
 * Internal dependencies
 */
import LayersManager from './layersManager';
import { registerLayerRuntime } from '../../godam-layers/runtime/registry.js';

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
 * @param {Object} player - Player stub.
 * @return {Object} `{ manager, handlers }`; `handlers` holds the add-on's jest.fn() handlers.
 */
const createManager = ( player ) => {
	const handlers = {
		onTimeUpdate: jest.fn(),
		onPause: jest.fn(),
		onEnded: jest.fn(),
		onResize: jest.fn(),
	};
	registerLayerRuntime( 'acme/probe', { mount: () => handlers } );

	document.body.innerHTML = '<div id="layer-1-p"></div>';
	const video = document.createElement( 'video' );
	video.dataset.instanceId = '1';
	const config = { isPreviewEnabled: false, videoSetupOptions: { layers: [ { id: 'p', type: 'acme/probe' } ] } };
	return { manager: new LayersManager( player, video, config, {}, 'player-1' ), handlers };
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
