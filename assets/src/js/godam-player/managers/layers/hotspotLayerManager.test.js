/**
 * Internal dependencies
 */
import HotspotLayerManager from './hotspotLayerManager';

/**
 * Minimal player stub — emitLayerVisible only needs a videoKey off the element.
 *
 * @param {string} id data-id attribute value.
 * @return {Object} Fake VideoJS player.
 */
const fakePlayer = ( id = 'vid-1' ) => ( {
	el: () => ( {
		getAttribute: ( attr ) => ( attr === 'data-id' ? id : null ),
		dataset: { id },
	} ),
	currentTime: () => 5,
	isFullscreen: () => false,
} );

describe( 'HotspotLayerManager.emitLayerVisible', () => {
	let manager, batched, single;

	beforeEach( () => {
		batched = [];
		single = [];
		window.GoDAM = {
			addLayerInteraction: ( key, event ) => single.push( event ),
			addLayerInteractions: ( key, events ) => batched.push( events ),
			getTabHiddenAccumulatedMs: () => 0,
			getDeviceType: () => 'desktop',
			wasFirstViewForVideo: () => true,
		};
		manager = new HotspotLayerManager( fakePlayer(), true, 'inst-1' );
	} );

	it( 'emits a layer viewed plus one viewed per hotspot, in one batch', () => {
		manager.emitLayerVisible( {
			id: 'l1',
			type: 'hotspot',
			displayTime: 4.5,
			hotspots: [ { id: 'A' }, { id: 'B' } ],
		} );

		expect( batched ).toHaveLength( 1 );
		expect( batched[ 0 ].map( ( e ) => e.layer_id ) ).toEqual( [
			'l1',
			'l1::A',
			'l1::B',
		] );
		expect( batched[ 0 ].every( ( e ) => e.action_type === 'viewed' ) ).toBe( true );
	} );

	it( 'writes exactly once no matter how many hotspots there are', () => {
		manager.emitLayerVisible( {
			id: 'l1',
			type: 'hotspot',
			displayTime: 1,
			hotspots: Array.from( { length: 12 }, ( _, i ) => ( { id: `h${ i }` } ) ),
		} );

		expect( batched ).toHaveLength( 1 );
		expect( batched[ 0 ] ).toHaveLength( 13 );
		expect( single ).toHaveLength( 0 );
	} );

	it( 'emits only the layer viewed when there are no hotspots', () => {
		manager.emitLayerVisible( { id: 'l2', type: 'hotspot', displayTime: 1, hotspots: [] } );
		expect( batched[ 0 ].map( ( e ) => e.layer_id ) ).toEqual( [ 'l2' ] );
	} );

	it( 'tolerates a missing hotspots array', () => {
		manager.emitLayerVisible( { id: 'l3', type: 'hotspot', displayTime: 1 } );
		expect( batched[ 0 ].map( ( e ) => e.layer_id ) ).toEqual( [ 'l3' ] );
	} );

	it( 'dedupes per session — a second call emits nothing', () => {
		const layer = {
			id: 'l1',
			type: 'hotspot',
			displayTime: 1,
			hotspots: [ { id: 'A' } ],
		};
		manager.emitLayerVisible( layer );
		manager.emitLayerVisible( layer );

		expect( batched ).toHaveLength( 1 );
		expect( batched[ 0 ] ).toHaveLength( 2 );
	} );

	it( 'falls back to single writes when the batch writer is absent', () => {
		delete window.GoDAM.addLayerInteractions;
		manager.emitLayerVisible( {
			id: 'l1',
			type: 'hotspot',
			displayTime: 1,
			hotspots: [ { id: 'A' } ],
		} );
		expect( single.map( ( e ) => e.layer_id ) ).toEqual( [ 'l1', 'l1::A' ] );
	} );

	it( 'still routes hovered/clicked through the single-event writer', () => {
		const layer = { id: 'l1', type: 'hotspot', displayTime: 1, hotspots: [ { id: 'A' } ] };
		manager.emitHotspotEvent( layer, { id: 'A' }, 0, 'clicked' );
		expect( single.map( ( e ) => e.action_type ) ).toEqual( [ 'clicked' ] );
		expect( batched ).toHaveLength( 0 );
	} );

	it( 'batches even when only the batch writer is present (no single writer)', () => {
		delete window.GoDAM.addLayerInteraction;
		manager.emitLayerVisible( {
			id: 'l1', type: 'hotspot', displayTime: 1, hotspots: [ { id: 'A' } ],
		} );
		expect( batched ).toHaveLength( 1 );
		expect( batched[ 0 ].map( ( e ) => e.layer_id ) ).toEqual( [ 'l1', 'l1::A' ] );
	} );

	it( 'does not throw when no writer is available at all', () => {
		delete window.GoDAM.addLayerInteraction;
		delete window.GoDAM.addLayerInteractions;
		expect( () =>
			manager.emitLayerVisible( {
				id: 'l1', type: 'hotspot', displayTime: 1, hotspots: [ { id: 'A' } ],
			} ),
		).not.toThrow();
		expect( batched ).toHaveLength( 0 );
		expect( single ).toHaveLength( 0 );
	} );

	it( 'does not burn the dedupe when no writer is present, so a later visibility retries', () => {
		const layer = { id: 'l1', type: 'hotspot', displayTime: 1, hotspots: [ { id: 'A' } ] };
		delete window.GoDAM.addLayerInteraction;
		delete window.GoDAM.addLayerInteractions;
		manager.emitLayerVisible( layer ); // no sink yet — must not mark dedupe
		expect( batched ).toHaveLength( 0 );

		// Core finishes initialising and the batch writer appears.
		window.GoDAM.addLayerInteractions = ( key, events ) => batched.push( events );
		manager.emitLayerVisible( layer ); // must now emit, not be deduped away
		expect( batched ).toHaveLength( 1 );
		expect( batched[ 0 ].map( ( e ) => e.layer_id ) ).toEqual( [ 'l1', 'l1::A' ] );
	} );

	it( 'skips the per-hotspot viewed for a hotspot with no stable id', () => {
		// An id-less hotspot would key on a positional idx<n>, which
		// re-attributes across a deletion; it keeps the layer impression only.
		manager.emitLayerVisible( {
			id: 'l1',
			type: 'hotspot',
			displayTime: 1,
			hotspots: [ { id: 'A' }, {} ],
		} );
		expect( batched[ 0 ].map( ( e ) => e.layer_id ) ).toEqual( [ 'l1', 'l1::A' ] );
	} );
} );

describe( 'HotspotLayerManager button style', () => {
	// The video content box the points are placed in (left/top offsets included).
	const CONTENT_RECT = { left: 10, top: 20, width: 800, height: 400 };
	let manager;

	beforeEach( () => {
		manager = new HotspotLayerManager( fakePlayer(), {}, 'inst-1' );
		manager.computeContentRect = () => CONTENT_RECT;
	} );

	const build = ( layer, hotspot, index = 0 ) =>
		manager.createHotspotElement( hotspot, index, 800, 400, 800, 600, layer );

	it( 'renders a button-style point as a linked button, not a circle', () => {
		const el = build(
			{ styleType: 'button' },
			{ id: 'A', tooltipText: 'Shop now', link: 'https://example.com', position: { x: 50, y: 25 }, unit: 'percent' },
		);

		expect( el.tagName ).toBe( 'A' );
		expect( el.classList.contains( 'godam-button-cta' ) ).toBe( true );
		expect( el.classList.contains( 'godam-hotspot-button' ) ).toBe( true );
		expect( el.classList.contains( 'hotspot' ) ).toBe( false );
		expect( el.classList.contains( 'circle' ) ).toBe( false );
		expect( el.textContent ).toBe( 'Shop now' );
		expect( el.getAttribute( 'href' ) ).toBe( 'https://example.com' );
		expect( el.target ).toBe( '_blank' );
		expect( el.rel ).toBe( 'noopener noreferrer' );
		// Top-left corner at the hotspot position inside the content box.
		expect( el.style.left ).toBe( '410px' );
		expect( el.style.top ).toBe( '120px' );
		// Sized by its label: no circle width/height, no tooltip.
		expect( el.style.width ).toBe( '' );
		expect( el.querySelector( '.hotspot-tooltip' ) ).toBeNull();
		expect( el.style.getPropertyValue( '--godam-btn-bg' ) ).toBe( '#3858e9' );
	} );

	it( 'applies the sticker variant, colours and attention animation per hotspot', () => {
		const el = build(
			{ styleType: 'button' },
			{ id: 'A', tooltipText: 'Sale!', variant: 'sticker', bgColor: '#4FD1A5', attention: 'pulse', position: { x: 0, y: 0 }, unit: 'percent' },
		);

		expect( el.classList.contains( 'godam-button-cta--sticker' ) ).toBe( true );
		expect( el.classList.contains( 'godam-button-cta--attn-pulse' ) ).toBe( true );
		expect( el.getAttribute( 'data-sticker-text' ) ).toBe( 'Sale!' );
		expect( el.style.getPropertyValue( '--godam-btn-bg' ) ).toBe( '#4FD1A5' );
	} );

	it.each( [
		[ 'javascript:', 'javascript:alert(1)' ],
		[ 'data:', 'data:text/html,<script>alert(1)</script>' ],
		[ 'vbscript:', 'vbscript:msgbox(1)' ],
		[ 'an unparseable value', 'http://' ],
	] )( 'does not make a button navigable for %s links', ( name, link ) => {
		const el = build( { styleType: 'button' }, { id: 'U', tooltipText: 'Go', link, position: { x: 0, y: 0 }, unit: 'percent' } );

		expect( el.hasAttribute( 'href' ) ).toBe( false );
		expect( el.hasAttribute( 'target' ) ).toBe( false );
		// Still rendered, just not a link.
		expect( el.textContent ).toBe( 'Go' );
	} );

	it( 'accepts absolute and relative http(s) links', () => {
		const absolute = build( { styleType: 'button' }, { id: 'A1', link: 'http://example.com/x', position: { x: 0, y: 0 }, unit: 'percent' } );
		const relative = build( { styleType: 'button' }, { id: 'A2', link: '/shop/', position: { x: 0, y: 0 }, unit: 'percent' } );

		expect( absolute.getAttribute( 'href' ) ).toBe( 'http://example.com/x' );
		expect( relative.getAttribute( 'href' ) ).toBe( '/shop/' );
	} );

	it( 'clamps a button near the bottom-right so it stays inside the video', () => {
		const el = build( { styleType: 'button' }, { id: 'E', tooltipText: 'Go', position: { x: 95, y: 90 }, unit: 'percent' } );
		// jsdom has no layout, so give the button a measured size.
		Object.defineProperty( el, 'offsetWidth', { value: 120, configurable: true } );
		Object.defineProperty( el, 'offsetHeight', { value: 40, configurable: true } );

		manager.positionHotspotButton( el, { id: 'E', position: { x: 95, y: 90 }, unit: 'percent' } );

		// Content box: left 10 / top 20, 800x400 → right edge 810, bottom edge 420.
		expect( el.style.left ).toBe( '690px' ); // 810 - 120
		expect( el.style.top ).toBe( '380px' ); // 420 - 40
	} );

	it( 'leaves a button that already fits where it was placed', () => {
		const el = build( { styleType: 'button' }, { id: 'F', tooltipText: 'Go', position: { x: 10, y: 10 }, unit: 'percent' } );
		Object.defineProperty( el, 'offsetWidth', { value: 120, configurable: true } );
		Object.defineProperty( el, 'offsetHeight', { value: 40, configurable: true } );

		manager.positionHotspotButton( el, { id: 'F', position: { x: 10, y: 10 }, unit: 'percent' } );

		expect( el.style.left ).toBe( '90px' ); // 10 + 10% of 800
		expect( el.style.top ).toBe( '60px' ); // 20 + 10% of 400
	} );

	it( 'sizes a button from its stored fontPercent, scaled to the content width', () => {
		// fontPercent is a % of the content width, like the circle diameter, so the
		// button scales with the video. 5% of 800 = 40px.
		const el = build( { styleType: 'button' }, { id: 'S', tooltipText: 'Go', fontPercent: 5, position: { x: 0, y: 0 }, unit: 'percent' } );

		expect( el.style.fontSize ).toBe( '40px' );
	} );

	it( 'sizes a button with no stored size from the per-variant default, so it still scales', () => {
		// No fontPercent → default (text 2.5% of 800 = 20px), never a fixed px size.
		const text = build( { styleType: 'button' }, { id: 'N', tooltipText: 'Go', position: { x: 0, y: 0 }, unit: 'percent' } );
		expect( text.style.fontSize ).toBe( '20px' );

		// Sticker default is larger (5% of 800 = 40px).
		const sticker = build( { styleType: 'button' }, { id: 'N2', tooltipText: 'Sale', variant: 'sticker', position: { x: 0, y: 0 }, unit: 'percent' } );
		expect( sticker.style.fontSize ).toBe( '40px' );
	} );

	it( 'shrinks an over-wide button to fit 90% of the video width', () => {
		// fontPercent 10 on an 800px box → 80px; 90% cap = 720px.
		const hotspot = { id: 'W', tooltipText: 'Limited time offer', variant: 'sticker', fontPercent: 10, position: { x: 0, y: 0 }, unit: 'percent' };
		const el = build( { styleType: 'button' }, hotspot );
		expect( el.style.fontSize ).toBe( '80px' );

		// jsdom has no layout: say the 80px button measures 900px (> 720 cap).
		Object.defineProperty( el, 'offsetWidth', { value: 900, configurable: true } );
		Object.defineProperty( el, 'offsetHeight', { value: 100, configurable: true } );
		manager.positionHotspotButton( el, hotspot );

		// Shrunk to fit: 80 * 720/900 = 64px.
		expect( el.style.fontSize ).toBe( '64px' );
	} );

	it( 'does not shrink a button that already fits the width cap', () => {
		const hotspot = { id: 'FIT', tooltipText: 'Go', fontPercent: 5, position: { x: 0, y: 0 }, unit: 'percent' };
		const el = build( { styleType: 'button' }, hotspot );
		Object.defineProperty( el, 'offsetWidth', { value: 120, configurable: true } );
		Object.defineProperty( el, 'offsetHeight', { value: 40, configurable: true } );
		manager.positionHotspotButton( el, hotspot );

		expect( el.style.fontSize ).toBe( '40px' ); // 5% of 800, unchanged
	} );

	it( 'rescales a button font-size when the content box resizes', () => {
		const hotspot = { id: 'R', tooltipText: 'Go', fontPercent: 5, position: { x: 0, y: 0 }, unit: 'percent' };
		const el = build( { styleType: 'button' }, hotspot );
		expect( el.style.fontSize ).toBe( '40px' ); // 5% of 800

		// The player shrinks: the same percentage now resolves to a smaller px size.
		manager.computeContentRect = () => ( { left: 0, top: 0, width: 400, height: 200 } );
		manager.positionHotspotButton( el, hotspot );
		expect( el.style.fontSize ).toBe( '20px' ); // 5% of 400
	} );

	it( 'falls back to a numbered label and no link', () => {
		const el = build( { styleType: 'button' }, { id: 'B', position: { x: 10, y: 10 }, unit: 'percent' }, 2 );

		expect( el.textContent ).toBe( 'Hotspot 3' );
		expect( el.hasAttribute( 'href' ) ).toBe( false );
	} );

	it( 'renders a button from a per-hotspot styleType (godam/image merged layer)', () => {
		// The image block merges hotspot layers into one style-less layer and
		// tags button hotspots individually.
		const el = build( {}, { id: 'C', styleType: 'button', tooltipText: 'Go', position: { x: 0, y: 0 }, unit: 'percent' } );

		expect( el.classList.contains( 'godam-hotspot-button' ) ).toBe( true );
	} );

	it( 'still renders pulse hotspots as circles', () => {
		const el = build( { styleType: 'pulse' }, { id: 'D', position: { x: 0, y: 0 }, size: { diameter: 5 }, unit: 'percent' } );

		expect( el.classList.contains( 'hotspot' ) ).toBe( true );
		expect( el.classList.contains( 'godam-hotspot-button' ) ).toBe( false );
	} );

	it( 'repositions buttons on resize without giving them a circle size', () => {
		const layerElement = document.createElement( 'div' );
		const hotspots = [ { id: 'A', tooltipText: 'Go', position: { x: 50, y: 50 }, unit: 'percent' } ];
		const layer = { styleType: 'button', hotspots };
		layerElement.appendChild( build( layer, hotspots[ 0 ] ) );
		manager.hotspotLayers.push( { layerElement, hotspots, layer } );

		manager.computeContentRect = () => ( { left: 0, top: 0, width: 400, height: 200 } );
		manager.updateHotspotPositions();

		const el = layerElement.querySelector( '.godam-hotspot-button' );
		expect( el.style.left ).toBe( '200px' );
		expect( el.style.top ).toBe( '100px' );
		expect( el.style.width ).toBe( '' );
		expect( el.style.height ).toBe( '' );
	} );

	it( 'clamps a button inside the video when its layer is shown again after a resize', () => {
		// A hidden layer is display:none, so its button measures 0x0 and any
		// resize that happened while it was hidden skipped the clamp. When the
		// layer reappears it must be re-clamped, not just its (absent) tooltip.
		const rafSpy = jest
			.spyOn( window, 'requestAnimationFrame' )
			.mockImplementation( ( cb ) => {
				cb();
				return 0;
			} );
		// emitLayerVisible needs analytics globals; this test only cares about position.
		jest.spyOn( manager, 'emitLayerVisible' ).mockImplementation( () => {} );

		const hotspots = [ { id: 'A', tooltipText: 'Shop now', position: { x: 95, y: 90 }, unit: 'percent' } ];
		const layerElement = document.createElement( 'div' );
		const buttonEl = build( { styleType: 'button' }, hotspots[ 0 ] );
		layerElement.appendChild( buttonEl );
		// The layer has already rendered once, then been hidden.
		layerElement.classList.add( 'hidden' );
		layerElement.dataset.hotspotsInitialized = 'true';

		manager.hotspotLayers.push( {
			layerElement,
			hotspots,
			layer: { id: 'L', hotspots },
			show: true,
			displayTime: 0,
			duration: 100,
		} );

		// The player shrank while the layer was hidden; give the button a measured size.
		manager.computeContentRect = () => ( { left: 0, top: 0, width: 400, height: 200 } );
		Object.defineProperty( buttonEl, 'offsetWidth', { value: 120, configurable: true } );
		Object.defineProperty( buttonEl, 'offsetHeight', { value: 40, configurable: true } );

		manager.handleHotspotLayersTimeUpdate( 5 );

		// Layer is visible again and the button sits inside the 400x200 video:
		// right edge 400 - 120 = 280, bottom edge 200 - 40 = 160.
		expect( layerElement.classList.contains( 'hidden' ) ).toBe( false );
		expect( buttonEl.style.left ).toBe( '280px' );
		expect( buttonEl.style.top ).toBe( '160px' );

		rafSpy.mockRestore();
	} );
} );
