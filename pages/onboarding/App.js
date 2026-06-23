/**
 * WordPress dependencies
 */
import { useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * Internal dependencies
 */
import OnboardingLayout from './components/OnboardingLayout';
import EntryScreen from './components/screens/EntryScreen';
import SignupScreen from './components/screens/SignupScreen';
import VerifyEmailScreen from './components/screens/VerifyEmailScreen';
import LoginScreen from './components/screens/LoginScreen';
import ForgotPasswordScreen from './components/screens/ForgotPasswordScreen';
import LicenseKeyScreen from './components/screens/LicenseKeyScreen';
import WorkspaceScreen from './components/screens/WorkspaceScreen';
import WelcomeScreen from './components/screens/WelcomeScreen';
import { STEPS } from './utils/constants';
import { setNotice } from './redux/slice/onboarding';
import { useGoogleLoginMutation } from './redux/api/onboarding';
import { useProceedToWorkspace } from './utils/use-connect';

const SCREENS = {
	[ STEPS.ENTRY ]: EntryScreen,
	[ STEPS.SIGNUP ]: SignupScreen,
	[ STEPS.VERIFY_EMAIL ]: VerifyEmailScreen,
	[ STEPS.LOGIN ]: LoginScreen,
	[ STEPS.FORGOT_PASSWORD ]: ForgotPasswordScreen,
	[ STEPS.LICENSE ]: LicenseKeyScreen,
	[ STEPS.WORKSPACE ]: WorkspaceScreen,
	[ STEPS.WELCOME ]: WelcomeScreen,
};

const App = () => {
	const dispatch = useDispatch();
	const step = useSelector( ( state ) => state.onboarding.step );
	const proceedToWorkspace = useProceedToWorkspace();
	const [ googleLogin ] = useGoogleLoginMutation();
	const handledCode = useRef( false );

	// Google OAuth code lands back in this SPA (single-use) → exchange it for a JWT.
	useEffect( () => {
		if ( handledCode.current ) {
			return;
		}
		const params = new URLSearchParams( window.location.search );
		const code = params.get( 'code' );
		if ( ! code ) {
			return;
		}
		handledCode.current = true;
		// Strip the single-use code from the URL so a refresh can't replay it.
		params.delete( 'code' );
		window.history.replaceState( {}, '', `${ window.location.pathname }?${ params.toString() }` );
		( async () => {
			try {
				const session = await googleLogin( code ).unwrap();
				await proceedToWorkspace( session );
			} catch ( error ) {
				dispatch( setNotice( { status: 'error', message: error?.data?.message || __( 'Google sign-in failed.', 'godam' ) } ) );
			}
		} )();
	}, [ dispatch, googleLogin, proceedToWorkspace ] );

	const Screen = SCREENS[ step ] || EntryScreen;

	return (
		<OnboardingLayout>
			<Screen />
		</OnboardingLayout>
	);
};

export default App;
