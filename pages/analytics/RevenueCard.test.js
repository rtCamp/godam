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

	it( 'renders nothing when revenue_minor is null (no revenue-bearing row)', () => {
		// The per-video page always builds the payload object inline, so a service
		// revenue:null arrives as { revenue_minor: null, ... } (a truthy object).
		// The card must still hide it, not render a misleading "0".
		expect(
			renderToString(
				<RevenueCard revenue={ { revenue_minor: null, currency: 'INR', excluded_orders: 0 } } />,
			),
		).toBe( '' );
	} );

	it( 'renders the "Video-Attributed Revenue" title and the before-refunds label', () => {
		const html = renderToString(
			<RevenueCard revenue={ { revenue_minor: 324000, currency: 'GBP', excluded_orders: 0, direct_minor: 239800, assisted_minor: 84200, influenced_minor: 191000 } } />,
		);
		expect( html ).toContain( 'Video-Attributed Revenue' );
		expect( html ).toContain( 'before refunds' );
	} );

	it( 'renders the Direct and Assisted split amounts', () => {
		const html = renderToString(
			<RevenueCard revenue={ { revenue_minor: 324000, currency: 'GBP', excluded_orders: 0, direct_minor: 239800, assisted_minor: 84200 } } />,
		);
		expect( html ).toContain( 'godam-revenue-direct' );
		expect( html ).toContain( 'godam-revenue-assisted' );
		expect( html ).toContain( '2,398' ); // direct: 239800 minor = 2,398.00
		expect( html ).toContain( '842' ); // assisted: 84200 minor = 842.00
	} );

	it( 'headlines Direct + Assisted so the total equals the parts, even if the service total differs', () => {
		// Service total (10000 -> 100.00) diverges from the split (4000 + 4000 ->
		// 80.00). The headline shows the split sum so it matches the bar below.
		const html = renderToString(
			<RevenueCard revenue={ { revenue_minor: 10000, currency: 'INR', excluded_orders: 0, direct_minor: 4000, assisted_minor: 4000 } } />,
		);
		expect( html ).toContain( '80.00' ); // Direct + Assisted
		expect( html ).not.toContain( '100.00' ); // not the diverging service total
	} );

	it( 'shows the Influenced box only when influenced_minor is present (dashboard, not per-video)', () => {
		const withInfluenced = renderToString(
			<RevenueCard revenue={ { revenue_minor: 100, currency: 'GBP', direct_minor: 100, assisted_minor: 0, influenced_minor: 191000 } } />,
		);
		expect( withInfluenced ).toContain( 'godam-revenue-influenced' );
		expect( withInfluenced ).toContain( '1,910' ); // 191000 minor = 1,910.00

		// The per-video payload omits influenced_minor, so the box is hidden.
		const perVideo = renderToString(
			<RevenueCard revenue={ { revenue_minor: 100, currency: 'GBP', direct_minor: 100, assisted_minor: 0 } } />,
		);
		expect( perVideo ).not.toContain( 'godam-revenue-influenced' );
	} );

	it( 'renders a negative revenue_minor (net refund) as a signed amount, not a wrapped or NaN value', () => {
		// The card is "before refunds" and refunds are out of scope (issue #26), so a
		// net-negative revenue is not expected in normal operation — but if one
		// arrives it must render a sane signed amount, never wrap or crash. See findings.
		const html = renderToString(
			<RevenueCard revenue={ { revenue_minor: -46700, currency: 'USD', excluded_orders: 0 } } />,
		);
		expect( html ).toContain( 'godam-revenue-card' ); // still renders
		expect( html ).not.toBe( '' );
		expect( html ).toContain( '467.00' ); // magnitude, formatted to 2dp
		expect( html ).toMatch( /-\D*467\.00/ ); // rendered as a negative bound to the amount
		expect( html ).not.toContain( 'NaN' );
	} );

	it( 'renders a fully negative Direct/Assisted split sanely (no negative bar width, no NaN)', () => {
		// A refund-heavy split: headline is the split sum (-80.00), and each leg is
		// its own signed amount. The split bar must not take a negative width.
		const html = renderToString(
			<RevenueCard revenue={ { revenue_minor: -8000, currency: 'INR', excluded_orders: 0, direct_minor: -5000, assisted_minor: -3000 } } />,
		);
		expect( html ).toContain( 'godam-revenue-card' );
		expect( html ).toMatch( /-\D*80\.00/ ); // headline = Direct + Assisted = -80.00
		expect( html ).toContain( '50.00' ); // direct leg magnitude
		expect( html ).toContain( '30.00' ); // assisted leg magnitude
		// splitTotal <= 0 collapses both fractions to 0%, never a negative width.
		expect( html ).not.toMatch( /width:\s*-/ );
		expect( html ).not.toContain( 'NaN' );
	} );
} );
