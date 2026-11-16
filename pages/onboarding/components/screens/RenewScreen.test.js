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

	it( 'says so when the plan still shows as expired', async () => {
		window.fetch = jest.fn( () => Promise.resolve( { json: () => Promise.resolve( { valid_api_key: false } ) } ) );

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

	it( 'offers a different license key', async () => {
		await click( 'godam-onboarding-link-other-key' );

		expect( store.getState().onboarding.step ).toBe( STEPS.LICENSE );
	} );
} );
