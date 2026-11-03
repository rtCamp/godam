/**
 * Layer API contract tests (#2291): how the player sets up each saved layer.
 *
 * `LayersManager` sends form, CTA and poll layers to `FormLayerManager`, hotspot
 * layers to `HotspotLayerManager`, and any other type to the manager an add-on
 * registered in the layer registry. `LayerValidator` decides first whether a
 * layer runs at all. #2294 replaces this with one lifecycle; these tests are
 * what it must keep passing. Tests marked "current behaviour" pin something
 * #2294 intends to change on purpose.
 */

/**
 * Internal dependencies
 */
import LayersManager from './layersManager';
import LayerValidator from './layers/layerValidator';
import FormLayerManager from './layers/formLayerManager.js';
import HotspotLayerManager from './layers/hotspotLayerManager.js';
import { registerLayerType } from '../utils/layer-registry.js';

jest.mock( './layers/formLayerManager.js', () => ( {
	__esModule: true,
	default: jest.fn().mockImplementation( () => ( {
		setupFormLayer: jest.fn(),
		handleFormLayersTimeUpdate: jest.fn(),
		handleFullscreenChange: jest.fn(),
		handlePause: jest.fn(),
		handleEnded: jest.fn(),
		sortLayers: jest.fn(),
		formLayers: [],
	} ) ),
} ) );

jest.mock( './layers/hotspotLayerManager.js', () => ( {
	__esModule: true,
	default: jest.fn().mockImplementation( () => ( {
		setupHotspotLayer: jest.fn(),
		handleHotspotLayersTimeUpdate: jest.fn(),
		handleFullscreenChange: jest.fn(),
		updateHotspotPositions: jest.fn(),
	} ) ),
} ) );

jest.mock( '../utils/pluginLoader.js', () => ( {
	loadFontAwesome: jest.fn( () => Promise.resolve() ),
	hasHotspotsWithIcons: jest.fn( () => false ),
} ) );

const allDependencies = { gravityforms: true, wpPolls: true };

const createPlayer = () => {
	const container = document.createElement( 'div' );
	return {
		on: jest.fn(),
		el: () => container,
		isFullscreen: () => true,
	};
};

/**
 * Build a manager plus the `#layer-<instance>-<id>` containers the PHP template prints.
 *
 * @param {Array}  layers          Saved layers.
 * @param {Object} [options]       Options.
 * @param {Array}  [options.skip]  Layer ids to print no container for.
 * @param {Object} [options.extra] Extra config.
 * @return {Object} `{ manager, player, isDisplayingLayers }`.
 */
const setup = ( layers, { skip = [], extra = {} } = {} ) => {
	document.body.innerHTML = '';
	layers.forEach( ( layer ) => {
		if ( ! skip.includes( layer.id ) ) {
			const el = document.createElement( 'div' );
			el.id = `layer-7-${ layer.id }`;
			document.body.appendChild( el );
		}
	} );

	const video = document.createElement( 'video' );
	video.dataset.instanceId = '7';
	const player = createPlayer();
	const isDisplayingLayers = {};
	const config = { isPreviewEnabled: false, videoSetupOptions: { layers }, ...extra };
	const manager = new LayersManager( player, video, config, isDisplayingLayers, 'player-7' );
	return { manager, player, isDisplayingLayers };
};

const containerFor = ( id ) => document.getElementById( `layer-7-${ id }` );

describe( 'Layer API contract: LayersManager dispatch', () => {
	beforeEach( () => {
		delete window.__godamLayerRegistryStore;
		window.godamPluginDependencies = allDependencies;
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		delete window.godamPluginDependencies;
	} );

	it( 'sends form, CTA and poll layers to the form manager with their container', async () => {
		const layers = [
			{ id: 'f', type: 'form', form_type: 'gravity' },
			{ id: 'c', type: 'cta' },
			{ id: 'p', type: 'poll' },
		];
		const { manager } = setup( layers );

		await manager.setupLayers();

		expect( manager.formLayerManager.setupFormLayer.mock.calls ).toEqual( [
			[ layers[ 0 ], containerFor( 'f' ) ],
			[ layers[ 1 ], containerFor( 'c' ) ],
			[ layers[ 2 ], containerFor( 'p' ) ],
		] );
		expect( manager.hotspotLayerManager.setupHotspotLayer ).not.toHaveBeenCalled();
	} );

	it( 'sends hotspot layers to the hotspot manager', async () => {
		const layer = { id: 'h', type: 'hotspot', hotspots: [] };
		const { manager } = setup( [ layer ] );
		await manager.setupLayers();
		expect( manager.hotspotLayerManager.setupHotspotLayer ).toHaveBeenCalledWith( layer, containerFor( 'h' ) );
	} );

	it( 'hides every layer container before handing it over', async () => {
		const { manager } = setup( [ { id: 'c', type: 'cta' } ] );
		await manager.setupLayers();
		expect( containerFor( 'c' ).classList.contains( 'hidden' ) ).toBe( true );
	} );

	it( 'gives the form manager to the public player API as player.layersManager', () => {
		const { manager, player } = setup( [] );
		expect( player.layersManager ).toBe( manager.formLayerManager );
	} );

	it( 'creates the sub-managers with ( player, isDisplayingLayers, instanceId )', () => {
		FormLayerManager.mockClear();
		HotspotLayerManager.mockClear();
		const { player, isDisplayingLayers } = setup( [] );
		expect( FormLayerManager ).toHaveBeenCalledWith( player, isDisplayingLayers, 'player-7' );
		expect( HotspotLayerManager ).toHaveBeenCalledWith( player, isDisplayingLayers, 'player-7' );
	} );

	describe( 'add-on layer managers', () => {
		const makeAddonManager = () =>
			jest.fn().mockImplementation( function AcmeManager() {
				this.setupLayer = jest.fn();
				this.handleTimeUpdate = jest.fn();
				this.handleResize = jest.fn();
				this.handleFullscreenChange = jest.fn();
			} );

		it( 'creates one registered manager per type and sends it each layer of that type', async () => {
			const AcmeManager = makeAddonManager();
			registerLayerType( 'acme', { label: 'Acme', validator: () => true, manager: AcmeManager } );
			const layers = [ { id: 'a1', type: 'acme' }, { id: 'a2', type: 'acme' } ];
			const { manager, player, isDisplayingLayers } = setup( layers );

			await manager.setupLayers();

			expect( AcmeManager ).toHaveBeenCalledTimes( 1 );
			expect( AcmeManager ).toHaveBeenCalledWith( player, isDisplayingLayers, 'player-7' );
			const instance = manager.customLayerManagers.acme;
			expect( instance.setupLayer.mock.calls ).toEqual( [
				[ layers[ 0 ], containerFor( 'a1' ) ],
				[ layers[ 1 ], containerFor( 'a2' ) ],
			] );
		} );

		it( 'forwards time updates, resizes and fullscreen changes to add-on managers', async () => {
			registerLayerType( 'acme', { label: 'Acme', validator: () => true, manager: makeAddonManager() } );
			const { manager, player } = setup( [ { id: 'a1', type: 'acme' } ] );
			await manager.setupLayers();
			const instance = manager.customLayerManagers.acme;

			manager.handleCustomLayersTimeUpdate( 4.5 );
			manager.handleVideoResize();
			manager.handleFullscreenChange();

			expect( instance.handleTimeUpdate ).toHaveBeenCalledWith( 4.5 );
			expect( instance.handleResize ).toHaveBeenCalled();
			expect( instance.handleFullscreenChange ).toHaveBeenCalledWith( true, player.el() );
		} );

		it( 'holds add-on time updates back while layers are suppressed', async () => {
			registerLayerType( 'acme', { label: 'Acme', validator: () => true, manager: makeAddonManager() } );
			const { manager } = setup( [ { id: 'a1', type: 'acme' } ] );
			await manager.setupLayers();
			manager.setSuppressionCheck( () => true );

			manager.handleCustomLayersTimeUpdate( 4.5 );

			expect( manager.customLayerManagers.acme.handleTimeUpdate ).not.toHaveBeenCalled();
		} );

		it( 'tolerates an add-on manager that implements none of the optional handlers', async () => {
			registerLayerType( 'acme', { label: 'Acme', validator: () => true, manager: function Bare() {} } );
			const { manager } = setup( [ { id: 'a1', type: 'acme' } ] );
			await manager.setupLayers();
			expect( () => {
				manager.handleCustomLayersTimeUpdate( 1 );
				manager.handleVideoResize();
				manager.handleFullscreenChange();
			} ).not.toThrow();
		} );
	} );

	describe( 'layers that are skipped', () => {
		it( 'skips a layer with no container in the page', async () => {
			const { manager } = setup( [ { id: 'c', type: 'cta' } ], { skip: [ 'c' ] } );
			await manager.setupLayers();
			expect( manager.formLayerManager.setupFormLayer ).not.toHaveBeenCalled();
		} );

		it( 'skips a type nothing registered, without throwing', async () => {
			const { manager } = setup( [ { id: 'g', type: 'ghost' } ] );
			await expect( manager.setupLayers() ).resolves.toBeUndefined();
			expect( manager.formLayerManager.setupFormLayer ).not.toHaveBeenCalled();
			expect( manager.hotspotLayerManager.setupHotspotLayer ).not.toHaveBeenCalled();
			expect( manager.customLayerManagers ).toEqual( {} );
		} );

		it( 'skips a layer its validator rejects', async () => {
			window.godamPluginDependencies = { gravityforms: false };
			const { manager } = setup( [ { id: 'f', type: 'form', form_type: 'gravity' } ] );
			await manager.setupLayers();
			expect( manager.formLayerManager.setupFormLayer ).not.toHaveBeenCalled();
		} );

		it( 'sets nothing up in preview mode', async () => {
			const { manager } = setup( [ { id: 'c', type: 'cta' } ], { extra: { isPreviewEnabled: true } } );
			await manager.setupLayers();
			expect( manager.formLayerManager.setupFormLayer ).not.toHaveBeenCalled();
		} );
	} );
} );

describe( 'Layer API contract: LayerValidator', () => {
	beforeEach( () => {
		delete window.__godamLayerRegistryStore;
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		delete window.godamPluginDependencies;
	} );

	it.each( [
		[ 'gravity', 'gravityforms' ],
		[ 'wpforms', 'wpforms' ],
		[ 'everestforms', 'everestForms' ],
		[ 'cf7', 'cf7' ],
		[ 'jetpack', 'jetpack' ],
		[ 'sureforms', 'sureforms' ],
		[ 'forminator', 'forminator' ],
		[ 'fluentforms', 'fluentForms' ],
		[ 'ninjaforms', 'ninjaForms' ],
		[ 'metform', 'metform' ],
		[ 'marketo', 'marketo' ],
		[ 'hubspot', 'hubspot' ],
	] )( 'runs a %s form layer only when godamPluginDependencies.%s is set', ( formType, dependency ) => {
		const layer = { type: 'form', form_type: formType };
		window.godamPluginDependencies = { [ dependency ]: true };
		expect( LayerValidator.shouldProcessLayer( layer ) ).toBe( true );
		window.godamPluginDependencies = { [ dependency ]: false };
		expect( LayerValidator.shouldProcessLayer( layer ) ).toBe( false );
	} );

	it( 'rejects a form layer whose form_type it does not know', () => {
		window.godamPluginDependencies = { gravityforms: true };
		expect( LayerValidator.shouldProcessLayer( { type: 'form', form_type: 'mystery' } ) ).toBe( false );
	} );

	it( 'runs a poll layer only when WP-Polls is active', () => {
		window.godamPluginDependencies = { wpPolls: false };
		expect( LayerValidator.shouldProcessLayer( { type: 'poll' } ) ).toBe( false );
	} );

	it.each( [ 'cta', 'hotspot' ] )( 'always runs a %s layer', ( type ) => {
		window.godamPluginDependencies = {};
		expect( LayerValidator.shouldProcessLayer( { type } ) ).toBe( true );
	} );

	// Current behaviour: an unknown type passes validation and is dropped later by dispatch.
	it( 'lets a type with no validator through', () => {
		expect( LayerValidator.shouldProcessLayer( { type: 'ghost' } ) ).toBe( true );
	} );

	it( 'asks a registered validator, passing the layer and godamPluginDependencies', () => {
		const deps = { acmePlugin: true };
		window.godamPluginDependencies = deps;
		const validator = jest.fn( () => false );
		registerLayerType( 'acme', { label: 'Acme', validator } );
		const layer = { type: 'acme' };

		expect( LayerValidator.shouldProcessLayer( layer ) ).toBe( false );
		expect( validator ).toHaveBeenCalledWith( layer, deps );
	} );

	// Current behaviour: registering a core type id replaces that type's built-in check.
	it( 'lets a registered validator take over a core type', () => {
		window.godamPluginDependencies = { wpPolls: false };
		registerLayerType( 'poll', { label: 'Poll', validator: () => true } );
		expect( LayerValidator.shouldProcessLayer( { type: 'poll' } ) ).toBe( true );
	} );
} );
