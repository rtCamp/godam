/**
 * Internal dependencies
 */
import { computeNoAction, groupRows } from './useVideoLayerData';

// Fail-open config: every layer/sub treated as active (no postmeta lookup).
const OPEN_CONFIG = { activeParentIds: null, activeSubIdsByParent: new Map() };

describe( 'computeNoAction', () => {
	it( 'clamps to 0 when clicked + skipped exceed viewed (the double-count shape)', () => {
		// 17 viewed, 3 clicked, 16 skipped would be -2 without the clamp.
		expect( computeNoAction( 'cta', { viewed: 17, clicked: 3, skipped: 16 } ) ).toBe( 0 );
	} );

	it( 'computes CTA no-action as viewed - clicked - skipped', () => {
		expect( computeNoAction( 'cta', { viewed: 10, clicked: 3, skipped: 2 } ) ).toBe( 5 );
	} );

	it( 'uses hovered as the engagement signal for woo/hotspot', () => {
		expect( computeNoAction( 'woo', { viewed: 10, hovered: 4 } ) ).toBe( 6 );
	} );
} );

describe( 'groupRows — conversion comes from the server, not a client recompute', () => {
	// A Woo layer whose products are only ever added to cart (zero clicks). The
	// server returns the session-union conversion_rate; a clicked-only client
	// recompute (the bug this guards) would report 0% for every row here.
	const baseRow = {
		layer_type: 'woo',
		page_url: 'https://shop.example.com',
		timestamp: 17,
	};
	const rows = [
		{
			...baseRow,
			layer_id: 'woo-1',
			layer_name: 'Featured products',
			viewed: 10, clicked: 0, hovered: 10, added_to_cart: 6,
			conversion_rate: 60,
			layer_metadata: '{"parent_layer_id":"woo-1"}',
		},
		{
			...baseRow,
			layer_id: 'woo-1::p1',
			layer_name: 'Mug',
			viewed: 0, clicked: 0, hovered: 7, added_to_cart: 4,
			conversion_rate: 40,
			layer_metadata: '{"parent_layer_id":"woo-1","product_id":1,"product_name":"Mug"}',
		},
		{
			...baseRow,
			layer_id: 'woo-1::p2',
			layer_name: 'Hat',
			viewed: 0, clicked: 0, hovered: 3, added_to_cart: 2,
			conversion_rate: 20,
			layer_metadata: '{"parent_layer_id":"woo-1","product_id":2,"product_name":"Hat"}',
		},
	];

	it( 'propagates the parent-aggregate conversion_rate (cart-only ≠ 0%)', () => {
		const [ parent ] = groupRows( rows, 'woo', OPEN_CONFIG );
		// clicked-only would be 0/10 = 0; the union from the server is 60.
		expect( parent.conversion_rate ).toBe( 60 );
	} );

	it( "propagates each product's server conversion_rate, sorted descending", () => {
		const [ parent ] = groupRows( rows, 'woo', OPEN_CONFIG );
		expect( parent.sub_hotspots.map( ( s ) => s.conversion_rate ) ).toEqual( [ 40, 20 ] );
	} );

	it( 'clamps a server rate above 100 to 100', () => {
		const [ parent ] = groupRows(
			[ { ...rows[ 0 ], conversion_rate: 130 } ],
			'woo',
			OPEN_CONFIG,
		);
		expect( parent.conversion_rate ).toBe( 100 );
	} );
} );

describe( 'groupRows — a hotspot reports its own viewed, never the layer\'s', () => {
	// The layer was seen 9 times. Hotspot A has been there throughout and was
	// seen 7 of those times; hotspot B was added late and has been seen once.
	// Substituting the layer's 9 onto either of them is the bug: it charges B
	// with 9 impressions it was never present for, all landing in "No Action".
	const base = {
		layer_type: 'hotspot',
		page_url: 'https://example.com',
		timestamp: 4.59,
	};
	const rows = [
		{
			...base,
			layer_id: 'h-1',
			layer_name: 'Hotspot layer at 4.59s',
			viewed: 9, clicked: 2, hovered: 5,
			conversion_rate: 22.2,
			layer_metadata: '{"parent_layer_id":"h-1"}',
		},
		{
			...base,
			layer_id: 'h-1::a',
			layer_name: 'Long-standing hotspot',
			viewed: 7, clicked: 1, hovered: 3,
			conversion_rate: 14.3,
			layer_metadata: '{"parent_layer_id":"h-1"}',
		},
		{
			...base,
			layer_id: 'h-1::b',
			layer_name: 'Added yesterday',
			viewed: 1, clicked: 0, hovered: 0,
			conversion_rate: 0,
			layer_metadata: '{"parent_layer_id":"h-1"}',
		},
	];

	it( 'keeps each hotspot\'s own viewed instead of the parent\'s', () => {
		const [ parent ] = groupRows( rows, 'hotspot', OPEN_CONFIG );
		const byName = Object.fromEntries(
			parent.sub_hotspots.map( ( s ) => [ s.name, s.counts.viewed ] ),
		);
		expect( byName[ 'Long-standing hotspot' ] ).toBe( 7 );
		expect( byName[ 'Added yesterday' ] ).toBe( 1 );
	} );

	it( 'computes No Action against the hotspot\'s own viewed', () => {
		const [ parent ] = groupRows( rows, 'hotspot', OPEN_CONFIG );
		const byName = Object.fromEntries(
			parent.sub_hotspots.map( ( s ) => [ s.name, s.no_action ] ),
		);
		// 7 - 3, not the parent's 9 - 3 = 6.
		expect( byName[ 'Long-standing hotspot' ] ).toBe( 4 );
		// 1 - 0, not the parent's 9 - 0 = 9. This is the reported bug.
		expect( byName[ 'Added yesterday' ] ).toBe( 1 );
	} );

	it( 'leaves the layer row itself on its own aggregate', () => {
		const [ parent ] = groupRows( rows, 'hotspot', OPEN_CONFIG );
		expect( parent.counts.viewed ).toBe( 9 );
		expect( parent.no_action ).toBe( 4 );
	} );

	// Woo product hotspots go through this same code path, and the two types
	// must behave identically. Asserted separately because `layerType` selects
	// the No Action formula, so a woo-only regression would not be caught above.
	it( 'treats a Woo product hotspot exactly the same way', () => {
		const wooRows = rows.map( ( r ) => ( {
			...r,
			layer_type: 'woo',
			layer_id: r.layer_id.replace( '::a', '::p1' ).replace( '::b', '::p2' ),
			layer_metadata: r.layer_id.includes( '::' )
				? JSON.stringify( {
					parent_layer_id: 'h-1',
					product_id: r.layer_id.endsWith( 'a' ) ? 1 : 2,
					product_name: r.layer_id.endsWith( 'a' ) ? 'Established product' : 'Added yesterday',
				} )
				: '{"parent_layer_id":"h-1"}',
		} ) );
		const [ parent ] = groupRows( wooRows, 'woo', OPEN_CONFIG );
		const byName = Object.fromEntries(
			parent.sub_hotspots.map( ( s ) => [ s.name, [ s.counts.viewed, s.no_action ] ] ),
		);
		expect( byName[ 'Established product' ] ).toEqual( [ 7, 4 ] );
		expect( byName[ 'Added yesterday' ] ).toEqual( [ 1, 1 ] );
	} );
} );

describe( 'groupRows — hotspot sub-name drops the redundant parent prefix', () => {
	// The tracker writes each hotspot event's layer_name as the parent layer
	// name, a separator dash, then "Hotspot N" (e.g. the parent "Hotspot layer
	// at 4.59s" followed by " <dash> Hotspot 2"). The rail already shows the
	// parent as its card title, so the row must read just "Hotspot N". SEP is
	// built from a code point so no literal em dash lives in this file.
	const SEP = ` ${ String.fromCharCode( 0x2014 ) } `;
	const PARENT = 'Hotspot layer at 4.59s';
	const base = { layer_type: 'hotspot', page_url: 'https://example.com', timestamp: 4.59 };
	const parentRow = {
		...base,
		layer_id: 'h-1',
		layer_name: PARENT,
		viewed: 2, clicked: 1, hovered: 2,
		conversion_rate: 50,
		layer_metadata: JSON.stringify( { parent_layer_id: 'h-1', parent_layer_name: PARENT } ),
	};
	const subRow = ( suffix, label, index ) => ( {
		...base,
		layer_id: `h-1::${ suffix }`,
		layer_name: `${ PARENT }${ SEP }${ label }`,
		viewed: 1, clicked: 0, hovered: 0,
		conversion_rate: 0,
		layer_metadata: JSON.stringify( {
			parent_layer_id: 'h-1',
			parent_layer_name: PARENT,
			hotspot_index: index,
		} ),
	} );

	it( 'strips the parent name and separator, leaving only "Hotspot N"', () => {
		const rows = [ parentRow, subRow( 'a', 'Hotspot 1', 0 ), subRow( 'b', 'Hotspot 2', 1 ) ];
		const [ parent ] = groupRows( rows, 'hotspot', OPEN_CONFIG );
		expect( parent.sub_hotspots.map( ( s ) => s.name ).sort() ).toEqual( [ 'Hotspot 1', 'Hotspot 2' ] );
	} );

	it( 'leaves a Woo product name untouched (guarded by product_name)', () => {
		const wooParent = {
			...parentRow,
			layer_type: 'woo',
			layer_id: 'w-1',
			layer_name: 'Woo layer at 9.90s',
			layer_metadata: JSON.stringify( { parent_layer_id: 'w-1', parent_layer_name: 'Woo layer at 9.90s' } ),
		};
		const wooSub = {
			...base,
			layer_type: 'woo',
			layer_id: 'w-1::p1',
			layer_name: 'Lamp',
			viewed: 0, hovered: 1, added_to_cart: 0, conversion_rate: 0,
			layer_metadata: JSON.stringify( { parent_layer_id: 'w-1', product_id: 1, product_name: 'Lamp' } ),
		};
		const [ parent ] = groupRows( [ wooParent, wooSub ], 'woo', OPEN_CONFIG );
		expect( parent.sub_hotspots.map( ( s ) => s.name ) ).toEqual( [ 'Lamp' ] );
	} );

	it( 'keeps a sub name that does not start with the parent prefix', () => {
		const custom = {
			...subRow( 'c', 'ignored', 2 ),
			layer_name: 'Buy now',
			layer_metadata: JSON.stringify( { parent_layer_id: 'h-1', parent_layer_name: PARENT } ),
		};
		const [ parent ] = groupRows( [ parentRow, custom ], 'hotspot', OPEN_CONFIG );
		expect( parent.sub_hotspots.map( ( s ) => s.name ) ).toContain( 'Buy now' );
	} );
} );
