/**
 * Unit tests for the Revenue KPI card (single store currency).
 *
 * Used by both the dashboard Insights row and the per-video Analytics page. It
 * must: render nothing when the payload is absent (metric unavailable, so no
 * misleading "0"), render the base-currency amount via the shipped formatRevenue,
 * show the "excluding N orders in other currencies" sub-line only when there are
 * any, and still render a real measured 0.
 *
 * Rendered to a static HTML string (no DOM needed) so the test asserts the actual
 * output the component produces.
 *
 * @package
 */

/**
 * WordPress dependencies
 */
import { renderToString } from '@wordpress/element';

/**
 * Internal dependencies
 */
import RevenueCard from './RevenueCard';

describe( 'RevenueCard — single store currency', () => {
	it( 'renders nothing when the payload is null (metric unavailable)', () => {
		expect( renderToString( <RevenueCard revenue={ null } /> ) ).toBe( '' );
	} );

	it( 'renders nothing when the payload is undefined (prop omitted)', () => {
		expect( renderToString( <RevenueCard /> ) ).toBe( '' );
	} );

	it( 'renders the base-currency amount via formatRevenue', () => {
		const html = renderToString(
			<RevenueCard revenue={ { revenue_minor: 250000, currency: 'INR', excluded_orders: 0 } } />,
		);
		expect( html ).toContain( 'godam-revenue-card' );
		expect( html ).toContain( '2,500' ); // 250000 minor INR = 2,500.00, full number
		expect( html ).not.toContain( 'excluding' ); // nothing excluded
	} );

	it( 'shows the excluded-orders sub-line when there are orders in other currencies', () => {
		const html = renderToString(
			<RevenueCard revenue={ { revenue_minor: 46700, currency: 'USD', excluded_orders: 33 } } />,
		);
		expect( html ).toContain( 'excluding 33 orders in other currencies' );
	} );

	it( 'uses the singular for exactly one excluded order', () => {
		const html = renderToString(
			<RevenueCard revenue={ { revenue_minor: 1200, currency: 'INR', excluded_orders: 1 } } />,
		);
		expect( html ).toContain( 'excluding 1 order in other currencies' );
	} );

	it( 'renders a real measured 0 (present payload), not nothing', () => {
		const html = renderToString(
			<RevenueCard revenue={ { revenue_minor: 0, currency: 'INR', excluded_orders: 0 } } />,
		);
		expect( html ).toContain( 'godam-revenue-card' );
		expect( html ).not.toBe( '' );
	} );
} );
