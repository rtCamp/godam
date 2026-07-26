/**
 * Unit tests for the pure Placements helpers: section grouping, display-label
 * mapping, and the derived play-rate / avg-watch-time metrics.
 */

/**
 * Internal dependencies
 */
import {
	groupPlacementsByBlockSource,
	getBlockSourceLabel,
	getPlayRate,
	getAvgWatchTime,
	getPlacementTitle,
} from './index';

// Minimal placement row factory; metric fields default to zero.
const row = ( overrides = {} ) => ( {
	post_id: 1,
	block_source: 'video-block',
	views: 0,
	plays: 0,
	page_load: 0,
	play_time: 0,
	...overrides,
} );

describe( 'groupPlacementsByBlockSource', () => {
	it( 'groups rows by block_source and keeps row order within a section', () => {
		const rows = [
			row( { post_id: 1, block_source: 'video-block', plays: 10 } ),
			row( { post_id: 2, block_source: 'video-gallery', plays: 8 } ),
			row( { post_id: 3, block_source: 'video-block', plays: 5 } ),
		];

		const sections = groupPlacementsByBlockSource( rows );

		expect( sections ).toHaveLength( 2 );
		expect( sections[ 0 ].key ).toBe( 'video-block' );
		expect( sections[ 0 ].rows.map( ( r ) => r.post_id ) ).toEqual( [ 1, 3 ] );
		expect( sections[ 1 ].key ).toBe( 'video-gallery' );
		expect( sections[ 1 ].rows.map( ( r ) => r.post_id ) ).toEqual( [ 2 ] );
	} );

	it( 'orders sections canonically regardless of input order', () => {
		const rows = [
			row( { block_source: 'reel-pop' } ),
			row( { block_source: 'shoppable-video' } ),
			row( { block_source: 'video-block' } ),
		];

		const keys = groupPlacementsByBlockSource( rows ).map( ( s ) => s.key );

		expect( keys ).toEqual( [ 'video-block', 'shoppable-video', 'reel-pop' ] );
	} );

	it( 'buckets empty and unknown block_source values into one Other section', () => {
		const rows = [
			row( { post_id: 1, block_source: '' } ),
			row( { post_id: 2, block_source: 'some-future-slug' } ),
			row( { post_id: 3 } ), // missing block_source entirely
		];
		delete rows[ 2 ].block_source;

		const sections = groupPlacementsByBlockSource( rows );

		expect( sections ).toHaveLength( 1 );
		expect( sections[ 0 ].key ).toBe( 'other' );
		expect( sections[ 0 ].label ).toBe( 'Other' );
		expect( sections[ 0 ].rows ).toHaveLength( 3 );
	} );

	it( 'sinks the Other section below every known section', () => {
		const rows = [
			row( { block_source: 'mystery' } ),
			row( { block_source: 'reel-pop' } ),
		];

		const keys = groupPlacementsByBlockSource( rows ).map( ( s ) => s.key );

		expect( keys ).toEqual( [ 'reel-pop', 'other' ] );
	} );

	it( 'returns an empty list for empty or non-array input', () => {
		expect( groupPlacementsByBlockSource( [] ) ).toEqual( [] );
		expect( groupPlacementsByBlockSource( undefined ) ).toEqual( [] );
		expect( groupPlacementsByBlockSource( null ) ).toEqual( [] );
	} );
} );

describe( 'getBlockSourceLabel', () => {
	it.each( [
		[ 'video-block', 'Video Block' ],
		[ 'video-gallery', 'Video Gallery' ],
		[ 'shoppable-video', 'Shoppable Video' ],
		[ 'wc-product-gallery', 'WooCommerce Product Gallery' ],
		[ 'product-reels', 'Product Reels' ],
		[ 'reel-pop', 'Reel Pop' ],
	] )( 'maps %s to %s', ( slug, label ) => {
		expect( getBlockSourceLabel( slug ) ).toBe( label );
	} );

	it( 'maps the empty string to Other', () => {
		expect( getBlockSourceLabel( '' ) ).toBe( 'Other' );
	} );

	it( 'maps unknown slugs to Other', () => {
		expect( getBlockSourceLabel( 'some-future-slug' ) ).toBe( 'Other' );
	} );
} );

describe( 'getPlayRate', () => {
	it( 'derives plays / page_load as a percentage', () => {
		expect( getPlayRate( 25, 100 ) ).toBe( 25 );
		expect( getPlayRate( 1, 3 ) ).toBeCloseTo( 33.333, 2 );
	} );

	it( 'guards against zero or missing page loads', () => {
		expect( getPlayRate( 10, 0 ) ).toBe( 0 );
		expect( getPlayRate( 10, undefined ) ).toBe( 0 );
		expect( getPlayRate( 10, null ) ).toBe( 0 );
	} );
} );

describe( 'getAvgWatchTime', () => {
	it( 'derives play_time / plays in seconds', () => {
		expect( getAvgWatchTime( 300, 10 ) ).toBe( 30 );
		expect( getAvgWatchTime( 100, 3 ) ).toBeCloseTo( 33.333, 2 );
	} );

	it( 'guards against zero or missing plays', () => {
		expect( getAvgWatchTime( 300, 0 ) ).toBe( 0 );
		expect( getAvgWatchTime( 300, undefined ) ).toBe( 0 );
		expect( getAvgWatchTime( 300, null ) ).toBe( 0 );
	} );
} );

describe( 'untrusted block_source keys', () => {
	// block_source is free text: the microservice normalizes but never rejects
	// it, and the public embed page accepts it from a query arg. An inherited
	// Object.prototype member name used to make the label lookup truthy and the
	// bucket a function, throwing a TypeError during render.
	const PROTO_KEYS = [
		'toString',
		'valueOf',
		'constructor',
		'hasOwnProperty',
		'__proto__',
		'isPrototypeOf',
	];

	it.each( PROTO_KEYS )( 'groups %s into "other" without throwing', ( bs ) => {
		const sections = groupPlacementsByBlockSource( [ row( { block_source: bs } ) ] );
		expect( sections ).toHaveLength( 1 );
		expect( sections[ 0 ].key ).toBe( 'other' );
		expect( sections[ 0 ].rows ).toHaveLength( 1 );
	} );

	it.each( PROTO_KEYS )( 'labels %s as "Other"', ( bs ) => {
		expect( getBlockSourceLabel( bs ) ).toBe( 'Other' );
	} );

	it( 'still groups a mix of real and hostile sources correctly', () => {
		const sections = groupPlacementsByBlockSource( [
			row( { block_source: 'video-block' } ),
			row( { block_source: 'toString' } ),
			row( { block_source: 'reel-pop' } ),
			row( { block_source: 'constructor' } ),
		] );
		const byKey = Object.fromEntries( sections.map( ( s ) => [ s.key, s.rows.length ] ) );
		expect( byKey[ 'video-block' ] ).toBe( 1 );
		expect( byKey[ 'reel-pop' ] ).toBe( 1 );
		expect( byKey.other ).toBe( 2 );
	} );
} );

describe( 'getPlacementTitle', () => {
	it( 'uses the enriched title when present', () => {
		expect( getPlacementTitle( row( { title: 'Home Page' } ) ) ).toBe( 'Home Page' );
	} );

	it( 'falls back to "Post #<id>" when the title is missing but post_id is known', () => {
		expect( getPlacementTitle( row( { title: undefined, post_id: 42 } ) ) ).toBe(
			'Post #42',
		);
		expect( getPlacementTitle( row( { title: '', post_id: 42 } ) ) ).toBe( 'Post #42' );
	} );

	it( 'falls back to "Unknown page" when neither title nor post_id is usable', () => {
		expect( getPlacementTitle( row( { title: '', post_id: 0 } ) ) ).toBe( 'Unknown page' );
		expect( getPlacementTitle( {} ) ).toBe( 'Unknown page' );
	} );
} );
