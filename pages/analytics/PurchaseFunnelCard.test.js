/**
 * Unit tests for the per-video Purchase Funnel card.
 *
 * Covers the null guard (absent payload -> renders nothing), the three stages
 * with their counts and shares, the drop-off between stages, and the
 * "still counting" note toggling purely on the backend flag.
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
import PurchaseFunnelCard from './PurchaseFunnelCard';

const FUNNEL = {
	stages: [
		{ key: 'viewers', count: 4, rate: 100 },
		{ key: 'added_to_cart', count: 1, rate: 25 },
		{ key: 'purchased', count: 1, rate: 25 },
	],
	still_counting: false,
};

describe( 'PurchaseFunnelCard', () => {
	it( 'renders nothing when the payload is absent', () => {
		expect( renderToString( <PurchaseFunnelCard funnel={ null } /> ) ).toBe( '' );
		expect( renderToString( <PurchaseFunnelCard /> ) ).toBe( '' );
		expect( renderToString( <PurchaseFunnelCard funnel={ { stages: [] } } /> ) ).toBe( '' );
	} );

	it( 'renders the three stages with counts and labels', () => {
		const html = renderToString( <PurchaseFunnelCard funnel={ FUNNEL } /> );
		expect( html ).toContain( 'godam-purchase-funnel-card' );
		expect( html ).toContain( 'Viewers' );
		expect( html ).toContain( 'Added to cart' );
		expect( html ).toContain( 'Purchased' );
		// A bar per stage.
		expect( html ).toContain( 'godam-purchase-funnel-bar-viewers' );
		expect( html ).toContain( 'godam-purchase-funnel-bar-added_to_cart' );
		expect( html ).toContain( 'godam-purchase-funnel-bar-purchased' );
		// Counts and the share text.
		expect( html ).toContain( '25% of viewers' );
	} );

	it( 'shows the drop-off between stages', () => {
		const html = renderToString( <PurchaseFunnelCard funnel={ FUNNEL } /> );
		// Viewers 4 -> cart 1 is a 75% drop; cart 1 -> purchased 1 is none.
		expect( html ).toContain( '75% drop-off' );
		expect( html ).toContain( 'no drop-off' );
	} );

	it( 'shows the "still counting" note only when the flag is set', () => {
		const withNote = renderToString(
			<PurchaseFunnelCard funnel={ { ...FUNNEL, still_counting: true } } dataLabel="Last 7 days" />,
		);
		expect( withNote ).toContain( 'godam-purchase-funnel-still-counting' );
		expect( withNote ).toContain( 'Still counting' );
		expect( withNote ).toContain( 'Last 7 days' );

		const withoutNote = renderToString( <PurchaseFunnelCard funnel={ FUNNEL } /> );
		expect( withoutNote ).not.toContain( 'godam-purchase-funnel-still-counting' );
	} );
} );
