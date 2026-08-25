/**
 * Unit tests for the Funnel by placement card.
 *
 * Mocks the placement-funnels query and asserts the card renders one funnel per
 * placement with its counts, reach and play-to-purchase rate, a loading state,
 * and nothing when a loaded store has no placement activity.
 *
 * @package
 */

/**
 * WordPress dependencies
 */
import { renderToString } from '@wordpress/element';

jest.mock( '../dashboard/redux/api/dashboardAnalyticsApi', () => ( {
	useFetchPlacementFunnelsQuery: jest.fn(),
} ) );

/**
 * Internal dependencies
 */
import { useFetchPlacementFunnelsQuery } from '../dashboard/redux/api/dashboardAnalyticsApi';
import PlacementFunnelCard from './PlacementFunnelCard';

const DATA = [
	{ block_source: 'shoppable-video', label: 'Shoppable Video block', played: 612, added: 49, purchased: 21, add_rate: 8.0, purchase_rate: 3.4, videos: 14, units: null, unit_label: null },
	{ block_source: 'woo-layer', label: 'Woo hotspot layer', played: 488, added: 14, purchased: 6, add_rate: 2.9, purchase_rate: 1.2, videos: 9, units: 22, unit_label: 'layers' },
	{ block_source: 'reel-pop', label: 'Reel Pop', played: 312, added: 1, purchased: 0, add_rate: 0.3, purchase_rate: 0, videos: 2, units: 3, unit_label: 'reel pops' },
];

describe( 'PlacementFunnelCard', () => {
	it( 'renders nothing when a loaded store has no placements', () => {
		useFetchPlacementFunnelsQuery.mockReturnValue( { data: [], isFetching: false } );
		expect( renderToString( <PlacementFunnelCard siteUrl="x" /> ) ).toBe( '' );
	} );

	it( 'renders a funnel per placement with counts, reach and rate', () => {
		useFetchPlacementFunnelsQuery.mockReturnValue( { data: DATA, isFetching: false } );
		const html = renderToString( <PlacementFunnelCard siteUrl="x" dataLabel="Last 30 days" /> );
		expect( html ).toContain( 'godam-placement-funnel-card' );
		expect( html ).toContain( 'Funnel by placement' );
		expect( html ).toContain( 'Last 30 days' );
		// Each placement, its counts and per-placement box.
		expect( html ).toContain( 'Shoppable Video block' );
		expect( html ).toContain( '612' );
		expect( html ).toContain( '49' );
		expect( html ).toContain( '21' );
		expect( html ).toContain( 'godam-placement-funnel-shoppable-video' );
		expect( html ).toContain( 'godam-placement-funnel-woo-layer' );
		expect( html ).toContain( 'godam-placement-funnel-reel-pop' );
		// Play-to-purchase rate.
		expect( html ).toContain( 'Play to purchase 3.4%' );
		// Reach labels: units + videos, or just videos when there is no unit count.
		expect( html ).toContain( '22 layers · 9 videos' );
		expect( html ).toContain( '3 reel pops · 2 videos' );
		expect( html ).toContain( '14 videos' ); // Shoppable has no per-block id
	} );

	it( 'shows a loading state while fetching with no data yet', () => {
		useFetchPlacementFunnelsQuery.mockReturnValue( { data: undefined, isFetching: true } );
		const html = renderToString( <PlacementFunnelCard siteUrl="x" /> );
		expect( html ).toContain( 'godam-placement-funnel-loading' );
	} );
} );
