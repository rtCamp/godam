/**
 * Unit tests for where Back goes from the license key screen.
 *
 * A site with a lapsed plan reaches this screen from the renewal screen ("Use it
 * instead"), so Back returns there instead of the new-user signup (#101).
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
import onboardingReducer, { goToStep } from '../../redux/slice/onboarding';
import { config, STEPS } from '../../utils/constants';
import LicenseKeyScreen from './LicenseKeyScreen';

jest.mock( '../../redux/api/onboarding', () => ( {
	useVerifyLicenseKeyMutation: jest.fn( () => [ jest.fn(), { isLoading: false } ] ),
} ) );

jest.mock( '../../utils/constants', () => ( {
	...jest.requireActual( '../../utils/constants' ),
	config: { connectionStatus: 'none' },
} ) );

describe( 'LicenseKeyScreen Back', () => {
	let container;
	let root;
	let store;

	beforeAll( () => {
		global.IS_REACT_ACT_ENVIRONMENT = true;
	} );

	/**
	 * Show the screen for a site with this connection status and click Back.
	 *
	 * @param {string} connectionStatus The site's connection status.
	 *
	 * @return {string} The step Back went to.
	 */
	const back = async ( connectionStatus ) => {
		config.connectionStatus = connectionStatus;
		store = configureStore( { reducer: { onboarding: onboardingReducer } } );
		store.dispatch( goToStep( STEPS.LICENSE ) );

		await act( async () => {
			root.render(
				<Provider store={ store }>
					<LicenseKeyScreen />
				</Provider>,
			);
		} );
		await act( async () => {
			container.querySelector( '[data-test-id="godam-onboarding-button-back"]' ).dispatchEvent( new window.MouseEvent( 'click', { bubbles: true } ) );
		} );

		return store.getState().onboarding.step;
	};

	beforeEach( () => {
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
	} );

	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
	} );

	it( 'goes back to renewal for a site with a lapsed plan', async () => {
		expect( await back( 'expired' ) ).toBe( STEPS.RENEW );
		// TextControl's own 36px-size deprecation notice, shown once (not from this screen's change).
		expect( console ).toHaveWarned();
	} );

	it( 'goes back to the start for a site that isn\'t connected', async () => {
		expect( await back( 'none' ) ).toBe( STEPS.ENTRY );
	} );
} );
