/**
 * Unit tests for AnalyticsSectionError — the scoped, actionable error shown when
 * a single analytics section's range query fails (or the service reports that
 * section unavailable). It must surface the failure, never render empty, and
 * only offer a "Try again" action when a retry handler is supplied.
 *
 * Rendered to a static HTML string (the pattern used across this repo's card
 * tests — see VideoToCartCard.test.js), so the assertions check the actual
 * output the component produces. The onClick wiring is a one-line pass-through
 * (`onClick={ onRetry }`) and is not exercised here.
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
import AnalyticsSectionError from './AnalyticsSectionError';

describe( 'AnalyticsSectionError', () => {
	it( 'renders a non-empty scoped error with the default message', () => {
		const html = renderToString( <AnalyticsSectionError /> );
		expect( html ).not.toBe( '' );
		expect( html ).toContain( 'godam-analytics-section-error' );
		// "couldn’t load" — match around the curly apostrophe.
		expect( html ).toMatch( /couldn.t load/ );
	} );

	it( 'renders a "Try again" action only when onRetry is provided', () => {
		const withRetry = renderToString(
			<AnalyticsSectionError onRetry={ () => {} } />,
		);
		expect( withRetry ).toContain( 'Try again' );
		expect( withRetry ).toContain( 'godam-analytics-section-error__retry' );

		const withoutRetry = renderToString( <AnalyticsSectionError /> );
		expect( withoutRetry ).not.toContain( 'Try again' );
	} );

	it( 'honours a custom message', () => {
		const html = renderToString(
			<AnalyticsSectionError message="WooCommerce metrics couldn’t load." />,
		);
		expect( html ).toContain( 'WooCommerce metrics' );
	} );

	it( 'uses the supplied test id', () => {
		const html = renderToString(
			<AnalyticsSectionError testId="godam-dashboard-gauge-error" />,
		);
		expect( html ).toContain( 'godam-dashboard-gauge-error' );
	} );
} );
