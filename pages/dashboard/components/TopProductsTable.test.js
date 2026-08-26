/**
 * Unit tests for the Top Products CSV cell escaper.
 *
 * `escapeCsvCell` is the formula-injection guard on the "Export" path: product
 * names are user-settable, so a name beginning with a spreadsheet formula
 * trigger (=, +, -, @, or a leading tab/CR that a spreadsheet strips before
 * evaluating what follows) must be neutralised before it lands in a .csv, or
 * opening the export in Excel/Sheets would execute it. This mirrors the guard
 * on TopVideosTable.
 *
 * @package
 */

/**
 * Internal dependencies
 */
import { escapeCsvCell, sourceLabel, formatRevenue, formatRevenueNumeric, hasInfluenced, influencedOrdersLabel, revenuePlacements, hasRevenueTierSplit } from './TopProductsTable';

describe( 'escapeCsvCell — formula-injection guard', () => {
	// A value whose FIRST character is one of these is what a spreadsheet would
	// evaluate as a formula, so the guard prefixes it with a single quote.
	it.each( [
		[ '=SUM(A1:A9)', "'=SUM(A1:A9)" ],
		[ '=1+1', "'=1+1" ],
		[ '+1', "'+1" ],
		[ '-1', "'-1" ],
		[ '@foo', "'@foo" ],
	] )( 'prefixes a leading formula trigger: %s', ( input, expected ) => {
		const out = escapeCsvCell( input );
		expect( out ).toBe( expected );
		expect( out.startsWith( "'" ) ).toBe( true );
	} );

	it( 'prefixes a value that leads with a tab (a spreadsheet strips it, then sees =)', () => {
		expect( escapeCsvCell( '\t=1+1' ) ).toBe( "'\t=1+1" );
	} );

	it( 'prefixes a value that leads with a carriage return', () => {
		expect( escapeCsvCell( '\r=1+1' ) ).toBe( "'\r=1+1" );
	} );

	it( 'quotes a value that leads with a newline so it cannot break out of its cell', () => {
		// A leading newline is not in the prefix set, but the field-quoting pass
		// wraps it in double quotes, so the payload stays inside one cell rather
		// than starting a new record a spreadsheet would then evaluate.
		const out = escapeCsvCell( '\n=1+1' );
		expect( out ).toBe( '"\n=1+1"' );
		expect( out.startsWith( '"' ) ).toBe( true );
	} );

	it( 'still applies the guard when the trigger also needs field-quoting', () => {
		// Leading '=' -> single-quote prefix, then the comma forces double-quote
		// wrapping around the already-prefixed value.
		expect( escapeCsvCell( '=cmd,arg' ) ).toBe( '"\'=cmd,arg"' );
	} );

	describe( 'ordinary values are left executable-safe and otherwise unchanged', () => {
		it( 'passes a plain product name through untouched', () => {
			expect( escapeCsvCell( 'Blue Ceramic Mug' ) ).toBe( 'Blue Ceramic Mug' );
		} );

		it( 'does not prefix a formula trigger that appears mid-string', () => {
			expect( escapeCsvCell( 'Mug =v2' ) ).toBe( 'Mug =v2' );
		} );

		it( 'stringifies a numeric value without adding a guard', () => {
			expect( escapeCsvCell( 42 ) ).toBe( '42' );
		} );

		it( 'quotes (but does not formula-prefix) a plain value containing a comma', () => {
			expect( escapeCsvCell( 'Mug, Blue' ) ).toBe( '"Mug, Blue"' );
		} );

		it( 'doubles embedded quotes in a plain value', () => {
			expect( escapeCsvCell( '7" Pan' ) ).toBe( '"7"" Pan"' );
		} );
	} );
} );

describe( 'sourceLabel — Source chip label mapping', () => {
	it( 'maps each implemented/known block_source to its human label', () => {
		expect( sourceLabel( 'woo-layer' ) ).toBe( 'Video Woo Layer' );
		expect( sourceLabel( 'shoppable-video' ) ).toBe( 'Shoppable Video' );
		expect( sourceLabel( 'reel-pop' ) ).toBe( 'Reel Pop' );
		expect( sourceLabel( 'wc-product-gallery' ) ).toBe( 'Product Gallery' );
		expect( sourceLabel( 'godam-image' ) ).toBe( 'Image Woo Layer' );
	} );

	it( 'falls back to the raw value for an unknown source', () => {
		expect( sourceLabel( 'something-new' ) ).toBe( 'something-new' );
	} );
} );

describe( 'formatRevenue — revenue_minor -> currency amount', () => {
	it( 'scales minor units by the currency fraction digits and formats with the symbol', () => {
		expect( formatRevenue( 1234, 'GBP' ) ).toBe( '£12.34' );
	} );

	it( 'formats a different ISO currency correctly', () => {
		expect( formatRevenue( 500, 'USD' ) ).toBe( '$5.00' );
	} );

	it( 'uses 0 fraction digits for a zero-decimal currency (JPY)', () => {
		const formatted = formatRevenue( 1234, 'JPY' );
		// 1234 minor units of a 0-decimal currency is 1,234 major units, not 12.34.
		expect( formatted ).toContain( '1,234' );
		expect( formatted ).not.toContain( '.' );
	} );

	it( 'uses 3 fraction digits for a three-decimal currency (KWD)', () => {
		// 1234 minor units of a 3-decimal currency is 1.234 major units.
		expect( formatRevenue( 1234, 'KWD' ) ).toContain( '1.234' );
	} );

	it( 'uses the emit-side ISO table, not Intl, for a divergent currency (IQD)', () => {
		// Intl/ICU treats IQD as 0-decimal, but the store encodes it as 3-decimal
		// (ISO 4217), so the UI must scale AND display with 3 digits or the amount
		// is 1000x off.
		expect( formatRevenue( 1234, 'IQD' ) ).toContain( '1.234' );
	} );

	it( 'treats a missing amount as zero rather than throwing', () => {
		expect( formatRevenue( undefined, 'GBP' ) ).toBe( '£0.00' );
	} );

	it( 'falls back to a plain number when the currency code is invalid', () => {
		expect( formatRevenue( 1234, 'NOT-A-CODE' ) ).toBe( '12.34 NOT-A-CODE' );
	} );
} );

describe( 'hasInfluenced — Influenced sub-line gate (third tier)', () => {
	it( 'is true only when influenced_revenue_minor is a positive number', () => {
		expect( hasInfluenced( { influenced_revenue_minor: 250000 } ) ).toBe( true );
	} );

	it( 'is false when there is no match (0), so no misleading £0 renders', () => {
		expect( hasInfluenced( { influenced_revenue_minor: 0 } ) ).toBe( false );
	} );

	it( 'is false when the service omitted the field (older build / no match)', () => {
		expect( hasInfluenced( {} ) ).toBe( false );
		expect( hasInfluenced( { influenced_revenue_minor: null } ) ).toBe( false );
	} );

	it( 'renders its amount via the shipped formatRevenue (no new formatter)', () => {
		// The sub-line uses the SAME formatRevenue as the Revenue cell, keyed on
		// the separate influenced_currency: JPY has no decimals, USD has two.
		expect( formatRevenue( 250000, 'INR' ) ).toContain( '2,500' );
		expect( formatRevenue( 1234, 'JPY' ) ).not.toContain( '.' );
		expect( formatRevenue( 500, 'USD' ) ).toBe( '$5.00' );
	} );
} );

describe( 'hasRevenueTierSplit — Direct/Assisted revenue sub-line gate', () => {
	it( 'is true only when both tier amounts are present (Woo store, product with orders)', () => {
		expect( hasRevenueTierSplit( { revenue_direct_minor: 1000, revenue_assisted_minor: 300 } ) ).toBe( true );
		// A real zero on one side is still a present split (all revenue on one tier).
		expect( hasRevenueTierSplit( { revenue_direct_minor: 0, revenue_assisted_minor: 800 } ) ).toBe( true );
	} );

	it( 'is false when the service omitted the split (older build / no base currency / no orders)', () => {
		expect( hasRevenueTierSplit( {} ) ).toBe( false );
		expect( hasRevenueTierSplit( { revenue_direct_minor: 1000 } ) ).toBe( false );
		expect( hasRevenueTierSplit( { revenue_direct_minor: null, revenue_assisted_minor: null } ) ).toBe( false );
	} );

	it( 'renders both amounts via the shipped formatRevenue', () => {
		expect( formatRevenue( 1000, 'GBP' ) ).toBe( '£10.00' );
		expect( formatRevenue( 300, 'GBP' ) ).toBe( '£3.00' );
	} );
} );

describe( 'revenuePlacements — per-placement revenue split (EASY WIN A)', () => {
	it( 'returns placements with revenue, sorted high-to-low', () => {
		const out = revenuePlacements( {
			revenue_by_placement: {
				'reel-pop': { revenue_minor: 400, orders: 1 },
				'woo-layer': { revenue_minor: 600, orders: 1 },
			},
		} );
		expect( out.map( ( p ) => p.source ) ).toEqual( [ 'woo-layer', 'reel-pop' ] );
		expect( out[ 0 ].revenue_minor ).toBe( 600 );
	} );

	it( 'drops placements with zero revenue', () => {
		const out = revenuePlacements( {
			revenue_by_placement: {
				'woo-layer': { revenue_minor: 600, orders: 1 },
				'reel-pop': { revenue_minor: 0, orders: 0 },
			},
		} );
		expect( out.map( ( p ) => p.source ) ).toEqual( [ 'woo-layer' ] );
	} );

	it( 'is empty when there is no split', () => {
		expect( revenuePlacements( {} ) ).toEqual( [] );
		expect( revenuePlacements( { revenue_by_placement: {} } ) ).toEqual( [] );
	} );
} );

describe( 'influencedOrdersLabel — singular/plural order count', () => {
	it( 'renders singular for one order', () => {
		expect( influencedOrdersLabel( { influenced_orders: 1 } ) ).toBe( '1 order' );
	} );

	it( 'renders plural for several, and zero when absent', () => {
		expect( influencedOrdersLabel( { influenced_orders: 3 } ) ).toBe( '3 orders' );
		expect( influencedOrdersLabel( {} ) ).toBe( '0 orders' );
	} );
} );

describe( 'formatRevenueNumeric — CSV plain-number revenue', () => {
	it( 'renders a dot-decimal number with no symbol for a 2-decimal currency', () => {
		expect( formatRevenueNumeric( 1234, 'GBP' ) ).toBe( '12.34' );
		expect( formatRevenueNumeric( 500, 'USD' ) ).toBe( '5.00' );
	} );

	it( 'uses the currency fraction digits (0 for JPY, 3 for KWD)', () => {
		expect( formatRevenueNumeric( 1234, 'JPY' ) ).toBe( '1234' );
		expect( formatRevenueNumeric( 1234, 'KWD' ) ).toBe( '1.234' );
	} );

	it( 'uses the emit-side table for a currency Intl disagrees on (IQD -> 3 digits)', () => {
		expect( formatRevenueNumeric( 1234, 'IQD' ) ).toBe( '1.234' );
	} );

	it( 'treats a missing amount as zero', () => {
		expect( formatRevenueNumeric( undefined, 'GBP' ) ).toBe( '0.00' );
	} );
} );
