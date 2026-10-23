/**
 * Unit tests for the Media Editor's hotspot preview: the hotspot tooltip shows the
 * stored link as a link only when it is an http(s) or mailto URL.
 */

/**
 * External dependencies
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import HotspotLayer from './HotspotLayer';

// The real slice reads a `godamSettings` global at import time; only the action
// creator matters here.
jest.mock( '../../redux/slice/videoSlice', () => ( {
	updateLayerField: ( payload ) => ( { type: 'updateLayerField', payload } ),
} ) );

const renderLayer = ( hotspots ) => {
	const layer = { id: 'L1', type: 'hotspot', styleType: 'pulse', displayTime: 0, duration: 5, hotspots };
	const store = configureStore( {
		reducer: { videoReducer: ( state = { layers: [ layer ], mediaType: 'video' } ) => state },
	} );
	const placeholder = document.createElement( 'div' );
	placeholder.id = 'easydam-layer-placeholder';
	document.body.appendChild( placeholder );
	const container = document.createElement( 'div' );
	document.body.appendChild( container );
	const root = createRoot( container );

	act( () => {
		root.render( <Provider store={ store }><HotspotLayer layerID="L1" goBack={ () => {} } duration={ 10 } /></Provider> );
	} );

	return {
		placeholder,
		unmount: () => {
			act( () => root.unmount() );
			placeholder.remove();
			container.remove();
		},
	};
};

const tooltipOf = ( hotspot ) => {
	const { placeholder, unmount } = renderLayer( [ { id: 'A', position: { x: 10, y: 10 }, ...hotspot } ] );
	const tooltip = placeholder.querySelector( '.hotspot-tooltip' );
	const result = {
		anchor: tooltip.querySelector( 'a' ),
		text: tooltip.textContent,
	};
	unmount();
	return result;
};

describe( 'HotspotLayer preview', () => {
	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
	} );

	it.each( [
		[ 'a javascript: link', 'javascript:alert(1)' ],
		[ 'a mixed-case javascript: link', 'JaVaScRiPt:alert(1)' ],
		[ 'a data: link', 'data:text/html,<script>alert(1)</script>' ],
		[ 'a vbscript: link', 'vbscript:msgbox(1)' ],
	] )( 'shows the tooltip text without a link for %s', ( name, link ) => {
		const { anchor, text } = tooltipOf( { tooltipText: 'Go', link } );

		expect( anchor ).toBeNull();
		expect( text ).toBe( 'Go' );
	} );

	it.each( [
		[ 'an http link', 'http://example.com/x' ],
		[ 'an https link', 'https://example.com/x?a=1&b=2' ],
		[ 'a mailto link', 'mailto:hello@example.com' ],
	] )( 'links the tooltip text for %s', ( name, link ) => {
		const { anchor, text } = tooltipOf( { tooltipText: 'Go', link } );

		expect( anchor ).not.toBeNull();
		expect( anchor.getAttribute( 'href' ) ).toBe( link );
		expect( anchor.getAttribute( 'target' ) ).toBe( '_blank' );
		expect( anchor.getAttribute( 'rel' ) ).toBe( 'noopener noreferrer' );
		expect( text ).toBe( 'Go' );
	} );

	it( 'shows the tooltip text without a link when the hotspot has none', () => {
		const { anchor, text } = tooltipOf( { tooltipText: 'Go' } );

		expect( anchor ).toBeNull();
		expect( text ).toBe( 'Go' );
	} );
} );
