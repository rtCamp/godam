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

describe( 'groupRows — per-hotspot Direct revenue (single store currency)', () => {
	const baseRow = {
		layer_type: 'woo',
		page_url: 'https://shop.example.com',
		timestamp: 17,
	};
	// The endpoint attaches revenue_minor/orders/currency to each Woo row.
	// Base currency is INR; a non-base (USD) order is excluded server-side, so
	// its row arrives as revenue_minor 0 / orders 0 — never blended.
	const rows = [
		{
			...baseRow,
			layer_id: 'woo-9', layer_name: 'Deals',
			viewed: 10, clicked: 4, hovered: 10, conversion_rate: 40,
			layer_metadata: '{"parent_layer_id":"woo-9"}',
		},
		{
			...baseRow,
			layer_id: 'woo-9::p101', layer_name: 'Hoodie',
			viewed: 0, clicked: 3, conversion_rate: 30,
			revenue_minor: 120000, orders: 1, currency: 'INR',
			layer_metadata: '{"parent_layer_id":"woo-9","product_id":101}',
		},
		{
			...baseRow,
			layer_id: 'woo-9::p102', layer_name: 'Cap',
			viewed: 0, clicked: 1, conversion_rate: 10,
			revenue_minor: 0, orders: 0, currency: '',
			layer_metadata: '{"parent_layer_id":"woo-9","product_id":102}',
		},
		{
			...baseRow,
			layer_id: 'woo-9::p103', layer_name: 'Mug',
			viewed: 0, clicked: 2, conversion_rate: 20,
			revenue_minor: 30000, orders: 1, currency: 'INR',
			layer_metadata: '{"parent_layer_id":"woo-9","product_id":103}',
		},
	];

	it( 'maps each hotspot revenue/orders/currency from its endpoint row', () => {
		const [ parent ] = groupRows( rows, 'woo', OPEN_CONFIG );
		const byPid = Object.fromEntries(
			parent.sub_hotspots.map( ( s ) => [ s.product_id, s ] ),
		);
		expect( byPid[ 101 ] ).toMatchObject( { revenue_minor: 120000, orders: 1, currency: 'INR' } );
		expect( byPid[ 103 ] ).toMatchObject( { revenue_minor: 30000, orders: 1, currency: 'INR' } );
		// Server-excluded non-base order arrives as 0; the panel hides it (orders 0).
		expect( byPid[ 102 ] ).toMatchObject( { revenue_minor: 0, orders: 0 } );
	} );

	it( 'parent revenue is the sum of its hotspots, currency from a base-currency child', () => {
		const [ parent ] = groupRows( rows, 'woo', OPEN_CONFIG );
		expect( parent.revenue_minor ).toBe( 150000 ); // 120000 + 30000
		expect( parent.orders ).toBe( 2 );
		expect( parent.currency ).toBe( 'INR' );
	} );

	it( 'defaults revenue fields to 0/empty when the endpoint sends none', () => {
		const plain = rows.map( ( { revenue_minor: revenueMinor, orders, currency, ...rest } ) => rest );
		const [ parent ] = groupRows( plain, 'woo', OPEN_CONFIG );
		expect( parent.revenue_minor ).toBe( 0 );
		expect( parent.orders ).toBe( 0 );
		expect(
			parent.sub_hotspots.every(
				( s ) => s.revenue_minor === 0 && s.orders === 0 && s.currency === '',
			),
		).toBe( true );
	} );
} );
