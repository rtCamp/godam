/**
 * Unit tests for the comparative revenue tips banner (single store currency).
 *
 * A tip renders only when the service marks that comparison favourable, so an
 * unfavourable or absent comparison shows nothing (never a discouraging line).
 * Rendered to a static HTML string so the test asserts the real output.
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
import RevenueTips from './RevenueTips';

describe( 'RevenueTips — comparative tips', () => {
	it( 'renders nothing when tips are null/undefined', () => {
		expect( renderToString( <RevenueTips tips={ null } /> ) ).toBe( '' );
		expect( renderToString( <RevenueTips /> ) ).toBe( '' );
	} );

	it( 'renders nothing when no comparison is favourable', () => {
		const html = renderToString(
			<RevenueTips tips={ {
				video_aov_minor: 500, store_aov_minor: 1000, aov_favourable: false,
				revenue_per_session_minor: 0, revenue_per_session_favourable: false,
				currency: 'INR',
			} } />,
		);
		expect( html ).toBe( '' );
	} );

	it( 'renders the AOV tip with both amounts when favourable', () => {
		const html = renderToString(
			<RevenueTips tips={ {
				video_aov_minor: 200000, store_aov_minor: 100000, aov_favourable: true,
				revenue_per_session_minor: 0, revenue_per_session_favourable: false,
				currency: 'INR',
			} } />,
		);
		expect( html ).toContain( 'godam-revenue-tips' );
		expect( html ).toContain( 'average order value' );
		expect( html ).toContain( '2,000' ); // video AOV 200000 minor INR
		expect( html ).toContain( '1,000' ); // store AOV 100000 minor INR
	} );

	it( 'renders the revenue-per-session tip when favourable', () => {
		const html = renderToString(
			<RevenueTips tips={ {
				video_aov_minor: 0, store_aov_minor: 0, aov_favourable: false,
				revenue_per_session_minor: 5000, revenue_per_session_favourable: true,
				currency: 'INR',
			} } />,
		);
		expect( html ).toContain( 'per viewer' );
		expect( html ).toContain( '50' ); // 5000 minor INR = 50.00
	} );
} );
