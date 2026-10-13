/**
 * Internal dependencies
 */
import LayersManager from './layersManager';

// The sub-managers do real DOM/player work; stub them so this spec is about the
// suppression gate alone, and expose jest.fn() methods to assert delegation.
jest.mock( './layers/formLayerManager.js', () => ( {
	__esModule: true,
	default: jest.fn().mockImplementation( () => ( {
		handleFormLayersTimeUpdate: jest.fn(),
		handlePause: jest.fn(),
		handleEnded: jest.fn(),
		sortLayers: jest.fn(),
	} ) ),
} ) );

jest.mock( './layers/hotspotLayerManager.js', () => ( {
	__esModule: true,
	default: jest.fn().mockImplementation( () => ( {
		handleHotspotLayersTimeUpdate: jest.fn(),
	} ) ),
} ) );

jest.mock( '../utils/pluginLoader.js', () => ( {
	loadFontAwesome: jest.fn( () => Promise.resolve() ),
	hasHotspotsWithIcons: jest.fn( () => false ),
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
	};
};

/**
 * Builds a LayersManager with stubbed sub-managers.
 *
 * @param {Object} player - Player stub.
 * @return {LayersManager} The manager under test.
 */
const createManager = ( player ) => {
	const video = document.createElement( 'video' );
	video.dataset.instanceId = '1';
	const config = { isPreviewEnabled: false, videoSetupOptions: { layers: [] } };
	return new LayersManager( player, video, config, {}, 'player-1' );
};

describe( 'LayersManager suppression gate', () => {
	it( 'defaults to not suppressed', () => {
		const manager = createManager( createPlayer() );
		expect( manager.areLayersSuppressed() ).toBe( false );
	} );

	it( 'is suppressed only when the predicate returns strictly true', () => {
		const manager = createManager( createPlayer() );

		manager.setSuppressionCheck( () => true );
		expect( manager.areLayersSuppressed() ).toBe( true );

		// A truthy-but-not-true value must not suppress (strict `=== true`).
		manager.setSuppressionCheck( () => 'yes' );
		expect( manager.areLayersSuppressed() ).toBe( false );

		manager.setSuppressionCheck( () => false );
		expect( manager.areLayersSuppressed() ).toBe( false );
	} );

	it( 'gates the form and hotspot timeupdate paths', () => {
		const manager = createManager( createPlayer() );
		manager.setSuppressionCheck( () => true );

		manager.handleFormLayersTimeUpdate( 5 );
		manager.handleHotspotLayersTimeUpdate( 5 );
		expect( manager.formLayerManager.handleFormLayersTimeUpdate ).not.toHaveBeenCalled();
		expect( manager.hotspotLayerManager.handleHotspotLayersTimeUpdate ).not.toHaveBeenCalled();

		manager.setSuppressionCheck( () => false );
		manager.handleFormLayersTimeUpdate( 5 );
		manager.handleHotspotLayersTimeUpdate( 5 );
		expect( manager.formLayerManager.handleFormLayersTimeUpdate ).toHaveBeenCalledWith( 5 );
		expect( manager.hotspotLayerManager.handleHotspotLayersTimeUpdate ).toHaveBeenCalledWith( 5 );
	} );

	it( 'gates the pause and ended CTA triggers', async () => {
		const player = createPlayer();
		const manager = createManager( player );
		await manager.setupLayers(); // registers the pause / ended handlers

		manager.setSuppressionCheck( () => true );
		player.emit( 'pause' );
		player.emit( 'ended' );
		expect( manager.formLayerManager.handlePause ).not.toHaveBeenCalled();
		expect( manager.formLayerManager.handleEnded ).not.toHaveBeenCalled();

		manager.setSuppressionCheck( () => false );
		player.emit( 'pause' );
		player.emit( 'ended' );
		expect( manager.formLayerManager.handlePause ).toHaveBeenCalled();
		expect( manager.formLayerManager.handleEnded ).toHaveBeenCalled();
	} );
} );
