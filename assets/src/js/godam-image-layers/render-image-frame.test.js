/**
 * Layer API contract tests (#2291): layers on a `godam/image` block.
 *
 * The image renderer draws `hotspot` layers itself and hands `woo` layers to
 * the manager godam-for-woo registered in the layer registry. No other type is
 * drawn. #2294 moves images onto the shared layer lifecycle; tests marked
 * "current behaviour" pin what it intends to change on purpose.
 */

/**
 * Internal dependencies
 */
import { initImageFrame } from './render-image-frame.js';
import HotspotLayerManager from '../godam-player/managers/layers/hotspotLayerManager.js';
import { registerLayerType } from '../godam-player/utils/layer-registry.js';

jest.mock( '../godam-player/managers/layers/hotspotLayerManager.js', () => ( {
	__esModule: true,
	default: jest.fn().mockImplementation( function MockHotspotLayerManager() {
		this.hotspotLayers = [];
		this.setupHotspotLayer = jest.fn( ( layer ) => this.hotspotLayers.push( { layer } ) );
		this.createHotspots = jest.fn();
		this.updateHotspotPositions = jest.fn();
	} ),
} ) );

jest.mock( '../godam-player/utils/pluginLoader.js', () => ( {
	loadFontAwesome: jest.fn( () => Promise.resolve() ),
	hasHotspotsWithIcons: jest.fn( () => false ),
	renderFontAwesomeIcons: jest.fn(),
} ) );

/**
 * Build the frame markup `godam-image/render.php` prints, with an already-loaded image.
 *
 * @param {Array} layers Saved layers.
 * @return {HTMLElement} The `.godam-image__frame` element.
 */
const makeFrame = ( layers ) => {
	const frame = document.createElement( 'div' );
	frame.className = 'godam-image__frame';
	frame.dataset.godamImageLayers = JSON.stringify( layers );
	frame.dataset.instanceId = 'img-1';
	frame.innerHTML = '<img src="x.jpg" alt=""><div class="easydam-layer godam-image-layer"></div>';
	const img = frame.querySelector( 'img' );
	Object.defineProperty( img, 'complete', { value: true } );
	Object.defineProperty( img, 'naturalWidth', { value: 800 } );
	document.body.appendChild( frame );
	return frame;
};

const makeWooManager = () =>
	jest.fn().mockImplementation( function WooManager() {
		this.wooLayers = [];
		this.setupLayer = jest.fn( ( layer ) => this.wooLayers.push( { layer } ) );
		this.createProductHotspots = jest.fn();
		this.emitLayerVisible = jest.fn();
	} );

describe( 'Layer API contract: image layers', () => {
	let teardowns;

	beforeEach( () => {
		delete window.__godamLayerRegistryStore;
		HotspotLayerManager.mockClear();
		teardowns = [];
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
	} );

	afterEach( () => {
		teardowns.forEach( ( teardown ) => teardown() );
		document.body.innerHTML = '';
		jest.restoreAllMocks();
	} );

	const init = ( frame ) => {
		const teardown = initImageFrame( frame );
		teardowns.push( teardown );
		return teardown;
	};

	it( 'merges every hotspot layer into one hotspot manager layer', () => {
		init( makeFrame( [
			{ id: 'h1', type: 'hotspot', hotspots: [ { id: 's1' } ] },
			{ id: 'h2', type: 'hotspot', hotspots: [ { id: 's2' } ] },
		] ) );

		expect( HotspotLayerManager ).toHaveBeenCalledTimes( 1 );
		const manager = HotspotLayerManager.mock.instances[ 0 ];
		const [ merged ] = manager.setupHotspotLayer.mock.calls[ 0 ];
		expect( merged ).toMatchObject( { id: 'godam-image-hotspots', type: 'hotspot' } );
		expect( merged.hotspots.map( ( h ) => h.id ) ).toEqual( [ 's1', 's2' ] );
		expect( manager.createHotspots ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'hands each woo layer to the registered woo manager and fires its impression', () => {
		const WooManager = makeWooManager();
		registerLayerType( 'woo', { label: 'Woo', validator: () => true, manager: WooManager } );
		const layers = [ { id: 'w1', type: 'woo' }, { id: 'w2', type: 'woo' } ];
		const frame = makeFrame( layers );

		init( frame );

		expect( WooManager ).toHaveBeenCalledTimes( 1 );
		expect( WooManager.mock.calls[ 0 ][ 2 ] ).toBe( 'img-1' );
		const manager = WooManager.mock.instances[ 0 ];
		expect( manager.setupLayer.mock.calls.map( ( [ layer ] ) => layer ) ).toEqual( layers );
		expect( manager.createProductHotspots ).toHaveBeenCalledTimes( 2 );
		expect( manager.emitLayerVisible.mock.calls ).toEqual( [ [ layers[ 0 ] ], [ layers[ 1 ] ] ] );
		expect( frame.dataset.godamLayersRendered ).toBe( 'true' );
	} );

	it( 'skips woo layers when no woo manager is registered', () => {
		const frame = makeFrame( [ { id: 'w1', type: 'woo' } ] );
		init( frame );
		expect( frame.dataset.godamLayersRendered ).toBe( 'true' );
		expect( frame.querySelector( '.godam-image-woo-layer' ) ).toBeNull();
	} );

	// Current behaviour: only `hotspot` and `woo` draw on images, even when another
	// type has a registered manager. #2294 lets any type that supports images draw.
	it( 'ignores any other type, even one with a registered manager', () => {
		const AcmeManager = makeWooManager();
		registerLayerType( 'acme', { label: 'Acme', validator: () => true, manager: AcmeManager } );
		const frame = makeFrame( [ { id: 'a1', type: 'acme' }, { id: 'c1', type: 'cta' } ] );

		init( frame );

		expect( AcmeManager ).not.toHaveBeenCalled();
		expect( HotspotLayerManager ).not.toHaveBeenCalled();
		expect( frame.dataset.godamLayersRendered ).toBe( 'true' );
	} );

	it( 'draws nothing for a frame with no layers', () => {
		const frame = makeFrame( [] );
		init( frame );
		expect( frame.dataset.godamLayersRendered ).toBeUndefined();
	} );

	it( 'returns the same teardown when a frame is initialized twice', () => {
		const frame = makeFrame( [ { id: 'h1', type: 'hotspot', hotspots: [] } ] );
		const first = init( frame );
		expect( initImageFrame( frame ) ).toBe( first );
		expect( HotspotLayerManager ).toHaveBeenCalledTimes( 1 );
	} );
} );
