/**
 * Unit tests for the Media Editor's card CTA preview: the card's button links to
 * the stored link only when it is an http(s) or mailto URL.
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
import CTALayer from './CTALayer';

// The real slice reads a `godamSettings` global at import time; only the action
// creator matters here.
jest.mock( '../../redux/slice/videoSlice', () => ( {
	updateLayerField: ( payload ) => ( { type: 'updateLayerField', payload } ),
} ) );

// The settings panels are not under test, and need store state the preview does not.
jest.mock( '../cta/CardCTA', () => () => null );
jest.mock( '../cta/HtmlCTA', () => () => null );
jest.mock( './LayersHeader.js', () => () => null );
jest.mock( './shared/TriggerSection.jsx', () => () => null );

const renderCta = ( layerFields ) => {
	const layer = { id: 'C1', type: 'cta', cta_type: 'image', imageCtaButtonText: 'Shop now', ...layerFields };
	const store = configureStore( {
		reducer: { videoReducer: ( state = { layers: [ layer ] } ) => state },
	} );
	const placeholder = document.createElement( 'div' );
	placeholder.id = 'easydam-layer-placeholder';
	document.body.appendChild( placeholder );
	const container = document.createElement( 'div' );
	document.body.appendChild( container );
	const root = createRoot( container );

	act( () => {
		root.render( <Provider store={ store }><CTALayer layerID="C1" goBack={ () => {} } duration={ 10 } /></Provider> );
	} );

	const button = placeholder.querySelector( 'a.godam-cta-btn' );
	const result = {
		button,
		href: button ? button.getAttribute( 'href' ) : null,
		text: button ? button.textContent : null,
	};

	act( () => root.unmount() );
	placeholder.remove();
	container.remove();

	return result;
};

describe( 'CTALayer card preview', () => {
	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
	} );

	it.each( [
		[ 'a javascript: link', 'javascript:alert(1)' ],
		[ 'a mixed-case javascript: link', 'JaVaScRiPt:alert(1)' ],
		[ 'a data: link', 'data:text/html,<script>alert(1)</script>' ],
		[ 'a vbscript: link', 'vbscript:msgbox(1)' ],
	] )( 'does not use %s as the button link', ( name, imageLink ) => {
		const { button, href, text } = renderCta( { imageLink } );

		// The button is still shown, styled the same, just not pointing anywhere harmful.
		expect( button ).not.toBeNull();
		expect( text ).toBe( 'Shop now' );
		expect( href ).toBe( '#' );
	} );

	it.each( [
		[ 'an http link', 'http://example.com/x' ],
		[ 'an https link', 'https://example.com/x?a=1&b=2' ],
		[ 'a mailto link', 'mailto:hello@example.com' ],
	] )( 'uses %s as the button link', ( name, imageLink ) => {
		const { href, text } = renderCta( { imageLink } );

		expect( href ).toBe( imageLink );
		expect( text ).toBe( 'Shop now' );
	} );

	it( 'points the button at # when no link is set', () => {
		const { href } = renderCta( {} );

		expect( href ).toBe( '#' );
	} );
} );
