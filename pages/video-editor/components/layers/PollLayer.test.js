/**
 * Unit tests for the Media Editor's poll preview: the poll markup is shown as the
 * poll it describes, without anything that would run script in the editor.
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
import PollLayer from './PollLayer';

// What the stubbed poll query returns for the selected poll.
let mockPoll;

// The real slice reads a `godamSettings` global at import time; only the action
// creator matters here.
jest.mock( '../../redux/slice/videoSlice', () => ( {
	updateLayerField: ( payload ) => ( { type: 'updateLayerField', payload } ),
} ) );
jest.mock( '../../redux/api/polls', () => ( {
	useGetPollsQuery: () => ( { data: [] } ),
	useGetPollQuery: () => ( { data: mockPoll } ),
} ) );
// The settings panel header is not under test.
jest.mock( './LayersHeader.js', () => () => null );

const POLL = `
<div id="polls-1" class="wp-polls">
	<form id="polls_form_1" class="wp-polls-form" action="/index.php" method="post">
		<p style="display: none;"><input type="hidden" id="poll_1_nonce" name="wp-polls-nonce" value="abc"></p>
		<div id="polls-1-ans" class="wp-polls-ans">
			<ul class="wp-polls-ul"><li><input type="radio" id="poll-answer-1" name="poll_1" value="1"> <label for="poll-answer-1">Good</label></li></ul>
			<p style="text-align: center;"><input type="button" name="vote" value="Vote" class="Buttons" onclick="poll_vote(1);"></p>
			<p><a href="#ViewPollResults" onclick="poll_result(1); return false;" title="View Results Of This Poll">View Results</a></p>
		</div>
	</form>
</div>`;

const HOSTILE = `
<img src="x" onerror="window.__ran = 1">
<script>window.__ran = 2;</script>
<a href="javascript:window.__ran = 3" id="evil-link">Click</a>
<div onmouseover="window.__ran = 4" class="kept">Hover</div>`;

/**
 * Render the poll layer into the layer placeholder the editor provides.
 *
 * @param {Object} poll What the poll query returns.
 * @return {Object} The placeholder element and an unmount callback.
 */
const renderPoll = ( poll ) => {
	mockPoll = poll;

	const layer = { id: 'P1', type: 'poll', poll_id: '1', bg_color: '#ffffff', allow_skip: true };
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
		root.render( <Provider store={ store }><PollLayer layerID="P1" goBack={ () => {} } duration={ 10 } /></Provider> );
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

describe( 'PollLayer preview', () => {
	let rendered;

	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
		window.__ran = 0;
	} );

	afterEach( () => {
		rendered?.unmount();
		rendered = null;
	} );

	it( 'renders the poll markup as the poll it describes', () => {
		rendered = renderPoll( { id: '1', html: POLL } );

		const body = rendered.placeholder.querySelector( '.form-container.poll-container' );
		expect( body ).not.toBeNull();
		expect( body.querySelector( '#polls-1.wp-polls' ) ).not.toBeNull();
		expect( body.querySelector( 'input[type="radio"][name="poll_1"]' ).getAttribute( 'value' ) ).toBe( '1' );
		expect( body.querySelector( 'label[for="poll-answer-1"]' ).textContent ).toBe( 'Good' );
		expect( body.querySelector( 'input[type="button"]' ).getAttribute( 'value' ) ).toBe( 'Vote' );
		expect( body.querySelector( 'a' ).getAttribute( 'href' ) ).toBe( '#ViewPollResults' );
		expect( body.querySelector( 'a' ).textContent ).toBe( 'View Results' );
		expect( body.querySelector( 'p[style]' ).getAttribute( 'style' ) ).toBe( 'display: none;' );
	} );

	it( 'drops scripts, event handlers and script URLs from the markup', () => {
		rendered = renderPoll( { id: '1', html: HOSTILE } );
		const body = rendered.placeholder.querySelector( '.poll-container' );

		expect( body.querySelector( 'script' ) ).toBeNull();
		expect( body.querySelector( '[onerror], [onclick], [onmouseover]' ) ).toBeNull();
		expect( body.querySelector( '#evil-link' ).hasAttribute( 'href' ) ).toBe( false );
		// The harmless parts of the same markup are still there.
		expect( body.querySelector( '#evil-link' ).textContent ).toBe( 'Click' );
		expect( body.querySelector( '.kept' ).textContent ).toBe( 'Hover' );
		expect( window.__ran ).toBe( 0 );
	} );

	it( 'renders an empty poll body until the poll has loaded', () => {
		rendered = renderPoll( undefined );
		const body = rendered.placeholder.querySelector( '.poll-container' );

		expect( body ).not.toBeNull();
		expect( body.innerHTML ).toBe( '' );
	} );
} );
