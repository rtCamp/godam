/**
 * Internal dependencies
 */
import {
	addLayerInteraction,
	addLayerInteractions,
	getLayerInteractions,
	clearLayerInteractions,
} from './storage';

const evt = ( id ) => ( {
	layer_id: id,
	layer_type: 'hotspot',
	action_type: 'viewed',
	layer_timestamp: 1,
} );

describe( 'addLayerInteractions — batch writer', () => {
	beforeEach( () => {
		clearLayerInteractions();
		jest.restoreAllMocks();
	} );

	it( 'appends every event in order', () => {
		addLayerInteractions( 'v1', [ evt( 'l1' ), evt( 'l1::A' ), evt( 'l1::B' ) ] );
		expect( getLayerInteractions().v1.map( ( e ) => e.layer_id ) ).toEqual( [
			'l1',
			'l1::A',
			'l1::B',
		] );
	} );

	it( 'writes to sessionStorage exactly once regardless of batch size', () => {
		const spy = jest.spyOn( Storage.prototype, 'setItem' );
		addLayerInteractions( 'v1', [ evt( 'l1' ), evt( 'l1::A' ), evt( 'l1::B' ) ] );
		expect( spy ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'drops malformed events but keeps valid ones', () => {
		addLayerInteractions( 'v1', [ evt( 'l1' ), { layer_id: 'bad' }, null ] );
		expect( getLayerInteractions().v1 ).toHaveLength( 1 );
	} );

	it( 'respects the per-video cap', () => {
		addLayerInteractions(
			'v1',
			Array.from( { length: 1200 }, ( _, i ) => evt( `l${ i }` ) ),
		);
		expect( getLayerInteractions().v1 ).toHaveLength( 1000 );
	} );

	it( 'does nothing on an empty or non-array batch', () => {
		const spy = jest.spyOn( Storage.prototype, 'setItem' );
		addLayerInteractions( 'v1', [] );
		addLayerInteractions( 'v1', null );
		expect( spy ).not.toHaveBeenCalled();
	} );

	it( 'keeps the single-event writer working', () => {
		addLayerInteraction( 'v1', evt( 'l1' ) );
		expect( getLayerInteractions().v1 ).toHaveLength( 1 );
	} );

	it( 'ignores a missing or non-string videoKey', () => {
		addLayerInteractions( '', [ evt( 'l1' ) ] );
		addLayerInteractions( null, [ evt( 'l1' ) ] );
		expect( getLayerInteractions() ).toEqual( {} );
	} );
} );
