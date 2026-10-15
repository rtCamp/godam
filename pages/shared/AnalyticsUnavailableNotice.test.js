/**
 * Unit tests for AnalyticsUnavailableNotice, the card shown in place of the
 * Dashboard or single-video Analytics page while the analytics service is down.
 * It must always offer Contact Support, offer "Try again" only with a retry
 * handler, show the in-flight state, and keep the test id QA's suite uses.
 *
 * Rendered to a static HTML string, the pattern used by AnalyticsSectionError.test.js.
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
import AnalyticsUnavailableNotice from './AnalyticsUnavailableNotice';
import { SUPPORT_URL } from './ContactSupportLink';

describe( 'AnalyticsUnavailableNotice', () => {
	it( 'says analytics is unavailable and that videos keep playing', () => {
		const html = renderToString( <AnalyticsUnavailableNotice /> );
		expect( html ).toContain( 'Analytics are temporarily unavailable' );
		expect( html ).toContain( 'your videos are playing normally' );
	} );

	it( 'floats over a faded, hidden-from-screen-readers outline of the page', () => {
		const dashboard = renderToString( <AnalyticsUnavailableNotice /> );
		expect( dashboard ).toMatch( /class="godam-analytics-unavailable__outline" aria-hidden="true"/ );
		expect( dashboard ).toContain( 'godam-analytics-unavailable__outline-title' );

		// The single-video page is not the Dashboard, so its outline has no title.
		expect( renderToString( <AnalyticsUnavailableNotice area="analytics" /> ) ).not.toContain( 'godam-analytics-unavailable__outline-title' );
	} );

	it( 'keeps the area test id on the root', () => {
		expect( renderToString( <AnalyticsUnavailableNotice /> ) ).toContain( 'data-test-id="godam-dashboard-notice-analytics-unavailable"' );
		expect( renderToString( <AnalyticsUnavailableNotice area="analytics" /> ) ).toContain( 'data-test-id="godam-analytics-notice-analytics-unavailable"' );
	} );

	it( 'always links to Contact Support in a new tab', () => {
		const html = renderToString( <AnalyticsUnavailableNotice area="analytics" /> );
		expect( html ).toContain( `href="${ SUPPORT_URL }"` );
		expect( html ).toContain( 'target="_blank"' );
		expect( html ).toContain( 'Contact Support' );
		expect( html ).toContain( 'data-test-id="godam-analytics-link-contact-support"' );
	} );

	it( 'offers "Try again" only when a retry handler is supplied', () => {
		const withRetry = renderToString( <AnalyticsUnavailableNotice onRetry={ () => {} } /> );
		expect( withRetry ).toContain( '<span>Try again</span>' );
		expect( withRetry ).toContain( 'data-test-id="godam-dashboard-button-analytics-retry"' );

		// The message itself says "Try again in a moment", so check for the button.
		expect( renderToString( <AnalyticsUnavailableNotice /> ) ).not.toContain( 'godam-analytics-unavailable__retry' );
	} );

	it( 'shows an aria-disabled "Checking…" button while a retry is in flight', () => {
		const html = renderToString( <AnalyticsUnavailableNotice onRetry={ () => {} } checking /> );
		expect( html ).toContain( '<span>Checking…</span>' );
		expect( html ).not.toContain( '<span>Try again</span>' );
		expect( html ).toContain( 'aria-disabled="true"' );
		expect( html ).not.toMatch( /<button[^>]*\sdisabled[\s=>]/ );
	} );

	it( 'shows the last-checked time and the error code to quote to support', () => {
		const html = renderToString(
			<AnalyticsUnavailableNotice lastChecked={ new Date( 2026, 9, 15, 12, 19 ) } errorCode="microservice_error" />,
		);
		expect( html ).toContain( 'Last checked' );
		expect( html ).toContain( '<code>microservice_error</code>' );
	} );

	it( 'leaves out the details row when there is nothing to show', () => {
		expect( renderToString( <AnalyticsUnavailableNotice /> ) ).not.toContain( 'godam-analytics-unavailable__meta' );
	} );
} );
