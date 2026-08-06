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
} );
