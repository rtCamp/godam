/**
 * Unit tests for the Play-to-Cart-to-Purchase funnel card.
 *
 * Covers the null guard, the three stages with counts and shares, the Direct/
 * Assisted split bar, the drop-off annotations (advanced %, did-not-add, and the
 * red "abandoned after adding" pill), the legend, and the "still counting" note.
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
		{ key: 'played', count: 1412, rate: 100 },
		{ key: 'added_to_cart', count: 64, direct: 27, assisted: 40, rate: 4.53 },
		{ key: 'purchased', count: 27, rate: 1.91 },
	],
	still_counting: false,
};

describe( 'PurchaseFunnelCard', () => {
	it( 'renders nothing when the payload is absent or incomplete', () => {
		expect( renderToString( <PurchaseFunnelCard funnel={ null } /> ) ).toBe( '' );
		expect( renderToString( <PurchaseFunnelCard /> ) ).toBe( '' );
		expect( renderToString( <PurchaseFunnelCard funnel={ { stages: [] } } /> ) ).toBe( '' );
	} );

	it( 'renders the title, the three stages and their counts', () => {
		const html = renderToString( <PurchaseFunnelCard funnel={ FUNNEL } dataLabel="Last 30 days" /> );
		expect( html ).toContain( 'godam-purchase-funnel-card' );
		expect( html ).toContain( 'Purchase Funnel' );
		expect( html ).toContain( 'Played a video' );
		expect( html ).toContain( 'Added to cart' );
		expect( html ).toContain( 'Purchased' );
		// Counts, thousands-formatted.
		expect( html ).toContain( '1,412' );
		expect( html ).toContain( '64' );
		expect( html ).toContain( '27' );
		// Range pill.
		expect( html ).toContain( 'Last 30 days' );
		// A bar per stage.
		expect( html ).toContain( 'godam-purchase-funnel-bar-played' );
		expect( html ).toContain( 'godam-purchase-funnel-bar-added_to_cart' );
		expect( html ).toContain( 'godam-purchase-funnel-bar-purchased' );
	} );

	it( 'renders the drop-off annotations, including the abandoned pill', () => {
		const html = renderToString( <PurchaseFunnelCard funnel={ FUNNEL } /> );
		// 64 / 1412 = 4.5% advanced; 1348 did not add.
		expect( html ).toContain( '4.5% advanced' );
		expect( html ).toContain( '1,348 did not add to cart' );
		// 27 / 64 = 42.2% advanced; 37 abandoned after adding.
		expect( html ).toContain( '42.2% advanced' );
		expect( html ).toContain( '37 abandoned after adding' );
	} );

	it( 'clamps the cart-advanced annotation to 100% when a skewed payload has carts > played', () => {
		// A stale/skewed service deploy could report added_to_cart > played; the
		// "advanced" annotation must cap at 100.0%, never print an above-100% value.
		const skewed = {
			stages: [
				{ key: 'played', count: 100, rate: 100 },
				{ key: 'added_to_cart', count: 150, direct: 100, assisted: 50, rate: 150 },
				{ key: 'purchased', count: 10, rate: 10 },
			],
		};
		const html = renderToString( <PurchaseFunnelCard funnel={ skewed } /> );
		expect( html ).toContain( '100.0% advanced' );
		expect( html ).not.toContain( '150.0% advanced' );
	} );

	it( 'renders the legend', () => {
		const html = renderToString( <PurchaseFunnelCard funnel={ FUNNEL } /> );
		expect( html ).toContain( 'Direct, added to cart in-video' );
		expect( html ).toContain( 'Assisted, clicked out then bought' );
		expect( html ).toContain( 'did not reach this stage' );
	} );

	it( 'uses the per-video descriptor when scope is "video"', () => {
		const account = renderToString( <PurchaseFunnelCard funnel={ FUNNEL } scope="account" /> );
		const video = renderToString( <PurchaseFunnelCard funnel={ FUNNEL } scope="video" /> );
		expect( account ).toContain( 'any GoDAM video' );
		expect( video ).toContain( 'this video' );
	} );

	it( 'shows purchased as a share OF PLAYERS on the Purchased row, not of carts', () => {
		const html = renderToString( <PurchaseFunnelCard funnel={ FUNNEL } /> );
		// 27 / 1412 = 1.9% of players (matches the bar and the server stage rate).
		expect( html ).toContain( '1.9% of players' );
		// The 42.2% (27/64) figure is the cart->purchase drop annotation only; it
		// must never be shown as an "of players" share (the bug this fixes).
		expect( html ).not.toContain( '42.2% of players' );
	} );

	it( 'clamps the advanced % so a stale purchased>carts payload cannot exceed 100%', () => {
		const skew = {
			stages: [
				{ key: 'played', count: 100, rate: 100 },
				{ key: 'added_to_cart', count: 10, direct: 6, assisted: 5, rate: 10 },
				{ key: 'purchased', count: 15, rate: 15 },
			],
			still_counting: false,
		};
		const html = renderToString( <PurchaseFunnelCard funnel={ skew } /> );
		expect( html ).toContain( '100.0% advanced' );
		expect( html ).not.toContain( '150.0% advanced' );
	} );

	it( 'shows the "still counting" note only when the flag is set', () => {
		const withNote = renderToString(
			<PurchaseFunnelCard funnel={ { ...FUNNEL, still_counting: true } } dataLabel="Last 30 days" />,
		);
		expect( withNote ).toContain( 'godam-purchase-funnel-still-counting' );
		expect( withNote ).toContain( 'Still counting' );

		const withoutNote = renderToString( <PurchaseFunnelCard funnel={ FUNNEL } /> );
		expect( withoutNote ).not.toContain( 'godam-purchase-funnel-still-counting' );
	} );
} );
