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

// The WP Tooltip portals a popover on hover and cannot render to a string in
// this WP-free harness; the card is client-rendered in the plugin, so render
// the wrapped segment as-is here. Its hover text is also on aria-label, which
// is what the assertions read.
jest.mock( '@wordpress/components', () => ( {
	Tooltip: ( { children } ) => children,
} ) );

const FUNNEL = {
	stages: [
		{ key: 'played', count: 1412, rate: 100 },
		{ key: 'added_to_cart', count: 64, direct: 27, assisted: 40, rate: 4.53 },
		{ key: 'purchased', count: 27, direct: 20, assisted: 7, rate: 1.91 },
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

	it( 'renders rangeControl in the head instead of the dataLabel pill when given', () => {
		const html = renderToString(
			<PurchaseFunnelCard
				funnel={ FUNNEL }
				dataLabel="Last 30 days"
				rangeControl={ <span data-test-id="my-picker">PICKER</span> }
			/>,
		);
		// The picker element takes the head slot.
		expect( html ).toContain( 'my-picker' );
		expect( html ).toContain( 'PICKER' );
		// The plain "Last 30 days" pill is replaced, not shown alongside.
		expect( html ).not.toContain( 'Last 30 days' );
	} );

	it( 'surfaces a query error in place (with the picker) instead of vanishing', () => {
		const html = renderToString(
			<PurchaseFunnelCard
				funnel={ { error: true, message: 'boom' } }
				rangeControl={ <span data-test-id="my-picker">PICKER</span> }
			/>,
		);
		expect( html ).toContain( 'godam-purchase-funnel-error' );
		expect( html ).toContain( 'my-picker' );
		expect( html ).not.toBe( '' );
	} );

	it( 'explains each bar segment on hover, with its share of the stage', () => {
		const html = renderToString( <PurchaseFunnelCard funnel={ FUNNEL } /> );
		expect( html ).toContain( '1,412 visitors played a video' );
		// Added to cart: 27 Direct + 37 Assisted-only = 64.
		expect( html ).toContain( 'Direct (added in-video): 27 of 64 added to cart (42.2%)' );
		expect( html ).toContain( 'Assisted only (clicked out): 37 of 64 added to cart (57.8%)' );
		expect( html ).toContain( 'Did not reach this stage: 1,348 of 1,412 players' );
	} );

	it( 'splits the Purchased bar into Direct and Assisted like the cart bar', () => {
		const html = renderToString( <PurchaseFunnelCard funnel={ FUNNEL } /> );
		const bar = html.slice( html.indexOf( 'godam-purchase-funnel-bar-purchased' ) );
		expect( bar ).toContain( 'background:#2563eb' );
		expect( bar ).toContain( 'background:#93c5fd' );
		expect( html ).toContain( 'Direct (added in-video): 20 of 27 purchased (74.1%)' );
		expect( html ).toContain( 'Assisted only (clicked out): 7 of 27 purchased (25.9%)' );
		expect( html ).toContain( 'Did not reach this stage: 1,385 of 1,412 players' );
	} );

	it( 'keeps a single Purchased segment when an older service sends no split', () => {
		const legacy = { ...FUNNEL, stages: FUNNEL.stages.map( ( s ) => ( s.key === 'purchased' ? { key: 'purchased', count: 27, rate: 1.91 } : s ) ) };
		const html = renderToString( <PurchaseFunnelCard funnel={ legacy } /> );
		const bar = html.slice( html.indexOf( 'godam-purchase-funnel-bar-purchased' ), html.indexOf( 'godam-purchase-funnel-bar-purchased' ) + 900 );
		expect( bar ).toContain( 'background:#2563eb' );
		expect( bar ).not.toContain( 'background:#93c5fd' );
		expect( html ).toContain( '27 purchased' );
	} );

	it( 'renders no focusable segment for a zero-count tier', () => {
		const funnel = {
			stages: [
				{ key: 'played', count: 10, rate: 100 },
				{ key: 'added_to_cart', count: 5, direct: 0, assisted: 5, rate: 50 },
				{ key: 'purchased', count: 3, direct: 3, assisted: 0, rate: 30 },
			],
			still_counting: false,
		};
		const html = renderToString( <PurchaseFunnelCard funnel={ funnel } /> );
		// Zero-count tiers must not render (no invisible width:0% keyboard tab stop).
		expect( html ).not.toContain( 'Direct (added in-video): 0 of' );
		expect( html ).not.toContain( 'Assisted only (clicked out): 0 of' );
		expect( html ).not.toMatch( /width:\s*0%/ );
		// The nonzero tiers still render with their share.
		expect( html ).toContain( 'Assisted only (clicked out): 5 of 5 added to cart' );
		expect( html ).toContain( 'Direct (added in-video): 3 of 3 purchased' );
	} );

	describe( 'a date range that comes back empty', () => {
		const picker = <span data-test-id="my-picker">PICKER</span>;

		it( 'keeps the card and its picker with an empty message when the range has no funnel', () => {
			// Dashboard shape: a loaded query with no funnel is null. Per-video shape: the
			// page maps a payload without video_funnel to null.
			const html = renderToString(
				<PurchaseFunnelCard funnel={ null } rangeActive rangeControl={ picker } />,
			);
			expect( html ).toContain( 'godam-purchase-funnel-card' );
			expect( html ).toContain( 'Purchase Funnel' );
			expect( html ).toContain( 'my-picker' ); // the viewer can pick another range
			expect( html ).toContain( 'godam-purchase-funnel-empty' );
			expect( html ).toContain( 'No funnel activity in this date range.' );
			expect( html ).not.toContain( 'godam-purchase-funnel-bar-played' );
		} );

		it( 'treats an incomplete stage list like an empty range', () => {
			const html = renderToString(
				<PurchaseFunnelCard funnel={ { stages: [] } } rangeActive rangeControl={ picker } />,
			);
			expect( html ).toContain( 'godam-purchase-funnel-empty' );
		} );

		it( 'brings the funnel back when the next range has data', () => {
			const html = renderToString(
				<PurchaseFunnelCard funnel={ FUNNEL } rangeActive rangeControl={ picker } />,
			);
			expect( html ).toContain( 'godam-purchase-funnel-bar-played' );
			expect( html ).toContain( '1,412' );
			expect( html ).toContain( 'my-picker' );
			expect( html ).not.toContain( 'godam-purchase-funnel-empty' );
		} );

		it( 'renders nothing while the payload has not loaded (undefined), so no empty message flashes', () => {
			expect( renderToString( <PurchaseFunnelCard rangeActive rangeControl={ picker } /> ) ).toBe( '' );
		} );

		it( 'keeps the picker but holds the empty message while the picked range is still being fetched', () => {
			// The payload on hand is the previous range's (RTK Query keeps it until the new
			// answer lands), so claiming "no activity" now would be wrong for the new range.
			const html = renderToString(
				<PurchaseFunnelCard funnel={ null } rangeActive isFetching rangeControl={ picker } />,
			);
			expect( html ).toContain( 'godam-purchase-funnel-card' );
			expect( html ).toContain( 'my-picker' );
			expect( html ).not.toContain( 'godam-purchase-funnel-empty' );
			expect( html ).not.toContain( 'No funnel activity' );
		} );

		it( 'shows the empty message once the fetch is done', () => {
			const html = renderToString(
				<PurchaseFunnelCard funnel={ null } rangeActive isFetching={ false } rangeControl={ picker } />,
			);
			expect( html ).toContain( 'godam-purchase-funnel-empty' );
		} );

		it( 'still shows an error while fetching is flagged', () => {
			const html = renderToString(
				<PurchaseFunnelCard funnel={ { error: true } } rangeActive isFetching rangeControl={ picker } />,
			);
			expect( html ).toContain( 'godam-purchase-funnel-error' );
		} );

		it( 'stays hidden at All Time (no range picked), where a different range cannot reveal anything', () => {
			expect( renderToString( <PurchaseFunnelCard funnel={ null } rangeControl={ picker } /> ) ).toBe( '' );
		} );

		it( 'stays hidden when the card has no picker to keep', () => {
			expect( renderToString( <PurchaseFunnelCard funnel={ null } rangeActive /> ) ).toBe( '' );
		} );

		it( 'shows the error, not the empty message, when the query failed', () => {
			const html = renderToString(
				<PurchaseFunnelCard funnel={ { error: true } } rangeActive rangeControl={ picker } />,
			);
			expect( html ).toContain( 'godam-purchase-funnel-error' );
			expect( html ).not.toContain( 'godam-purchase-funnel-empty' );
		} );
	} );
} );
