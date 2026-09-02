/**
 * Unit tests for the Video-to-Cart KPI card's null-vs-zero guard (M1).
 *
 * The card must distinguish "metric unavailable" (an analytics service that
 * predates the video_to_cart roll-up: payload null/undefined) from a real
 * measured "0 carts". The former must render nothing so the dashboard never
 * asserts a misleading zero; the latter is a real value and must still render.
 *
 * Rendered to a static HTML string (no DOM/@testing-library needed) so the test
 * asserts the actual output the component produces.
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
import VideoToCartCard from './VideoToCartCard';

describe( 'VideoToCartCard — null vs zero', () => {
	it( 'renders nothing when the payload is null (metric unavailable)', () => {
		expect( renderToString( <VideoToCartCard videoToCart={ null } /> ) ).toBe( '' );
	} );

	it( 'renders nothing when the payload is undefined (prop omitted)', () => {
		expect( renderToString( <VideoToCartCard /> ) ).toBe( '' );
	} );

	it( 'renders the card with the count for a real payload', () => {
		const html = renderToString(
			<VideoToCartCard videoToCart={ { carts: 42, rate: 12.5, direct: 30, assisted: 12 } } />,
		);
		expect( html ).not.toBe( '' );
		expect( html ).toContain( 'godam-video-to-cart-card' );
		// The count leads the card.
		expect( html ).toContain( '42' );
		expect( html ).toContain( 'Video to Cart' );
		// Subtitle copy matches the design: what the number is + share of players.
		expect( html ).toContain( 'carts from video' );
		expect( html ).toContain( '12.5% of viewers who played' );
	} );

	it( 'still renders for a measured zero-carts payload (0 is a real value, not "unavailable")', () => {
		const html = renderToString(
			<VideoToCartCard videoToCart={ { carts: 0, rate: 0, direct: 0, assisted: 0 } } />,
		);
		// The M1 distinction: a present payload with zero carts must NOT collapse
		// to the null "render nothing" path.
		expect( html ).not.toBe( '' );
		expect( html ).toContain( 'godam-video-to-cart-value' );
		expect( html ).toContain( '0' );
	} );

	it( 'treats an empty-object payload as present (falls back to zeros, still renders)', () => {
		const html = renderToString( <VideoToCartCard videoToCart={ {} } /> );
		expect( html ).not.toBe( '' );
		expect( html ).toContain( 'godam-video-to-cart-card' );
	} );
} );
