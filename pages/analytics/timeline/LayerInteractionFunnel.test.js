/**
 * Unit tests for the layer "Interaction Outcomes" funnel and store data.
 *
 * A Woo layer's funnel has an "Added to Cart" bar. That is store data, so it
 * shows only to a user who may see store data (WooCommerce's report permission,
 * localized as canViewStoreData). Editors and authors get the viewed, hovered,
 * clicked and no-action bars.
 *
 * @package
 */

/**
 * External dependencies
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';

global.IS_REACT_ACT_ENVIRONMENT = true;

// The info tooltip needs a popover runtime that is beside the point here.
jest.mock( './InfoTooltip', () => ( { __esModule: true, default: () => null } ) );

/**
 * Internal dependencies
 */
import LayerInteractionFunnel from './LayerInteractionFunnel';

/**
 * Render an element into a detached jsdom container and return its text.
 *
 * @param {JSX.Element} element Element to render.
 * @return {string} The container's text after render.
 */
function renderText( element ) {
	const container = document.createElement( 'div' );
	document.body.appendChild( container );
	const root = createRoot( container );
	act( () => {
		root.render( element );
	} );
	const text = container.textContent.replace( /\s+/g, ' ' );
	act( () => {
		root.unmount();
	} );
	container.remove();
	return text;
}

const COUNTS = { viewed: 50, hovered: 30, clicked: 10, added_to_cart: 4 };

afterEach( () => {
	delete window.videoData;
} );

describe( 'LayerInteractionFunnel for a Woo layer', () => {
	it( 'shows every bar, including Added to Cart, to a user who may see store data', () => {
		window.videoData = { canViewStoreData: true };
		const text = renderText( <LayerInteractionFunnel layerType="woo" counts={ COUNTS } noAction={ 20 } /> );
		expect( text ).toContain( 'Viewed' );
		expect( text ).toContain( 'Clicked' );
		expect( text ).toContain( 'Added to Cart' );
		expect( text ).toContain( 'No Action' );
	} );

	it( 'leaves the Added to Cart bar out for a user who may not, and keeps the video bars', () => {
		window.videoData = { canViewStoreData: false };
		const text = renderText( <LayerInteractionFunnel layerType="woo" counts={ COUNTS } noAction={ 20 } /> );
		expect( text ).not.toContain( 'Added to Cart' );
		expect( text ).toContain( 'Viewed' );
		expect( text ).toContain( 'Hovered' );
		expect( text ).toContain( 'Clicked' );
		expect( text ).toContain( 'No Action' );
	} );

	it( 'does not touch a layer type that has no store bar', () => {
		window.videoData = { canViewStoreData: false };
		const text = renderText( <LayerInteractionFunnel layerType="cta" counts={ { viewed: 10, clicked: 4, skipped: 1 } } noAction={ 5 } /> );
		expect( text ).toContain( 'Viewed' );
		expect( text ).toContain( 'Clicked' );
		expect( text ).toContain( 'Skipped' );
	} );
} );
