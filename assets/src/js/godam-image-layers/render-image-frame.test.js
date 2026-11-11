/**
 * Layer API contract tests (#2291, updated for #2294): layers on a `godam/image` block.
 *
 * Images mount layers through the same runtimes as video. Only runtimes that
 * support images run: the core Hotspot runtime, and an add-on manager from the
 * old registry that has the image methods godam-for-woo's manager has.
 */

/**
 * Internal dependencies
 */
import { initImageFrame } from './render-image-frame.js';
import HotspotLayerManager from '../godam-player/managers/layers/hotspotLayerManager.js';
import { registerLayerType } from '../godam-player/utils/layer-registry.js';
import { registerLayerRuntime, unregisterLayerRuntime } from '../godam-layers/runtime/registry.js';
import { registerHotspotRuntime } from '../../layers/hotspot/view.js';

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

// A stand-in for godam-for-woo's manager class: its image methods live on the
// prototype, like the real class's, with per-instance spies on top.
const makeWooManager = () => {
	const WooManager = jest.fn().mockImplementation( function WooManager() {
		this.wooLayers = [];
		this.setupLayer = jest.fn( ( layer ) => this.wooLayers.push( { layer } ) );
		this.createProductHotspots = jest.fn();
		this.emitLayerVisible = jest.fn();
	} );
	WooManager.prototype.createProductHotspots = () => {};
	return WooManager;
};

describe( 'Layer API contract: image layers', () => {
	let teardowns;

	beforeEach( () => {
		delete window.godam;
		// On a page the hotspot layer's view script registers its runtime.
		registerHotspotRuntime();
		HotspotLayerManager.mockClear();
		teardowns = [];
		jest.spyOn( console, 'warn' ).mockImplementation( () => {} );
		jest.spyOn( console, 'info' ).mockImplementation( () => {} );
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

	it( 'draws late hotspot layers once, not once per layer mounted', () => {
		unregisterLayerRuntime( 'hotspot' );
		const frame = makeFrame( [
			{ id: 'h1', type: 'hotspot', hotspots: [ { id: 's1' } ] },
			{ id: 'h2', type: 'hotspot', hotspots: [ { id: 's2' } ] },
		] );
		init( frame );
		expect( HotspotLayerManager ).not.toHaveBeenCalled();

		// The hotspot view script loads after the frame rendered.
		registerHotspotRuntime();

		// Each late mount redraws from scratch: one drawing is left in the frame,
		// and it holds both layers' hotspots once each.
		const drawings = frame.querySelectorAll( '.godam-image-hotspots' );
		expect( drawings ).toHaveLength( 1 );
		const latest = HotspotLayerManager.mock.instances.at( -1 );
		const [ merged, container ] = latest.setupHotspotLayer.mock.calls[ 0 ];
		expect( merged.hotspots.map( ( h ) => h.id ) ).toEqual( [ 's1', 's2' ] );
		expect( container ).toBe( drawings[ 0 ] );
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
		expect( frame.querySelector( '.godam-image-layer-item' ) ).toBeNull();
	} );

	it( 'draws any add-on type whose manager has the image methods', () => {
		const AcmeManager = makeWooManager();
		registerLayerType( 'acme', { label: 'Acme', validator: () => true, manager: AcmeManager } );
		init( makeFrame( [ { id: 'a1', type: 'acme' } ] ) );
		expect( AcmeManager.mock.instances[ 0 ].createProductHotspots ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'skips video-only types: core CTA and add-on managers without the image methods', () => {
		const VideoOnly = jest.fn();
		registerLayerType( 'acme', { label: 'Acme', validator: () => true, manager: VideoOnly } );
		const frame = makeFrame( [ { id: 'a1', type: 'acme' }, { id: 'c1', type: 'cta' } ] );

		init( frame );

		expect( VideoOnly ).not.toHaveBeenCalled();
		expect( HotspotLayerManager ).not.toHaveBeenCalled();
		expect( frame.querySelector( '.godam-image-layer-item' ) ).toBeNull();
		expect( frame.dataset.godamLayersRendered ).toBe( 'true' );
	} );

	it( 'draws an add-on runtime that supports images, with no timeline', () => {
		const mount = jest.fn( ( ctx ) => {
			ctx.container.textContent = 'Countdown';
			return {};
		} );
		registerLayerRuntime( 'acme/countdown', { supports: { media: [ 'image' ] }, mount } );
		const frame = makeFrame( [ { id: 'a1', type: 'acme/countdown' } ] );

		init( frame );

		const ctx = mount.mock.calls[ 0 ][ 0 ];
		expect( ctx.media.type ).toBe( 'image' );
		expect( ctx.api.currentTime() ).toBe( 0 );
		expect( frame.querySelector( '.godam-image-layer-item' ).textContent ).toBe( 'Countdown' );
	} );

	it( 'draws a layer whose view script loads after the frame', () => {
		const frame = makeFrame( [ { id: 'a1', type: 'acme/late' } ] );
		init( frame );
		expect( frame.querySelector( '.godam-image-layer-item' ) ).toBeNull();

		registerLayerRuntime( 'acme/late', { supports: { media: [ 'image' ] }, mount: ( ctx ) => {
			ctx.container.textContent = 'Late';
			return {};
		} } );

		expect( frame.querySelector( '.godam-image-layer-item' ).textContent ).toBe( 'Late' );
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
