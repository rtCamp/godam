/**
 * Unit tests for MetricTrend — the metric-card footer that shows a trend badge
 * when there is a period-over-period change, and otherwise the range label (or
 * nothing when the caller supplies neither).
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
import MetricTrend from './MetricTrend';

describe( 'MetricTrend', () => {
	it( 'shows an up arrow and green colour for a positive change', () => {
		const html = renderToString(
			<MetricTrend change={ 12.4 } deltaLabel="vs previous 7 days" />,
		);
		expect( html ).toContain( '↗' );
		expect( html ).toContain( '12.40%' );
		expect( html ).toContain( 'vs previous 7 days' );
		expect( html ).toContain( '#15803D' ); // green
	} );

	it( 'shows a down arrow and red colour for a negative change', () => {
		const html = renderToString( <MetricTrend change={ -8 } deltaLabel="vs previous 7 days" /> );
		expect( html ).toContain( '↘' );
		expect( html ).toContain( '8.00%' );
		expect( html ).toContain( '#B91C1C' ); // red
	} );

	it( 'shows a flat neutral badge for exactly 0%, not green growth', () => {
		const html = renderToString( <MetricTrend change={ 0 } deltaLabel="vs previous 7 days" /> );
		expect( html ).toContain( '→' ); // flat arrow
		expect( html ).toContain( '0.00%' );
		expect( html ).not.toContain( '↗' ); // not an up arrow
		expect( html ).not.toContain( '#15803D' ); // not green
	} );

	it( 'falls back to the range label when there is no change (KPI tiles)', () => {
		const html = renderToString( <MetricTrend change={ null } dataLabel="All time" /> );
		expect( html ).toContain( 'All time' );
		expect( html ).not.toContain( '↗' );
		expect( html ).not.toContain( '↘' );
	} );

	it( 'renders nothing when there is neither a change nor a range label (revenue card)', () => {
		expect( renderToString( <MetricTrend change={ undefined } /> ) ).toBe( '' );
	} );
} );
