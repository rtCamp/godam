/**
 * Unit tests for the Media Library toast (`SnackbarComp`) and the helper that picks
 * its type for a failed folder request.
 *
 * Every error a site admin sees comes with a "Contact Support" link, so an `error`
 * toast has to stay open until the user closes it (otherwise the link cannot be
 * clicked) and a click on the link must not be taken for dismissing it. `success`,
 * `info` and `fail` (the user's own doing: a locked folder, a name in use) keep
 * hiding on their own and carry no link.
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
import SnackbarComp from './SnackbarComp';
import folderReducer, { updateSnackbar } from '../../redux/slice/folders';
import { getFailureSnackbarType } from '../../data/utilities';

// WP Snackbar hides itself after 10 seconds unless it is dismissed explicitly.
const SNACKBAR_TIMEOUT_MS = 10000;

const LINK = '[data-test-id="godam-media-library-link-contact-support"]';
const SNACKBAR = '[data-testid="snackbar"]';

describe( 'SnackbarComp', () => {
	let store, root, container;

	const show = ( message, type ) => act( () => {
		store.dispatch( updateSnackbar( { message, type } ) );
	} );

	const toast = () => document.body.querySelector( SNACKBAR );
	const link = () => document.body.querySelector( LINK );
	const message = () => store.getState().FolderReducer.snackbar.message;

	beforeEach( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
		jest.useFakeTimers();

		store = configureStore( { reducer: { FolderReducer: folderReducer } } );
		container = document.createElement( 'div' );
		root = createRoot( container );
		act( () => {
			root.render( <Provider store={ store }><SnackbarComp /></Provider> );
		} );
	} );

	afterEach( () => {
		act( () => root.unmount() );
		jest.useRealTimers();
	} );

	it( 'renders nothing while there is no message', () => {
		expect( toast() ).toBeNull();
	} );

	it( 'puts a Contact Support link in an error toast that opens in a new tab', () => {
		show( 'Failed to create folder', 'error' );

		expect( toast().textContent ).toContain( 'Failed to create folder' );
		expect( link() ).not.toBeNull();
		expect( link().getAttribute( 'target' ) ).toBe( '_blank' );
		expect( link().getAttribute( 'rel' ) ).toBe( 'noopener noreferrer' );
		expect( link().textContent ).toContain( 'Contact Support' );
	} );

	it( 'keeps an error toast open past the usual 10 seconds', () => {
		show( 'Failed to create folder', 'error' );

		act( () => {
			jest.advanceTimersByTime( SNACKBAR_TIMEOUT_MS * 3 );
		} );

		expect( toast() ).not.toBeNull();
		expect( message() ).toBe( 'Failed to create folder' );
	} );

	it( 'does not dismiss an error toast when its body or the link is clicked', () => {
		show( 'Failed to create folder', 'error' );

		act( () => {
			toast().click();
		} );
		expect( message() ).toBe( 'Failed to create folder' );

		// Stop jsdom trying to navigate to the helpdesk.
		link().addEventListener( 'click', ( event ) => event.preventDefault() );
		act( () => {
			link().click();
		} );
		expect( message() ).toBe( 'Failed to create folder' );
	} );

	it( 'closes an error toast from its close button', () => {
		show( 'Failed to create folder', 'error' );

		act( () => {
			toast().querySelector( '.components-snackbar__dismiss-button' ).click();
		} );

		expect( message() ).toBe( '' );
		expect( toast() ).toBeNull();
	} );

	it.each( [ 'success', 'info', 'fail' ] )( 'shows a %s toast with no link and hides it after 10 seconds', ( type ) => {
		show( 'Something happened', type );

		expect( toast() ).not.toBeNull();
		expect( link() ).toBeNull();

		act( () => {
			jest.advanceTimersByTime( SNACKBAR_TIMEOUT_MS );
		} );

		expect( message() ).toBe( '' );
		expect( toast() ).toBeNull();
	} );

	it( 'drops the link and the hold when a success toast replaces an error toast', () => {
		show( 'Failed to create folder', 'error' );
		show( 'Folder created successfully', 'success' );

		expect( link() ).toBeNull();

		act( () => {
			jest.advanceTimersByTime( SNACKBAR_TIMEOUT_MS );
		} );

		expect( toast() ).toBeNull();
	} );
} );

describe( 'getFailureSnackbarType', () => {
	it( 'treats a server refusal of the user\'s own request as a plain notice', () => {
		expect( getFailureSnackbarType( { status: 403, data: { code: 'godam_folder_locked' } } ) ).toBe( 'fail' );
		expect( getFailureSnackbarType( { status: 400, data: { code: 'term_exists' } } ) ).toBe( 'fail' );
	} );

	it( 'treats a service, network or unknown failure as an error', () => {
		expect( getFailureSnackbarType( { status: 500, data: { code: 'term_assignment_failed' } } ) ).toBe( 'error' );
		expect( getFailureSnackbarType( { status: 'FETCH_ERROR', error: 'TypeError: Failed to fetch' } ) ).toBe( 'error' );
		expect( getFailureSnackbarType( new Error( 'boom' ) ) ).toBe( 'error' );
		expect( getFailureSnackbarType( undefined ) ).toBe( 'error' );
	} );
} );
