/**
 * Unit tests for the onboarding workspace screen's empty state.
 *
 * A signed-in account with no workspaces used to land on a screen with nothing
 * to click except the "create one" link, so after creating a workspace in the
 * GoDAM app the user had to reload wp-admin and sign in again. The empty state
 * now has Refresh (re-fetch the list, move on when one exists) and Back.
 *
 * Mounted into jsdom with a real store and the real slice; only the RTK Query
 * mutation hooks are mocked (no @testing-library/react in this repo).
 *
 * @package
 */

/**
 * External dependencies
 */
import { act } from 'react';
import { Provider, useSelector } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * WordPress dependencies
 */
import { createRoot } from '@wordpress/element';

/**
 * Internal dependencies
 */
import onboardingReducer, { goToStep, setOrganizations } from '../../redux/slice/onboarding';
import { useListOrganizationsMutation } from '../../redux/api/onboarding';
import { STEPS } from '../../utils/constants';
import WorkspaceScreen from './WorkspaceScreen';

jest.mock( '../../redux/api/onboarding', () => ( {
	useListOrganizationsMutation: jest.fn(),
	useGetOrganizationApiKeyMutation: jest.fn( () => [ jest.fn(), { isLoading: false } ] ),
} ) );

const WORKSPACE = { name: 'acme-ws', organization_name: 'Acme Videos', role: 'Owner' };

// Like App.js: the screen is only on screen while the step is `workspace`.
const Harness = () => {
	const step = useSelector( ( state ) => state.onboarding.step );
	return STEPS.WORKSPACE === step ? <WorkspaceScreen /> : null;
};

describe( 'WorkspaceScreen empty state', () => {
	let container;
	let root;
	let store;
	let listOrganizations;

	/**
	 * Make the next Refresh resolve or reject like the RTK mutation's `unwrap()`.
	 *
	 * @param {Function} unwrap    Called when the screen unwraps the mutation result.
	 * @param {boolean}  isLoading What the hook reports while the request is in flight.
	 */
	const mockListOrganizations = ( unwrap, isLoading = false ) => {
		listOrganizations = jest.fn( () => ( { unwrap } ) );
		useListOrganizationsMutation.mockReturnValue( [ listOrganizations, { isLoading } ] );
	};

	const byTestId = ( id ) => container.querySelector( `[data-test-id="${ id }"]` );

	const click = async ( id ) => {
		await act( async () => {
			byTestId( id ).dispatchEvent( new window.MouseEvent( 'click', { bubbles: true } ) );
		} );
	};

	const mount = async () => {
		await act( async () => {
			root.render(
				<Provider store={ store }>
					<Harness />
				</Provider>,
			);
		} );
	};

	beforeAll( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
	} );

	beforeEach( async () => {
		store = configureStore( { reducer: { onboarding: onboardingReducer } } );
		store.dispatch( setOrganizations( [] ) );
		store.dispatch( goToStep( STEPS.WORKSPACE ) );
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
		mockListOrganizations( () => Promise.resolve( { organizations: [] } ) );
		await mount();
	} );

	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
	} );

	it( 'offers Back, Refresh and the create-workspace link', () => {
		expect( container.textContent ).toContain( 'No workspaces yet' );
		expect( byTestId( 'godam-onboarding-link-create-workspace' ) ).not.toBeNull();
		expect( byTestId( 'godam-onboarding-button-back' ) ).not.toBeNull();
		expect( byTestId( 'godam-onboarding-button-refresh' ) ).not.toBeNull();
		expect( byTestId( 'godam-onboarding-link-support' ) ).not.toBeNull();
	} );

	it( 'Refresh moves on to the picker, with the new workspace already selected', async () => {
		mockListOrganizations( () => Promise.resolve( { organizations: [ WORKSPACE ] } ) );
		await mount();

		await click( 'godam-onboarding-button-refresh' );

		expect( listOrganizations ).toHaveBeenCalledTimes( 1 );
		expect( store.getState().onboarding.organizations ).toEqual( [ WORKSPACE ] );
		expect( container.textContent ).toContain( 'Select a workspace' );
		expect( byTestId( 'godam-onboarding-select-workspace' ).textContent ).toContain( 'Acme Videos' );
		expect( byTestId( 'godam-onboarding-button-workspace-continue' ).disabled ).toBe( false );
	} );

	it( 'Refresh that still finds nothing stays put and says so', async () => {
		await click( 'godam-onboarding-button-refresh' );

		expect( listOrganizations ).toHaveBeenCalledTimes( 1 );
		expect( container.textContent ).toContain( 'No workspaces yet' );
		expect( store.getState().onboarding.notice ).toEqual( expect.objectContaining( { status: 'info' } ) );
	} );

	it( 'a failed Refresh shows the server message and keeps the screen', async () => {
		mockListOrganizations( () => Promise.reject( { data: { message: 'Your session has expired. Please sign in again.' } } ) );
		await mount();

		await click( 'godam-onboarding-button-refresh' );

		expect( container.textContent ).toContain( 'No workspaces yet' );
		expect( store.getState().onboarding.notice ).toEqual( {
			status: 'error',
			message: 'Your session has expired. Please sign in again.',
		} );
	} );

	it( 'a successful Refresh clears an earlier notice', async () => {
		await click( 'godam-onboarding-button-refresh' );
		expect( store.getState().onboarding.notice ).not.toBeNull();

		mockListOrganizations( () => Promise.resolve( { organizations: [ WORKSPACE ] } ) );
		await mount();
		await click( 'godam-onboarding-button-refresh' );

		expect( store.getState().onboarding.notice ).toBeNull();
	} );

	it( 'the button reads Checking… and is disabled while the request is in flight', async () => {
		mockListOrganizations( () => new Promise( () => {} ), true );
		await mount();

		const button = byTestId( 'godam-onboarding-button-refresh' );
		expect( button.textContent ).toBe( 'Checking…' );
		expect( button.disabled ).toBe( true );
	} );

	it( 'an answer that arrives after Back does not touch the first screen', async () => {
		let answer;
		mockListOrganizations( () => new Promise( ( resolve ) => {
			answer = resolve;
		} ) );
		await mount();

		await click( 'godam-onboarding-button-refresh' );
		await click( 'godam-onboarding-button-back' );
		expect( store.getState().onboarding.step ).toBe( STEPS.ENTRY );

		await act( async () => answer( { organizations: [] } ) );

		expect( store.getState().onboarding.notice ).toBeNull();
		expect( store.getState().onboarding.organizations ).toEqual( [] );
	} );

	it( 'Back returns to the first screen', async () => {
		await click( 'godam-onboarding-button-back' );

		expect( store.getState().onboarding.step ).toBe( STEPS.ENTRY );
		expect( listOrganizations ).not.toHaveBeenCalled();
	} );
} );
