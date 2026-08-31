/**
 * Unit tests for the GA4 connection widget's states.
 *
 * Not connected (`enable_gtm_tracking` off): shows the short pitch line and an
 * "Enable" link into General Settings, and never calls the counts endpoint.
 *
 * Connected (`enable_gtm_tracking` on) branches on the RTK query result:
 * - loading: a distinct "checking" state, no counts.
 * - error: a distinct "status unavailable" state, no counts.
 * - success + `source_active: false`: the "Sending to GA4" state with counts
 * and an "All time" caption.
 * - success + `source_active: true`: GoDAM is standing down for another GA4
 * integration — a distinct state naming `source_type`, counts relabeled as
 * "prepared" rather than sent, still with the "All time" caption.
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
		useFetchGa4CountsQuery.mockReturnValue( { data: undefined, isLoading: false, isError: false } );
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

		it( 'calls the counts endpoint (skip: false)', () => {
			renderToString( <GA4ConnectionWidget /> );

			expect( useFetchGa4CountsQuery ).toHaveBeenCalledWith(
				undefined,
				expect.objectContaining( { skip: false } ),
			);
		} );

		describe( 'while the request is in flight', () => {
			it( 'shows a loading state, not "connected" or counts', () => {
				useFetchGa4CountsQuery.mockReturnValue( { data: undefined, isLoading: true, isError: false } );

				const html = renderToString( <GA4ConnectionWidget /> );

				expect( html ).toContain( 'godam-ga4-connection-widget' );
				expect( html ).toContain( 'Checking GA4 status' );
				expect( html ).not.toContain( 'Sending to GA4' );
				expect( html ).not.toContain( 'godam-ga4-connection-add-to-cart-count' );
				expect( html ).not.toContain( 'godam-ga4-connection-purchase-count' );
				expect( html ).not.toContain( 'godam-ga4-connection-enable-link' );
			} );
		} );

		describe( 'when the request errors', () => {
			it( 'shows a distinct "status unavailable" state, not "connected" or counts', () => {
				useFetchGa4CountsQuery.mockReturnValue( { data: undefined, isLoading: false, isError: true } );

				const html = renderToString( <GA4ConnectionWidget /> );

				expect( html ).toContain( 'godam-ga4-connection-widget' );
				expect( html ).toContain( 'GA4 connection status unavailable' );
				expect( html ).not.toContain( 'Sending to GA4' );
				expect( html ).not.toContain( 'godam-ga4-connection-add-to-cart-count' );
				expect( html ).not.toContain( 'godam-ga4-connection-purchase-count' );
				expect( html ).not.toContain( '0/0' );
			} );

			it( 'does not fall back to a fake connected state with zeroed counts', () => {
				useFetchGa4CountsQuery.mockReturnValue( { data: undefined, isLoading: false, isError: true } );

				const html = renderToString( <GA4ConnectionWidget /> );

				expect( html ).not.toContain( 'single-metrics-value' );
			} );
		} );

		describe( 'successful response, source_active: false (GoDAM is the active source)', () => {
			it( 'shows the counts, a Manage link, an "All time" caption, no Enable CTA', () => {
				useFetchGa4CountsQuery.mockReturnValue( {
					data: { addToCartCount: 1234, purchaseCount: 56, sourceActive: false, sourceType: '' },
					isLoading: false,
					isError: false,
				} );

				const html = renderToString( <GA4ConnectionWidget /> );

				expect( html ).toContain( 'godam-ga4-connection-widget' );
				expect( html ).toContain( 'Sending to GA4' );
				expect( html ).toContain( 'godam-ga4-connection-add-to-cart-count' );
				expect( html ).toContain( '1,234' );
				expect( html ).toContain( 'godam-ga4-connection-purchase-count' );
				expect( html ).toContain( '56' );
				expect( html ).toContain( 'godam-ga4-connection-manage-link' );
				expect( html ).toContain( '#general-settings' );
				expect( html ).toContain( 'godam-ga4-connection-all-time-badge' );
				expect( html ).toContain( 'All time' );
				expect( html ).not.toContain( 'godam-ga4-connection-enable-link' );
				expect( html ).not.toContain( 'standing down' );
			} );

			it( 'treats a missing payload as zero counts rather than throwing', () => {
				useFetchGa4CountsQuery.mockReturnValue( {
					data: undefined,
					isLoading: false,
					isError: false,
				} );

				const html = renderToString( <GA4ConnectionWidget /> );

				expect( html ).toContain( 'godam-ga4-connection-add-to-cart-count' );
			} );
		} );

		describe( 'successful response, source_active: true (GoDAM is standing down)', () => {
			it( 'shows a standing-down state naming the other source, not "Sending to GA4"', () => {
				useFetchGa4CountsQuery.mockReturnValue( {
					data: { addToCartCount: 10, purchaseCount: 2, sourceActive: true, sourceType: 'custom' },
					isLoading: false,
					isError: false,
				} );

				const html = renderToString( <GA4ConnectionWidget /> );

				expect( html ).toContain( 'godam-ga4-connection-widget' );
				expect( html ).not.toContain( 'Sending to GA4' );
				expect( html ).toContain( 'standing down' );
				expect( html ).toContain( 'a custom GA4 integration' );
			} );

			it( 'relabels the counts as "prepared" rather than implying they were sent', () => {
				useFetchGa4CountsQuery.mockReturnValue( {
					data: { addToCartCount: 10, purchaseCount: 2, sourceActive: true, sourceType: 'manual' },
					isLoading: false,
					isError: false,
				} );

				const html = renderToString( <GA4ConnectionWidget /> );

				expect( html ).toContain( 'godam-ga4-connection-add-to-cart-count' );
				expect( html ).toContain( '10' );
				expect( html ).toContain( 'add_to_cart prepared' );
				expect( html ).toContain( 'purchase prepared' );
			} );

			it( 'still shows the "All time" caption alongside the counts', () => {
				useFetchGa4CountsQuery.mockReturnValue( {
					data: { addToCartCount: 10, purchaseCount: 2, sourceActive: true, sourceType: '' },
					isLoading: false,
					isError: false,
				} );

				const html = renderToString( <GA4ConnectionWidget /> );

				expect( html ).toContain( 'godam-ga4-connection-all-time-badge' );
			} );

			it( 'falls back to a generic phrase for an unrecognized/empty source_type', () => {
				useFetchGa4CountsQuery.mockReturnValue( {
					data: { addToCartCount: 10, purchaseCount: 2, sourceActive: true, sourceType: '' },
					isLoading: false,
					isError: false,
				} );

				const html = renderToString( <GA4ConnectionWidget /> );

				expect( html ).toContain( 'another GA4 integration' );
			} );

			it( 'still offers a Manage link back to settings', () => {
				useFetchGa4CountsQuery.mockReturnValue( {
					data: { addToCartCount: 10, purchaseCount: 2, sourceActive: true, sourceType: 'custom' },
					isLoading: false,
					isError: false,
				} );

				const html = renderToString( <GA4ConnectionWidget /> );

				expect( html ).toContain( 'godam-ga4-connection-manage-link' );
			} );
		} );
	} );
} );
