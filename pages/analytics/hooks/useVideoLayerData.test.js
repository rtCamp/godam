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
} );
