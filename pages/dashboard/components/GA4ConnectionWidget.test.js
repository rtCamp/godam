/**
 * Unit tests for the GA4 connection widget's two states.
 *
 * Not connected (`enable_gtm_tracking` off): shows the short pitch line and an
 * "Enable" link into General Settings, and never calls the counts endpoint.
 * Connected (`enable_gtm_tracking` on): shows the add_to_cart/purchase counts
 * from the (mocked) RTK query and a "Manage" link back to the same settings tab.
 *
 * Rendered to a static HTML string (no @testing-library/react in this repo — see
 * VideoToCartCard.test.js for the same pattern), with the RTK query hook mocked
 * directly rather than wired through a real store/provider.
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
import { useFetchGa4CountsQuery } from '../redux/api/dashboardAnalyticsApi';
import GA4ConnectionWidget from './GA4ConnectionWidget';

jest.mock( '../redux/api/dashboardAnalyticsApi', () => ( {
	useFetchGa4CountsQuery: jest.fn(),
} ) );

describe( 'GA4ConnectionWidget', () => {
	const originalGodamSettings = window.godamSettings;
	const originalVideoData = window.videoData;

	beforeEach( () => {
		useFetchGa4CountsQuery.mockReset();
		useFetchGa4CountsQuery.mockReturnValue( { data: undefined } );
		window.videoData = { adminUrl: 'admin.php?page=rtgodam_settings#video-settings' };
	} );

	afterEach( () => {
		window.godamSettings = originalGodamSettings;
		window.videoData = originalVideoData;
	} );

	describe( 'not connected (enable_gtm_tracking off)', () => {
		beforeEach( () => {
			window.godamSettings = { enableGTMTracking: false };
		} );

		it( 'shows the pitch line and an Enable link, no counts', () => {
			const html = renderToString( <GA4ConnectionWidget /> );

			expect( html ).toContain( 'godam-ga4-connection-widget' );
			expect( html ).toContain( 'Send add_to_cart and purchase to your GA4' );
			expect( html ).toContain( 'godam-ga4-connection-enable-link' );
			expect( html ).toContain( '#general-settings' );
			expect( html ).not.toContain( 'godam-ga4-connection-add-to-cart-count' );
			expect( html ).not.toContain( 'godam-ga4-connection-purchase-count' );
			expect( html ).not.toContain( 'godam-ga4-connection-manage-link' );
		} );

		it( 'never calls the counts endpoint (skip: true)', () => {
			renderToString( <GA4ConnectionWidget /> );

			expect( useFetchGa4CountsQuery ).toHaveBeenCalledWith(
				undefined,
				expect.objectContaining( { skip: true } ),
			);
		} );
	} );

	describe( 'connected (enable_gtm_tracking on)', () => {
		beforeEach( () => {
			window.godamSettings = { enableGTMTracking: true };
		} );

		it( 'shows the counts from the API response and a Manage link, no Enable CTA', () => {
			useFetchGa4CountsQuery.mockReturnValue( {
				data: { addToCartCount: 1234, purchaseCount: 56 },
			} );

			const html = renderToString( <GA4ConnectionWidget /> );

			expect( html ).toContain( 'godam-ga4-connection-widget' );
			expect( html ).toContain( 'godam-ga4-connection-add-to-cart-count' );
			expect( html ).toContain( '1,234' );
			expect( html ).toContain( 'godam-ga4-connection-purchase-count' );
			expect( html ).toContain( '56' );
			expect( html ).toContain( 'godam-ga4-connection-manage-link' );
			expect( html ).toContain( '#general-settings' );
			expect( html ).not.toContain( 'godam-ga4-connection-enable-link' );
		} );

		it( 'calls the counts endpoint (skip: false)', () => {
			renderToString( <GA4ConnectionWidget /> );

			expect( useFetchGa4CountsQuery ).toHaveBeenCalledWith(
				undefined,
				expect.objectContaining( { skip: false } ),
			);
		} );

		it( 'treats a missing payload as zero counts rather than throwing', () => {
			useFetchGa4CountsQuery.mockReturnValue( { data: undefined } );

			const html = renderToString( <GA4ConnectionWidget /> );

			expect( html ).toContain( 'godam-ga4-connection-add-to-cart-count' );
		} );
	} );
} );
