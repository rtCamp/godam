/**
 * Unit tests for who sees per-hotspot store figures in the layer panel.
 *
 * A Woo layer's hotspots carry Direct revenue and an order count. That is store
 * data, so the detail panel line ("This layer drove ...") and the rail's receipt
 * icon show only to a user who may see store data (WooCommerce's report
 * permission, localized as canViewStoreData). The route strips the same fields
 * for everyone else; the views and clicks funnel is unaffected.
 *
 * @package
 */

/**
 * External dependencies
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';

global.IS_REACT_ACT_ENVIRONMENT = true;

// The WP Tooltip and Icon need a popover / SVG runtime that is beside the point
// here. Tooltip renders its child as-is; the tooltip text is on aria-label.
jest.mock( '@wordpress/components', () => ( {
	Tooltip: ( { children } ) => children,
	Icon: () => null,
} ) );

// Heavy children that have nothing to do with revenue.
jest.mock( './InfoTooltip', () => ( { __esModule: true, default: () => null } ) );
jest.mock( './LayerIcon', () => ( { __esModule: true, default: () => null } ) );
jest.mock( './LayerInteractionFunnel', () => ( { __esModule: true, default: () => <div data-test-id="funnel" /> } ) );
jest.mock( './LayerModifiedNotice', () => ( { __esModule: true, default: () => null } ) );

/**
 * Internal dependencies
 */
import LayerDetailPanel from './LayerDetailPanel';
import SubHotspotRail from './SubHotspotRail';

/**
 * Render an element into a detached jsdom container and return its innerHTML.
 *
 * @param {JSX.Element} element Element to render.
 * @return {string} The container's innerHTML after render.
 */
function renderHTML( element ) {
	const container = document.createElement( 'div' );
	document.body.appendChild( container );
	const root = createRoot( container );
	act( () => {
		root.render( element );
	} );
	const html = container.innerHTML;
	act( () => {
		root.unmount();
	} );
	container.remove();
	return html;
}

const COUNTS = { viewed: 50, clicked: 10, added_to_cart: 4 };

// A Woo layer as the data hook builds it, with revenue on the layer and its hotspot.
const WOO_LAYER = {
	id: 'l1',
	layer_type: 'woo',
	name: 'Shop the look',
	name_is_auto: true,
	counts: COUNTS,
	no_action: 36,
	conversion_rate: 28,
	revenue_minor: 500,
	orders: 2,
	currency: 'USD',
	sub_hotspots: [
		{ id: 'p11', name: 'Mug', counts: COUNTS, no_action: 36, conversion_rate: 28, revenue_minor: 500, orders: 2, currency: 'USD' },
	],
};

// The same layer as the data hook builds it from a response with the order
// fields stripped: revenue and orders fall back to 0 and the currency to ''.
const WOO_LAYER_STRIPPED = {
	...WOO_LAYER,
	revenue_minor: 0,
	orders: 0,
	currency: '',
	sub_hotspots: [ { ...WOO_LAYER.sub_hotspots[ 0 ], revenue_minor: 0, orders: 0, currency: '' } ],
};

afterEach( () => {
	delete window.videoData;
} );

describe( 'LayerDetailPanel revenue line', () => {
	it( 'shows what the layer drove to a user who may see order data', () => {
		window.videoData = { canViewStoreData: true };
		const html = renderHTML( <LayerDetailPanel parent={ WOO_LAYER } attachmentID={ 55 } /> );
		expect( html ).toContain( 'This layer drove' );
		expect( html ).toContain( '$5.00' );
	} );

	it( 'leaves the revenue line out for a user who may not, and keeps the funnel', () => {
		window.videoData = { canViewStoreData: false };
		const html = renderHTML( <LayerDetailPanel parent={ WOO_LAYER } attachmentID={ 55 } /> );
		expect( html ).not.toContain( 'drove' );
		expect( html ).not.toContain( '$5.00' );
		expect( html ).toContain( 'data-test-id="funnel"' );
		expect( html ).toContain( 'Shop the look' );
	} );

	it( 'shows no revenue line when the response was stripped, whatever the flag says', () => {
		window.videoData = { canViewStoreData: true };
		const html = renderHTML( <LayerDetailPanel parent={ WOO_LAYER_STRIPPED } attachmentID={ 55 } /> );
		expect( html ).not.toContain( 'drove' );
	} );
} );

describe( 'SubHotspotRail revenue tooltip', () => {
	const rail = ( parent ) => <SubHotspotRail parent={ parent } selectedSubId={ null } onSelect={ () => {} } />;

	it( 'shows the per-hotspot revenue tooltip to a user who may see order data', () => {
		window.videoData = { canViewStoreData: true };
		const html = renderHTML( rail( WOO_LAYER ) );
		expect( html ).toContain( 'Drove $5.00 across 2 orders' );
	} );

	it( 'leaves it out for a user who may not, and keeps the product rows', () => {
		window.videoData = { canViewStoreData: false };
		const html = renderHTML( rail( WOO_LAYER ) );
		expect( html ).not.toContain( 'Drove' );
		expect( html ).not.toContain( '$5.00' );
		expect( html ).toContain( 'Mug' );
		expect( html ).toContain( '28.0%' );
	} );

	it( 'shows no tooltip when the response was stripped, whatever the flag says', () => {
		window.videoData = { canViewStoreData: true };
		expect( renderHTML( rail( WOO_LAYER_STRIPPED ) ) ).not.toContain( 'Drove' );
	} );
} );
