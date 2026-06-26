/**
 * WordPress dependencies
 */
import { useState, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';

/**
 * Internal dependencies
 */
import { useGoogleOauthUrlMutation, useExchangeOauthCodeMutation } from '../redux/api/onboarding';
import { setNotice } from '../redux/slice/onboarding';
import { useProceedToWorkspace } from './use-connect';
import { config } from './constants';

/**
 * Google sign-in via godam-core's popup + `postMessage` flow.
 *
 * The Social Login redirect delivers Google's code to godam-core's own callback,
 * not back to this page — so we open a popup, let the GoDAM completion page
 * postMessage a one-time handoff code to this window (pinned to the GoDAM app
 * origin), then exchange that code for a session through the WP proxy. The JWT is
 * held server-side and never touches the browser.
 *
 * @return {{ signIn: () => void, isLoading: boolean }} Click handler + pending state.
 */
export const useGoogleSignIn = () => {
	const dispatch = useDispatch();
	const proceedToWorkspace = useProceedToWorkspace();
	const [ getGoogleOauthUrl ] = useGoogleOauthUrlMutation();
	const [ exchangeOauthCode ] = useExchangeOauthCodeMutation();
	const [ isLoading, setIsLoading ] = useState( false );

	const signIn = useCallback( () => {
		// Without the GoDAM app origin we can't trust (or even receive) the popup's
		// handoff message, so sign-in could never complete — fail fast instead of
		// opening a popup that hangs and reports a misleading "cancelled".
		if ( ! config.appOrigin ) {
			dispatch( setNotice( { status: 'error', message: __( 'Google sign-in is unavailable right now. Please use another sign-in method.', 'godam' ) } ) );
			return;
		}
		// Open the popup synchronously on the click, or the browser blocks it.
		const popup = window.open( 'about:blank', 'godam_google', 'width=480,height=640' );
		if ( ! popup ) {
			dispatch( setNotice( { status: 'error', message: __( 'Popup blocked — allow popups for this site and try again.', 'godam' ) } ) );
			return;
		}
		setIsLoading( true );

		let settled = false;
		let poll = null;
		const cleanup = () => {
			window.removeEventListener( 'message', onMessage );
			if ( poll ) {
				clearInterval( poll );
			}
			setIsLoading( false );
		};
		const fail = ( message ) => {
			if ( settled ) {
				return;
			}
			settled = true;
			cleanup();
			if ( ! popup.closed ) {
				popup.close();
			}
			dispatch( setNotice( { status: 'error', message } ) );
		};

		async function onMessage( event ) {
			// Trust only the GoDAM completion page, and only its handoff message.
			if ( ! config.appOrigin || event.origin !== config.appOrigin ) {
				return;
			}
			if ( event.data?.source !== 'godam-oauth' || ! event.data.godam_code || settled ) {
				return;
			}
			settled = true;
			cleanup();
			if ( ! popup.closed ) {
				popup.close();
			}
			try {
				const session = await exchangeOauthCode( event.data.godam_code ).unwrap();
				await proceedToWorkspace( session );
			} catch ( error ) {
				dispatch( setNotice( { status: 'error', message: error?.data?.message || __( 'Google sign-in failed.', 'godam' ) } ) );
			}
		}

		window.addEventListener( 'message', onMessage );

		// User closed the popup without finishing.
		poll = setInterval( () => {
			if ( popup.closed && ! settled ) {
				fail( __( 'Google sign-in was cancelled.', 'godam' ) );
			}
		}, 500 );

		// Point the popup at the authorize URL, scoped to this site's origin.
		getGoogleOauthUrl( window.location.origin ).unwrap()
			.then( ( { url } ) => {
				if ( ! url ) {
					throw new Error( 'no-url' );
				}
				popup.location = url;
			} )
			.catch( ( error ) => {
				fail( error?.data?.message || __( 'Could not start Google sign-in.', 'godam' ) );
			} );
	}, [ dispatch, getGoogleOauthUrl, exchangeOauthCode, proceedToWorkspace ] );

	return { signIn, isLoading };
};
