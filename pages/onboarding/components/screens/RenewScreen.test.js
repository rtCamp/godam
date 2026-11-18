/**
 * Unit tests for the renewal screen a site with a lapsed GoDAM plan sees (#101),
 * instead of the signup screens it used to land on.
 *
 * @package
 */

/**
 * External dependencies
 */
import { act } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

/**
 * WordPress dependencies
 */
import { createRoot } from '@wordpress/element';

/**
 * Internal dependencies
 */
import onboardingReducer from '../../redux/slice/onboarding';
import { STEPS } from '../../utils/constants';
import RenewScreen from './RenewScreen';

jest.mock( '../../utils/constants', () => ( {
	...jest.requireActual( '../../utils/constants' ),
	config: {
		connectionStatus: 'expired',
		renewalUrl: 'https://app.godam.io/godam_upgrade?organization=acme&wp_return=x',
		restUrl: 'https://site.example/wp-json/',
		nonce: 'n',
	},
} ) );

describe( 'RenewScreen', () => {
	let container;
	let root;
	let store;

	const byTestId = ( id ) => container.querySelector( `[data-test-id="${ id }"]` );

	const click = async ( id ) => {
		await act( async () => {
			byTestId( id ).dispatchEvent( new window.MouseEvent( 'click', { bubbles: true } ) );
		} );
	};

	beforeAll( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
	} );

	beforeEach( async () => {
		store = configureStore( { reducer: { onboarding: onboardingReducer } } );
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
		await act( async () => {
			root.render(
				<Provider store={ store }>
					<RenewScreen />
				</Provider>,
			);
		} );
	} );

	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
		delete window.fetch;
	} );

	it( 'is where a site with a lapsed plan starts', () => {
		expect( store.getState().onboarding.step ).toBe( STEPS.RENEW );
	} );

	it( 'links to renewal for the site\'s organization', () => {
		expect( container.textContent ).toContain( 'Your GoDAM plan has expired' );
		expect( byTestId( 'godam-onboarding-button-renew' ).getAttribute( 'href' ) ).toContain( '/godam_upgrade?organization=acme' );
	} );

	/**
	 * Answer the refresh route with this.
	 *
	 * @param {Object}  body The JSON body.
	 * @param {boolean} ok   Whether the request worked.
	 */
	const answer = ( body, ok = true ) => {
		window.fetch = jest.fn( () => Promise.resolve( { ok, json: () => Promise.resolve( body ) } ) );
	};

	it( 'says so when the plan still shows as expired', async () => {
		answer( { valid_api_key: false, api_key_status: 'expired' } );

		await click( 'godam-onboarding-button-check-renewal' );

		expect( window.fetch ).toHaveBeenCalledWith( 'https://site.example/wp-json/godam/v1/settings/refresh-api-key-status', expect.objectContaining( { method: 'POST' } ) );
		expect( store.getState().onboarding.notice ).toEqual( expect.objectContaining( { status: 'warning' } ) );
		expect( byTestId( 'godam-onboarding-button-check-renewal' ).disabled ).toBe( false );
	} );

	it( 'says so when GoDAM can\'t be reached', async () => {
		window.fetch = jest.fn( () => Promise.reject( new Error( 'offline' ) ) );

		await click( 'godam-onboarding-button-check-renewal' );

		expect( store.getState().onboarding.notice ).toEqual( expect.objectContaining( { status: 'error' } ) );
	} );

	it( 'says GoDAM couldn\'t be reached when the site couldn\'t reach Central', async () => {
		// The refresh route answers 200 and says so in api_key_status.
		answer( { valid_api_key: false, api_key_status: 'verification_failed' } );

		await click( 'godam-onboarding-button-check-renewal' );

		expect( store.getState().onboarding.notice ).toEqual( expect.objectContaining( { status: 'error', message: expect.stringContaining( 'Couldn\'t reach GoDAM' ) } ) );
	} );

	it( 'doesn\'t read a failed request as an expired plan', async () => {
		// An expired nonce: 403 from WordPress, not an answer about the plan.
		answer( { code: 'rest_cookie_invalid_nonce' }, false );

		await click( 'godam-onboarding-button-check-renewal' );

		expect( store.getState().onboarding.notice ).toEqual( expect.objectContaining( { status: 'error' } ) );
	} );

	it( 'offers a different license key', async () => {
		await click( 'godam-onboarding-link-other-key' );

		expect( store.getState().onboarding.step ).toBe( STEPS.LICENSE );
	} );
} );
