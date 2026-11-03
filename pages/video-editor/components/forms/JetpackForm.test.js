/**
 * Unit tests for the Jetpack form preview: the form markup Jetpack renders is shown
 * as the form it describes, without anything that would run script in the editor.
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
import JetpackForm from './JetpackForm';

// What the stubbed form query returns for the selected form.
let mockFormQuery = {};

// The real slice reads a `godamSettings` global at import time; only the action
// creators matter here.
jest.mock( '../../redux/slice/videoSlice', () => ( {
	updateLayerField: ( payload ) => ( { type: 'updateLayerField', payload } ),
	setJetpackForms: ( payload ) => ( { type: 'setJetpackForms', payload } ),
	setJetpackPluginActive: ( payload ) => ( { type: 'setJetpackPluginActive', payload } ),
} ) );
jest.mock( '../../redux/api/jetpack-forms', () => ( {
	useGetJetpackFormsQuery: () => ( { data: [ { id: '12-1', title: 'Contact' } ], error: undefined } ),
	useGetSingleJetpackFormQuery: () => mockFormQuery,
} ) );
// The form picker is not under test.
jest.mock( './FormFields', () => () => null );

const FORM = `
<form class="wp-block-jetpack-contact-form" action="" method="post">
	<div class="grunion-field-wrap"><label for="g1-name">Name</label><input type="text" name="g1-name" id="g1-name" class="name" placeholder="Jane"></div>
	<div class="grunion-field-wrap"><select name="g1-topic"><option value="a">A</option></select><textarea name="g1-message"></textarea></div>
	<p class="contact-submit"><button type="submit" class="wp-block-button__link">Submit</button> <a href="https://example.com/privacy" target="_blank" rel="noopener">Privacy</a></p>
</form>`;

const HOSTILE = `
<img src="x" onerror="window.__ran = 1">
<script>window.__ran = 2;</script>
<a href="javascript:window.__ran = 3" id="evil-link">Click</a>
<div onmouseover="window.__ran = 4" class="kept">Hover</div>
<iframe src="https://example.com/"></iframe>`;

/**
 * Render the Jetpack layer preview into the layer placeholder the editor provides.
 *
 * @param {Object} query What the form query returns.
 * @return {Object} The placeholder element and an unmount callback.
 */
const renderJetpackPreview = ( query ) => {
	mockFormQuery = query;

	const layer = { id: 'J1', type: 'form', jp_id: '12-1', origin_post_id: '12', bg_color: '#ffffff' };
	const store = configureStore( {
		reducer: { videoReducer: ( state = { layers: [ layer ], jetpackForms: [] } ) => state },
	} );
	const placeholder = document.createElement( 'div' );
	placeholder.id = 'easydam-layer-placeholder';
	document.body.appendChild( placeholder );
	const container = document.createElement( 'div' );
	document.body.appendChild( container );
	const root = createRoot( container );

	act( () => {
		root.render( <Provider store={ store }><JetpackForm layerID="J1" /></Provider> );
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

describe( 'JetpackForm preview', () => {
	let rendered;

	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
		window.__ran = 0;
	} );

	afterEach( () => {
		rendered?.unmount();
		rendered = null;
	} );

	it( 'renders the form markup as the form it describes', () => {
		rendered = renderJetpackPreview( { data: FORM, isFetching: false, error: undefined } );

		const body = rendered.placeholder.querySelector( '.form-container.jetpack-form-preview' );
		expect( body ).not.toBeNull();
		expect( body.querySelector( 'form.wp-block-jetpack-contact-form' ) ).not.toBeNull();
		expect( body.querySelector( 'label[for="g1-name"]' ).textContent ).toBe( 'Name' );
		expect( body.querySelector( 'input#g1-name' ).getAttribute( 'placeholder' ) ).toBe( 'Jane' );
		expect( body.querySelector( 'select[name="g1-topic"] option' ).textContent ).toBe( 'A' );
		expect( body.querySelector( 'textarea[name="g1-message"]' ) ).not.toBeNull();
		expect( body.querySelector( 'button[type="submit"]' ).textContent ).toBe( 'Submit' );
		expect( body.querySelector( 'a' ).getAttribute( 'href' ) ).toBe( 'https://example.com/privacy' );
		expect( body.querySelector( 'a' ).getAttribute( 'target' ) ).toBe( '_blank' );
	} );

	it( 'drops scripts, event handlers and script URLs from the markup', () => {
		rendered = renderJetpackPreview( { data: HOSTILE, isFetching: false, error: undefined } );
		const body = rendered.placeholder.querySelector( '.jetpack-form-preview' );

		expect( body.querySelector( 'script' ) ).toBeNull();
		expect( body.querySelector( 'iframe' ) ).toBeNull();
		expect( body.querySelector( '[onerror], [onmouseover]' ) ).toBeNull();
		expect( body.querySelector( '#evil-link' ).hasAttribute( 'href' ) ).toBe( false );
		// The harmless parts of the same markup are still there.
		expect( body.querySelector( '#evil-link' ).textContent ).toBe( 'Click' );
		expect( body.querySelector( '.kept' ).textContent ).toBe( 'Hover' );
		expect( window.__ran ).toBe( 0 );
	} );

	it( 'shows the loading state while the form is fetched', () => {
		rendered = renderJetpackPreview( { data: undefined, isFetching: true, error: undefined } );

		expect( rendered.placeholder.textContent ).toContain( 'Loading form…' );
		expect( rendered.placeholder.querySelector( '.jetpack-form-preview' ) ).toBeNull();
	} );

	it( 'shows the error state when the form cannot be loaded', () => {
		rendered = renderJetpackPreview( { data: undefined, isFetching: false, error: { status: 404 } } );

		expect( rendered.placeholder.textContent ).toContain( 'Error loading form.' );
		expect( rendered.placeholder.querySelector( '.jetpack-form-preview' ) ).toBeNull();
	} );
} );
