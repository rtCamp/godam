/**
 * Unit tests for the Video-to-Purchase KPI card's null-vs-zero guard.
 *
 * Mirrors VideoToCartCard: the card must distinguish "metric unavailable" (an
 * analytics service that predates the video_to_purchase read: payload
 * null/undefined) from a real measured "0 purchases". The former renders nothing
 * so the Insights row never asserts a misleading zero; the latter is a real value
 * and must still render.
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
import VideoToPurchaseCard from './VideoToPurchaseCard';

describe( 'VideoToPurchaseCard — null vs zero', () => {
	it( 'renders nothing when the payload is null (metric unavailable)', () => {
		expect( renderToString( <VideoToPurchaseCard videoToPurchase={ null } /> ) ).toBe( '' );
	} );

	it( 'renders nothing when the payload is undefined (prop omitted)', () => {
		expect( renderToString( <VideoToPurchaseCard /> ) ).toBe( '' );
	} );

	it( 'renders the card with the count for a real payload', () => {
		const html = renderToString(
			<VideoToPurchaseCard videoToPurchase={ { purchases: 7, rate: 17.5 } } />,
		);
		expect( html ).not.toBe( '' );
		expect( html ).toContain( 'godam-video-to-purchase-card' );
		// The count leads the card.
		expect( html ).toContain( '7' );
		expect( html ).toContain( 'Video to Purchase' );
	} );

	it( 'still renders for a measured zero-purchases payload (0 is a real value, not "unavailable")', () => {
		const html = renderToString(
			<VideoToPurchaseCard videoToPurchase={ { purchases: 0, rate: 0 } } />,
		);
		expect( html ).not.toBe( '' );
		expect( html ).toContain( 'godam-video-to-purchase-value' );
		expect( html ).toContain( '0' );
	} );

	it( 'treats an empty-object payload as present (falls back to zeros, still renders)', () => {
		const html = renderToString( <VideoToPurchaseCard videoToPurchase={ {} } /> );
		expect( html ).not.toBe( '' );
		expect( html ).toContain( 'godam-video-to-purchase-card' );
	} );
} );
