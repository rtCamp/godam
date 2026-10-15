/**
 * Unit tests for the onboarding notice: every error comes with a Contact Support link,
 * except the ones a screen marks as the user's own input or browser setting.
 *
 * Mounted into a jsdom container with react-dom/client + act (the pattern used by
 * useAnalyticsOutage.test.js), because the modal uses hooks.
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
import OnboardingModal from './OnboardingModal';
import onboardingReducer from '../redux/slice/onboarding';
import { SUPPORT_URL } from '../../shared/support';

// Only the text and status matter here; the real components pull in a second copy of React.
jest.mock( '@wordpress/components', () => ( {
	Notice: ( { children, status } ) => <div data-status={ status }>{ children }</div>,
} ) );

global.IS_REACT_ACT_ENVIRONMENT = true;

const render = ( notice ) => {
	const store = configureStore( {
		reducer: { onboarding: onboardingReducer },
		preloadedState: { onboarding: { notice } },
	} );
	const container = document.createElement( 'div' );
	document.body.appendChild( container );
	const root = createRoot( container );

	act( () => {
		root.render(
			<Provider store={ store }>
				<OnboardingModal layout="dialog">
					<span>screen</span>
				</OnboardingModal>
			</Provider>,
		);
	} );

	const html = container.innerHTML;
	act( () => root.unmount() );
	container.remove();

	return html;
};

describe( 'OnboardingModal notice', () => {
	it( 'adds Contact Support to an error', () => {
		const html = render( { status: 'error', message: 'Could not reach GoDAM. Please try again.' } );

		expect( html ).toContain( 'Could not reach GoDAM. Please try again.' );
		expect( html ).toContain( 'godam-onboarding-link-contact-support' );
		expect( html ).toContain( SUPPORT_URL );
	} );

	it( 'treats a notice with no status as an error', () => {
		expect( render( { message: 'Something failed.' } ) ).toContain( 'godam-onboarding-link-contact-support' );
	} );

	it( 'leaves Contact Support off when the screen sets support to false', () => {
		const html = render( { status: 'error', message: 'Popup blocked.', support: false } );

		expect( html ).toContain( 'Popup blocked.' );
		expect( html ).not.toContain( 'godam-onboarding-link-contact-support' );
	} );

	it( 'leaves Contact Support off a success notice', () => {
		const html = render( { status: 'success', message: 'Verification email re-sent.' } );

		expect( html ).toContain( 'Verification email re-sent.' );
		expect( html ).not.toContain( 'godam-onboarding-link-contact-support' );
	} );

	it( 'renders no notice when there is none', () => {
		expect( render( null ) ).not.toContain( 'godam-onboarding-link-contact-support' );
	} );
} );
