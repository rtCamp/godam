/**
 * Layer API contract tests (#2291, updated for #2294): how the player sets up
 * each saved layer.
 *
 * `LayersManager` mounts every saved layer through its type's runtime. The core
 * CTA, form and poll runtimes share one `FormLayerManager` per player, hotspots
 * share one `HotspotLayerManager`, and an add-on type registered through the old
 * `window.godamLayerRegistry` gets one instance of its manager class. A
 * runtime's `validate()` decides first whether a layer runs at all.
 */

/**
 * Internal dependencies
 */
import LayersManager from './layersManager';
import FormLayerManager from './layers/formLayerManager.js';
import HotspotLayerManager from './layers/hotspotLayerManager.js';
import { registerLayerType } from '../utils/layer-registry.js';
import { getLayerRuntime, shouldMountLayer, registerLayerRuntime, registerLayerRuntimeVariation } from '../../godam-layers/runtime/registry.js';
import { registerCoreLayerRuntimes } from '../layers/index.js';

jest.mock( './layers/formLayerManager.js', () => ( {
	__esModule: true,
	default: jest.fn().mockImplementation( () => ( {
		setupFormLayer: jest.fn(),
		handleFormLayersTimeUpdate: jest.fn(),
		handleFullscreenChange: jest.fn(),
		handlePause: jest.fn(),
		handleEnded: jest.fn(),
		handlePlay: jest.fn(),
		sortLayers: jest.fn(),
		replay: jest.fn(),
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

const overlayManager = () => FormLayerManager.mock.results.at( -1 ).value;
const hotspotManager = () => HotspotLayerManager.mock.results.at( -1 )?.value;
const formCalls = () => overlayManager().setupFormLayer.mock.calls.map( ( [ layer, element ] ) => [ layer, element ] );

describe( 'Layer API contract: LayersManager dispatch', () => {
	let info;

	beforeEach( () => {
		delete window.godam;
		delete window.godamLayerRegistry;
		window.godamPluginDependencies = allDependencies;
		FormLayerManager.mockClear();
		HotspotLayerManager.mockClear();
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		info = jest.spyOn( console, 'info' ).mockImplementation( () => {} );
	} );

	afterEach( () => {
		jest.restoreAllMocks();
		delete window.godamPluginDependencies;
	} );

	it( 'sends form, CTA and poll layers to the shared form manager with their container', async () => {
		const layers = [
			{ id: 'f', type: 'form', form_type: 'gravity' },
			{ id: 'c', type: 'cta' },
			{ id: 'p', type: 'poll' },
		];
		const { manager } = setup( layers );

		await manager.setupLayers();

		expect( FormLayerManager ).toHaveBeenCalledTimes( 1 );
		expect( formCalls() ).toEqual( [
			[ layers[ 0 ], containerFor( 'f' ) ],
			[ layers[ 1 ], containerFor( 'c' ) ],
			[ layers[ 2 ], containerFor( 'p' ) ],
		] );
		expect( HotspotLayerManager ).not.toHaveBeenCalled();
	} );

	it( 'gives each of them its type\'s behaviour', async () => {
		const { manager } = setup( [
			{ id: 'f', type: 'form', form_type: 'gravity' },
			{ id: 'c', type: 'cta', trigger: 'end_of_video' },
			{ id: 'p', type: 'poll' },
		] );
		await manager.setupLayers();

		const [ form, cta, poll ] = overlayManager().setupFormLayer.mock.calls.map( ( call ) => call[ 2 ] );
		expect( form ).toMatchObject( { conversionAction: 'submitted' } );
		expect( form.skipText() ).toBe( 'Skip Form' );
		expect( form.analyticsLabel() ).toBe( 'Gravity Forms' );
		expect( cta ).toMatchObject( { trackClicks: true } );
		expect( cta.skipText( { trigger: 'end_of_video' } ) ).toBe( 'Done' );
		expect( poll ).toMatchObject( { conversionAction: 'voted' } );
	} );

	it( 'sends hotspot layers to one shared hotspot manager', async () => {
		const layers = [ { id: 'h1', type: 'hotspot', hotspots: [] }, { id: 'h2', type: 'hotspot', hotspots: [] } ];
		const { manager, player, isDisplayingLayers } = setup( layers );
		await manager.setupLayers();

		expect( HotspotLayerManager ).toHaveBeenCalledTimes( 1 );
		expect( HotspotLayerManager ).toHaveBeenCalledWith( player, isDisplayingLayers, 'player-7' );
		expect( hotspotManager().setupHotspotLayer.mock.calls ).toEqual( [
			[ layers[ 0 ], containerFor( 'h1' ) ],
			[ layers[ 1 ], containerFor( 'h2' ) ],
		] );
	} );

	it( 'forwards each player event once to each shared manager', async () => {
		const { manager, player } = setup( [
			{ id: 'c1', type: 'cta' },
			{ id: 'c2', type: 'cta' },
			{ id: 'h', type: 'hotspot', hotspots: [] },
		] );
		await manager.setupLayers();

		manager.handleTimeUpdate( 3 );
		manager.handleFullscreenChange();
		manager.handleVideoResize();
		manager.handlePlay();

		expect( overlayManager().sortLayers ).toHaveBeenCalledTimes( 1 );
		expect( overlayManager().handleFormLayersTimeUpdate.mock.calls ).toEqual( [ [ 3 ] ] );
		expect( overlayManager().handleFullscreenChange ).toHaveBeenCalledWith( true, player.el() );
		expect( overlayManager().handlePlay ).toHaveBeenCalledTimes( 1 );
		expect( hotspotManager().handleHotspotLayersTimeUpdate.mock.calls ).toEqual( [ [ 3 ] ] );
		expect( hotspotManager().updateHotspotPositions ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'hides every layer container before handing it over', async () => {
		const { manager } = setup( [ { id: 'c', type: 'cta' } ] );
		await manager.setupLayers();
		expect( containerFor( 'c' ).classList.contains( 'hidden' ) ).toBe( true );
	} );

	it( 'gives the form manager to the public player API as player.layersManager', () => {
		const { player, isDisplayingLayers } = setup( [] );
		expect( FormLayerManager ).toHaveBeenCalledWith( player, isDisplayingLayers, 'player-7' );
		expect( player.layersManager ).toBe( overlayManager() );
	} );

	it( 'never sets the same container up twice', async () => {
		const layer = { id: 'c', type: 'cta' };
		const { manager } = setup( [ layer ] );
		await manager.setupLayers();
		manager.processLayer( layer );
		expect( overlayManager().setupFormLayer ).toHaveBeenCalledTimes( 1 );
	} );

	describe( 'add-on layer managers (window.godamLayerRegistry)', () => {
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
			const instance = AcmeManager.mock.instances[ 0 ];
			expect( instance.setupLayer.mock.calls ).toEqual( [
				[ layers[ 0 ], containerFor( 'a1' ) ],
				[ layers[ 1 ], containerFor( 'a2' ) ],
			] );
		} );

		it( 'forwards time updates, resizes and fullscreen changes to add-on managers', async () => {
			const AcmeManager = makeAddonManager();
			registerLayerType( 'acme', { label: 'Acme', validator: () => true, manager: AcmeManager } );
			const { manager, player } = setup( [ { id: 'a1', type: 'acme' } ] );
			await manager.setupLayers();
			const instance = AcmeManager.mock.instances[ 0 ];

			manager.handleTimeUpdate( 4.5 );
			manager.handleVideoResize();
			manager.handleFullscreenChange();

			expect( instance.handleTimeUpdate ).toHaveBeenCalledWith( 4.5 );
			expect( instance.handleResize ).toHaveBeenCalled();
			expect( instance.handleFullscreenChange ).toHaveBeenCalledWith( true, player.el() );
		} );

		it( 'holds add-on time updates back while layers are suppressed', async () => {
			const AcmeManager = makeAddonManager();
			registerLayerType( 'acme', { label: 'Acme', validator: () => true, manager: AcmeManager } );
			const { manager } = setup( [ { id: 'a1', type: 'acme' } ] );
			await manager.setupLayers();
			manager.setSuppressionCheck( () => true );

			manager.handleTimeUpdate( 4.5 );

			expect( AcmeManager.mock.instances[ 0 ].handleTimeUpdate ).not.toHaveBeenCalled();
		} );

		it( 'tolerates an add-on manager that implements none of the optional handlers', async () => {
			registerLayerType( 'acme', { label: 'Acme', validator: () => true, manager: function Bare() {} } );
			const { manager } = setup( [ { id: 'a1', type: 'acme' } ] );
			await manager.setupLayers();
			expect( () => {
				manager.handleTimeUpdate( 1 );
				manager.handleVideoResize();
				manager.handleFullscreenChange();
			} ).not.toThrow();
		} );
	} );

	describe( 'add-on layer runtimes (registerLayerRuntime)', () => {
		it( 'mounts each layer with its container, player and api', async () => {
			const mount = jest.fn( () => ( {} ) );
			registerLayerRuntime( 'acme/countdown', { mount } );
			const layer = { id: 'a', type: 'acme/countdown' };
			const { manager, player } = setup( [ layer ] );
			await manager.setupLayers();

			expect( mount ).toHaveBeenCalledTimes( 1 );
			const ctx = mount.mock.calls[ 0 ][ 0 ];
			expect( ctx.layer ).toBe( layer );
			expect( ctx.container ).toBe( containerFor( 'a' ) );
			expect( ctx.player ).toBe( player );
			expect( ctx.media.type ).toBe( 'video' );
			expect( ctx.instanceId ).toBe( 'player-7' );
			expect( Object.keys( ctx.api ).sort() ).toEqual( [ 'currentTime', 'hide', 'isSuppressed', 'isVisible', 'pause', 'play', 'seek', 'show', 'track' ] );
			ctx.api.show();
			expect( containerFor( 'a' ).classList.contains( 'hidden' ) ).toBe( false );
		} );

		it( 'keeps going when one layer fails to mount', async () => {
			const error = jest.spyOn( console, 'error' ).mockImplementation( () => {} );
			registerLayerRuntime( 'acme/broken', {
				mount: () => {
					throw new Error( 'boom' );
				},
			} );
			const { manager } = setup( [ { id: 'b', type: 'acme/broken' }, { id: 'c', type: 'cta' } ] );
			await manager.setupLayers();

			expect( error ).toHaveBeenCalledWith( 'GoDAM: layer "b" (acme/broken) failed to mount.', expect.any( Error ) );
			expect( formCalls() ).toEqual( [ [ { id: 'c', type: 'cta' }, containerFor( 'c' ) ] ] );
		} );
	} );

	describe( 'layers that are skipped', () => {
		it( 'skips a layer with no container in the page', async () => {
			const { manager } = setup( [ { id: 'c', type: 'cta' } ], { skip: [ 'c' ] } );
			await manager.setupLayers();
			expect( overlayManager().setupFormLayer ).not.toHaveBeenCalled();
		} );

		it( 'skips a type nothing registered, logging it once', async () => {
			const { manager } = setup( [ { id: 'g1', type: 'ghost' }, { id: 'g2', type: 'ghost' } ] );
			await expect( manager.setupLayers() ).resolves.toBeUndefined();
			expect( overlayManager().setupFormLayer ).not.toHaveBeenCalled();
			expect( HotspotLayerManager ).not.toHaveBeenCalled();
			expect( info ).toHaveBeenCalledTimes( 1 );
			expect( info ).toHaveBeenCalledWith( 'GoDAM: no runtime registered for layer type "ghost".' );
			expect( containerFor( 'g1' ).classList.contains( 'hidden' ) ).toBe( true );
		} );

		it( 'skips a layer its runtime rejects', async () => {
			window.godamPluginDependencies = { gravityforms: false };
			const { manager } = setup( [ { id: 'f', type: 'form', form_type: 'gravity' } ] );
			await manager.setupLayers();
			expect( overlayManager().setupFormLayer ).not.toHaveBeenCalled();
		} );

		it( 'sets nothing up in preview mode', async () => {
			const { manager } = setup( [ { id: 'c', type: 'cta' } ], { extra: { isPreviewEnabled: true } } );
			await manager.setupLayers();
			expect( overlayManager().setupFormLayer ).not.toHaveBeenCalled();
		} );
	} );
} );

describe( 'Layer API contract: which layers run', () => {
	const runs = ( layer ) => shouldMountLayer( getLayerRuntime( layer.type ), layer );

	beforeEach( () => {
		delete window.godam;
		registerCoreLayerRuntimes();
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
		expect( runs( layer ) ).toBe( true );
		window.godamPluginDependencies = { [ dependency ]: false };
		expect( runs( layer ) ).toBe( false );
	} );

	it( 'rejects a form layer whose form_type no provider registered', () => {
		window.godamPluginDependencies = { gravityforms: true };
		expect( runs( { type: 'form', form_type: 'mystery' } ) ).toBe( false );
		expect( runs( { type: 'form' } ) ).toBe( false );
	} );

	it( 'runs a form layer from an add-on provider', () => {
		registerLayerRuntimeVariation( 'form', { name: 'acme', title: 'Acme Forms', isAvailable: ( deps ) => Boolean( deps?.acme ) } );
		window.godamPluginDependencies = { acme: true };
		expect( runs( { type: 'form', form_type: 'acme' } ) ).toBe( true );
	} );

	it( 'runs a poll layer only when WP-Polls is active', () => {
		window.godamPluginDependencies = { wpPolls: false };
		expect( runs( { type: 'poll' } ) ).toBe( false );
		window.godamPluginDependencies = { wpPolls: true };
		expect( runs( { type: 'poll' } ) ).toBe( true );
	} );

	it.each( [ 'cta', 'hotspot' ] )( 'always runs a %s layer', ( type ) => {
		window.godamPluginDependencies = {};
		expect( runs( { type } ) ).toBe( true );
	} );

	it( 'never runs a type with no runtime', () => {
		expect( shouldMountLayer( getLayerRuntime( 'ghost' ), { type: 'ghost' } ) ).toBe( false );
	} );

	it( 'asks a registered validator, passing the layer and godamPluginDependencies', () => {
		const deps = { acmePlugin: true };
		window.godamPluginDependencies = deps;
		const validator = jest.fn( () => false );
		registerLayerType( 'acme', { label: 'Acme', validator } );
		const layer = { type: 'acme' };

		expect( runs( layer ) ).toBe( false );
		expect( validator ).toHaveBeenCalledWith( layer, deps );
	} );

	// Changed in #2294: core types are registered runtimes now, so the old
	// registry can no longer replace one.
	it( 'keeps a core type\'s own check when an add-on registers the same id', () => {
		window.godamPluginDependencies = { wpPolls: false };
		expect( registerLayerType( 'poll', { label: 'Poll', validator: () => true } ) ).toBe( false );
		expect( runs( { type: 'poll' } ) ).toBe( false );
	} );
} );
