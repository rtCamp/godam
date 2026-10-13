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

	// Only the empty block_source (unattributed: no surface at all) is dropped —
	// those plays are already reported in the video's overall metrics above the
	// card, so showing them again would double-report them. A non-empty but
	// unmapped slug is still a real, attributed placement and must be kept —
	// it does not double-report anything, and the dashboard's placements_count
	// already counts it, so dropping it here would make the two disagree.
	it( 'drops only the empty/missing block_source row, keeping an unmapped-but-real one', () => {
		const rows = [
			row( { post_id: 1, block_source: '' } ),
			row( { post_id: 2, block_source: 'some-future-slug' } ),
			row( { post_id: 3 } ), // missing block_source entirely
		];
		delete rows[ 2 ].block_source;

		const sections = groupPlacementsByBlockSource( rows );

		expect( sections ).toEqual( [
			{ key: 'some-future-slug', label: 'some-future-slug', rows: [ rows[ 1 ] ] },
		] );
	} );

	it( 'keeps an unmapped-but-real slug as its own section, labelled with the raw slug', () => {
		const rows = [
			row( { post_id: 1, block_source: 'mystery' } ),
			row( { post_id: 2, block_source: '' } ),
			row( { post_id: 3, block_source: 'reel-pop' } ),
		];

		const sections = groupPlacementsByBlockSource( rows );

		// Known sections (per SECTION_ORDER) sort before unmapped ones.
		expect( sections.map( ( s ) => s.key ) ).toEqual( [ 'reel-pop', 'mystery' ] );
		expect( sections[ 0 ].rows.map( ( r ) => r.post_id ) ).toEqual( [ 3 ] );
		expect( sections[ 1 ] ).toEqual( { key: 'mystery', label: 'mystery', rows: [ rows[ 0 ] ] } );
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

	it( 'has no label for the empty string (unattributed)', () => {
		expect( getBlockSourceLabel( '' ) ).toBe( '' );
	} );

	it( 'labels an unmapped slug with the raw value itself', () => {
		expect( getBlockSourceLabel( 'some-future-slug' ) ).toBe( 'some-future-slug' );
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

	// These are still non-empty strings, so per the "only empty is dropped" rule
	// they are real placements and must be kept, not dropped — the null-prototype
	// bucket map (Object.create(null)) makes that safe: `buckets[ 'toString' ]` is
	// undefined until assigned, never the inherited Function. The value is only
	// ever rendered as text (a section label), never invoked, so keeping it is safe.
	it.each( PROTO_KEYS )( 'keeps %s as its own section without throwing', ( bs ) => {
		let sections;
		expect( () => {
			sections = groupPlacementsByBlockSource( [ row( { block_source: bs } ) ] );
		} ).not.toThrow();
		expect( sections ).toEqual( [ { key: bs, label: bs, rows: [ row( { block_source: bs } ) ] } ] );
	} );

	it.each( PROTO_KEYS )( 'labels %s with the raw value itself', ( bs ) => {
		expect( getBlockSourceLabel( bs ) ).toBe( bs );
	} );

	it( 'keeps known and hostile-but-real sources side by side', () => {
		const sections = groupPlacementsByBlockSource( [
			row( { block_source: 'video-block' } ),
			row( { block_source: 'toString' } ),
			row( { block_source: 'reel-pop' } ),
			row( { block_source: 'constructor' } ),
		] );
		expect( sections.map( ( s ) => s.key ) ).toEqual( [
			'video-block', 'reel-pop', 'toString', 'constructor',
		] );
		expect( sections.every( ( s ) => s.rows.length === 1 ) ).toBe( true );
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
