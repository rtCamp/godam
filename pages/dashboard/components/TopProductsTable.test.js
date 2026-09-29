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
 * External dependencies
 */
// TopProductsTable is a stateful function component (useState/useEffect/useRef),
// which @wordpress/element's renderToString cannot handle (its serializer has no
// hook dispatcher -> "Invalid hook call"). It is rendered client-side into a
// jsdom container instead: react-dom/client + act, the same React 18 instance
// @wordpress/element wraps. Client rendering also avoids the "useLayoutEffect
// does nothing on the server" warnings that @wordpress/components (SearchControl
// etc.) log under SSR, which the repo's jest-console setup treats as failures.
// @testing-library/react is not installed in this repo, so this is done by hand.
import { act } from 'react';
import { createRoot } from 'react-dom/client';

// act() requires this flag or React logs a console.error the jest-console setup
// fails on.
global.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Render an element into a detached jsdom container and return its innerHTML.
 * Effects run (and are cleaned up on unmount), so no debounce timer is left
 * dangling.
 *
 * @param {JSX.Element} element Element to render.
 * @return {string} The container's innerHTML after render.
 */
function renderHTML( element ) {
	const container = document.createElement( 'div' );
	document.body.appendChild( container );
	const root = createRoot( container );
	act( () => {
		root.render( element );
	} );
	const html = container.innerHTML;
	act( () => {
		root.unmount();
	} );
	container.remove();
	return html;
}

/**
 * The proxy's error-vs-empty distinction is the whole point of the render tests
 * below, so the RTK Query hooks are mocked directly rather than wired through a
 * real store/provider (same approach as GA4ConnectionWidget.test.js /
 * PlacementFunnelCard.test.js). useLazyFetchTopProductsQuery is only used for
 * the CSV export and is destructured as an array, so it returns [ fn ].
 */
jest.mock( '../redux/api/dashboardAnalyticsApi', () => ( {
	useFetchTopProductsQuery: jest.fn(),
	useLazyFetchTopProductsQuery: jest.fn( () => [ jest.fn() ] ),
} ) );

// The date-range picker header widget is incidental to the error-vs-empty table
// body under test and has its own test suite; stub it out so these tests stay
// focused on TopProductsTable's own render branches.
jest.mock( '../../analytics/components/DateRangePicker', () => ( {
	__esModule: true,
	default: () => null,
} ) );

/**
 * Internal dependencies
 */
import TopProductsTable, { escapeCsvCell, sourceLabel, formatRevenue, formatRevenueNumeric, hasInfluenced, influencedOrdersLabel, revenuePlacements, hasRevenueTierSplit, buildCsvRow, CSV_HEADERS, CSV_HEADERS_BASE } from './TopProductsTable';
import { useFetchTopProductsQuery, useLazyFetchTopProductsQuery } from '../redux/api/dashboardAnalyticsApi';

// The Revenue column and its orders line come from orders, so the tests below run
// as a user who may see order data (the flag PHP localizes from WooCommerce's
// report permission); the "without order access" block at the end turns it off.
beforeEach( () => {
	window.videoData = { canViewRevenue: true };
} );

afterEach( () => {
	delete window.videoData;
} );

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

	it( 'prefixes AND quotes a value that leads with a carriage return', () => {
		// A leading CR is both a formula trigger (a spreadsheet strips it, then sees
		// =) and a record separator, so it is single-quote prefixed and then
		// field-quoted so it cannot break out of its cell.
		const out = escapeCsvCell( '\r=1+1' );
		expect( out ).toBe( '"\'\r=1+1"' );
		expect( out.startsWith( '"' ) ).toBe( true );
	} );

	it( 'prefixes AND quotes a value that leads with a newline so it cannot break out of its cell', () => {
		// A leading newline is both a formula trigger and a record separator: it is
		// single-quote prefixed, then the field-quoting pass wraps it in double
		// quotes so the payload stays inside one cell rather than starting a new
		// record a spreadsheet would then evaluate.
		const out = escapeCsvCell( '\n=1+1' );
		expect( out ).toBe( '"\'\n=1+1"' );
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

		it( 'quotes (but does not formula-prefix) a plain value containing an interior carriage return', () => {
			// An interior CR is not a formula trigger (it does not lead the value),
			// but it is a record separator, so it must be field-quoted to keep the
			// value inside a single cell.
			expect( escapeCsvCell( 'Mug\rBlue' ) ).toBe( '"Mug\rBlue"' );
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

describe( 'buildCsvRow — the CSV mirrors the on-screen table', () => {
	const cell = ( row, header ) => row[ CSV_HEADERS.indexOf( header ) ];

	it( 'emits exactly one cell per header, in order', () => {
		const row = buildCsvRow( { product_id: 5, title: 'Sofa' } );
		expect( row ).toHaveLength( CSV_HEADERS.length );
	} );

	it( 'carries reach, the Influenced tier and the per-placement split, matching the row on screen', () => {
		const item = {
			product_id: 5,
			title: 'Sofa',
			layer_count: 3,
			video_count: 3,
			sources: [ 'shoppable-video', 'woo-layer', 'reel-pop' ],
			product_views: 9,
			product_views_ctr: 50,
			added_to_cart: 17,
			added_to_cart_direct: 0,
			added_to_cart_assisted: 17,
			revenue_minor: 8000,
			currency: 'INR',
			orders: 2,
			revenue_direct_minor: 0,
			revenue_assisted_minor: 8000,
			influenced_revenue_minor: 6000,
			influenced_currency: 'INR',
			influenced_orders: 1,
			influenced_provisional: true,
			revenue_by_placement: {
				'shoppable-video': { revenue_minor: 5000 },
				'woo-layer': { revenue_minor: 3000 },
			},
		};
		const row = buildCsvRow( item );
		expect( cell( row, 'Layers' ) ).toBe( 3 );
		expect( cell( row, 'Videos' ) ).toBe( 3 );
		expect( cell( row, 'Source' ) ).toContain( 'Shoppable Video' );
		expect( cell( row, 'Revenue' ) ).toBe( '80.00' );
		expect( cell( row, 'Revenue (assisted)' ) ).toBe( '80.00' );
		expect( cell( row, 'Influenced Revenue' ) ).toBe( '60.00' );
		expect( cell( row, 'Influenced Orders' ) ).toBe( 1 );
		expect( cell( row, 'Influenced Provisional' ) ).toBe( 'Yes' );
		expect( cell( row, 'Revenue by Placement' ) ).toContain( 'Shoppable Video: 50.00' );
		expect( cell( row, 'Revenue by Placement' ) ).toContain( 'Video Woo Layer: 30.00' );
	} );

	it( 'leaves Influenced and the placement split empty when the row has neither (matches the table)', () => {
		const item = {
			product_id: 6,
			title: 'Lamp',
			revenue_minor: 1000,
			currency: 'INR',
			orders: 1,
			revenue_by_placement: { 'woo-layer': { revenue_minor: 1000 } }, // single placement
		};
		const row = buildCsvRow( item );
		expect( cell( row, 'Influenced Revenue' ) ).toBe( '' );
		expect( cell( row, 'Revenue by Placement' ) ).toBe( '' );
	} );
} );

describe( 'order-count labels use grouped thousands', () => {
	it( 'groups a 1,000+ order count and keeps the singular for one', () => {
		expect( influencedOrdersLabel( { influenced_orders: 1234 } ) ).toBe( '1,234 orders' );
		expect( influencedOrdersLabel( { influenced_orders: 1 } ) ).toBe( '1 order' );
	} );
} );

describe( 'TopProductsTable — error vs empty state', () => {
	beforeEach( () => {
		useFetchTopProductsQuery.mockReset();
	} );

	it( 'shows the distinct error row on a failed request, not the empty-state copy', () => {
		// transformResponse rejects a status:error proxy response, so the query
		// surfaces isError with no data. That must read as a load failure, not as
		// a genuine "no product activity" result.
		useFetchTopProductsQuery.mockReturnValue( { data: undefined, isFetching: false, isError: true } );

		const html = renderHTML( <TopProductsTable siteUrl="https://example.test" /> );

		expect( html ).toContain( 'godam-top-products-error' );
		expect( html ).not.toContain( 'No product activity yet' );
	} );

	it( 'shows the empty state when a loaded store has no product activity', () => {
		useFetchTopProductsQuery.mockReturnValue( { data: { products: [] }, isFetching: false, isError: false } );

		const html = renderHTML( <TopProductsTable siteUrl="https://example.test" /> );

		expect( html ).toContain( 'No product activity yet' );
		expect( html ).not.toContain( 'godam-top-products-error' );
	} );
} );

describe( 'TopProductsTable — base-currency note', () => {
	it( 'names the store base currency (from the rows) so a mixed-currency store is not confusing', () => {
		useFetchTopProductsQuery.mockReturnValue( {
			data: {
				products: [ { product_id: 1, title: 'A', revenue_minor: 6100, currency: 'USD', orders: 1 } ],
				totalItems: 1,
				totalPages: 1,
			},
			isFetching: false,
			isError: false,
		} );
		const html = renderHTML( <TopProductsTable siteUrl="https://example.test" /> );
		expect( html ).toContain( 'godam-top-products-currency-note' );
		expect( html ).toContain( 'base currency' );
		expect( html ).toContain( 'USD' );
	} );

	it( 'omits the note when no row carries a currency (non-Woo / no revenue yet)', () => {
		useFetchTopProductsQuery.mockReturnValue( {
			data: { products: [ { product_id: 1, title: 'A' } ], totalItems: 1, totalPages: 1 },
			isFetching: false,
			isError: false,
		} );
		const html = renderHTML( <TopProductsTable siteUrl="https://example.test" /> );
		expect( html ).not.toContain( 'godam-top-products-currency-note' );
	} );
} );

describe( 'TopProductsTable without order access', () => {
	// What the route sends a user who may not see order data: views, impressions
	// and add-to-carts only. The currency is order-derived too, so it is gone.
	const CART_ONLY_ROW = {
		product_id: 1,
		title: 'Mug',
		product_views: 40,
		product_views_ctr: 12.5,
		added_to_cart: 9,
		added_to_cart_direct: 6,
		added_to_cart_assisted: 3,
		sources: [ 'woo-layer' ],
		video_count: 2,
		layer_count: 1,
	};

	const FULL_ROW = {
		...CART_ONLY_ROW,
		revenue_minor: 4500,
		orders: 3,
		currency: 'USD',
		revenue_direct_minor: 3000,
		revenue_assisted_minor: 1500,
		influenced_revenue_minor: 900,
		influenced_currency: 'USD',
		influenced_orders: 1,
		influenced_provisional: false,
	};

	beforeEach( () => {
		window.videoData = { canViewRevenue: false };
		useFetchTopProductsQuery.mockReturnValue( {
			data: { products: [ CART_ONLY_ROW ], totalItems: 1, totalPages: 1 },
			isFetching: false,
			isError: false,
		} );
	} );

	it( 'drops the Revenue column and keeps views and add-to-carts', () => {
		const html = renderHTML( <TopProductsTable siteUrl="https://example.test" /> );
		expect( html ).not.toContain( 'godam-top-products-revenue' );
		expect( html ).not.toContain( 'No data' );
		expect( html ).not.toContain( '>Revenue<' );
		expect( html ).toContain( 'Product Views' );
		expect( html ).toContain( 'Add to Cart' );
		expect( html ).toContain( '>40<' );
		expect( html ).toContain( '>9<' );
		expect( html ).toContain( 'Mug' );
	} );

	it( 'shows four header cells, not five', () => {
		const html = renderHTML( <TopProductsTable siteUrl="https://example.test" /> );
		expect( ( html.match( /<th /g ) || [] ).length ).toBe( 4 );
	} );

	it( 'drops the base-currency note even when a row carries a currency', () => {
		useFetchTopProductsQuery.mockReturnValue( {
			data: { products: [ FULL_ROW ], totalItems: 1, totalPages: 1 },
			isFetching: false,
			isError: false,
		} );
		const html = renderHTML( <TopProductsTable siteUrl="https://example.test" /> );
		expect( html ).not.toContain( 'godam-top-products-currency-note' );
		expect( html ).not.toContain( 'godam-top-products-revenue' );
		expect( html ).not.toContain( 'godam-top-products-influenced' );
	} );

	it( 'spans the empty and error rows over the four columns', () => {
		useFetchTopProductsQuery.mockReturnValue( { data: { products: [], totalItems: 0, totalPages: 1 }, isFetching: false, isError: false } );
		expect( renderHTML( <TopProductsTable siteUrl="https://example.test" /> ) ).toContain( 'colspan="4"' );
		useFetchTopProductsQuery.mockReturnValue( { data: undefined, isFetching: false, isError: true, error: { message: 'boom' } } );
		expect( renderHTML( <TopProductsTable siteUrl="https://example.test" /> ) ).toContain( 'colspan="4"' );
	} );

	it( 'keeps five columns for a user who may see order data', () => {
		window.videoData = { canViewRevenue: true };
		useFetchTopProductsQuery.mockReturnValue( {
			data: { products: [ FULL_ROW ], totalItems: 1, totalPages: 1 },
			isFetching: false,
			isError: false,
		} );
		const html = renderHTML( <TopProductsTable siteUrl="https://example.test" /> );
		expect( ( html.match( /<th /g ) || [] ).length ).toBe( 5 );
		expect( html ).toContain( 'godam-top-products-revenue' );
	} );

	describe( 'CSV export', () => {
		it( 'buildCsvRow without revenue emits one cell per base header and no order cells', () => {
			const row = buildCsvRow( FULL_ROW, false );
			expect( row ).toHaveLength( CSV_HEADERS_BASE.length );
			expect( row.map( String ) ).not.toContain( '45.00' );
			expect( row.map( String ) ).not.toContain( 'USD' );
			// The shared columns are the first cells of the full row, unchanged.
			expect( row ).toEqual( buildCsvRow( FULL_ROW ).slice( 0, CSV_HEADERS_BASE.length ) );
		} );

		it( 'the full headers are the base headers plus the order-derived ones', () => {
			expect( CSV_HEADERS.slice( 0, CSV_HEADERS_BASE.length ) ).toEqual( CSV_HEADERS_BASE );
			expect( CSV_HEADERS_BASE ).not.toContain( 'Revenue' );
			expect( CSV_HEADERS_BASE ).not.toContain( 'Orders' );
			expect( CSV_HEADERS_BASE ).not.toContain( 'Currency' );
			expect( CSV_HEADERS ).toContain( 'Revenue' );
		} );

		/**
		 * Click Export and capture the CSV text the component builds.
		 *
		 * @return {Promise<string>} The CSV content.
		 */
		async function exportedCsv() {
			const fetchForExport = jest.fn( () => ( { unwrap: () => Promise.resolve( { products: [ FULL_ROW ] } ) } ) );
			useLazyFetchTopProductsQuery.mockReturnValue( [ fetchForExport ] );

			const parts = [];
			const RealBlob = global.Blob;
			global.Blob = class {
				constructor( chunks ) {
					parts.push( ...chunks );
				}
			};
			global.URL.createObjectURL = jest.fn( () => 'blob:test' );
			global.URL.revokeObjectURL = jest.fn();
			// The download link is clicked programmatically; jsdom cannot navigate to a blob URL.
			const clickSpy = jest.spyOn( HTMLAnchorElement.prototype, 'click' ).mockImplementation( () => {} );

			const container = document.createElement( 'div' );
			document.body.appendChild( container );
			const root = createRoot( container );
			act( () => {
				root.render( <TopProductsTable siteUrl="https://example.test" /> );
			} );
			await act( async () => {
				container.querySelector( '[data-test-id="godam-top-products-export"]' ).click();
			} );
			act( () => {
				root.unmount();
			} );
			container.remove();
			global.Blob = RealBlob;
			clickSpy.mockRestore();
			return parts.join( '' );
		}

		it( 'the exported file has no revenue, orders or currency columns', async () => {
			const csv = await exportedCsv();
			const [ header, line ] = csv.split( '\n' );
			expect( header.split( ',' ) ).toEqual( CSV_HEADERS_BASE );
			expect( line ).toContain( 'Mug' );
			expect( csv ).not.toContain( 'Revenue' );
			expect( csv ).not.toContain( 'USD' );
			expect( csv ).not.toContain( '45.00' );
		} );

		it( 'the exported file keeps every column for a user who may see order data', async () => {
			window.videoData = { canViewRevenue: true };
			const csv = await exportedCsv();
			const [ header, line ] = csv.split( '\n' );
			expect( header.split( ',' ) ).toEqual( CSV_HEADERS );
			expect( line ).toContain( '45.00' );
			expect( line ).toContain( 'USD' );
		} );
	} );
} );
