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
import OnboardingModal from './components/OnboardingModal';
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

// Each step → its screen + how the modal frames it (split two-pane vs small dialog).
const SCREENS = {
	[ STEPS.ENTRY ]: { Comp: EntryScreen, layout: 'split', sidePanel: 'social' },
	[ STEPS.SIGNUP ]: { Comp: SignupScreen, layout: 'split', sidePanel: 'features' },
	[ STEPS.VERIFY_EMAIL ]: { Comp: VerifyEmailScreen, layout: 'split', sidePanel: 'features' },
	[ STEPS.LOGIN ]: { Comp: LoginScreen, layout: 'split', sidePanel: 'features' },
	[ STEPS.FORGOT_PASSWORD ]: { Comp: ForgotPasswordScreen, layout: 'split', sidePanel: 'features' },
	[ STEPS.LICENSE ]: { Comp: LicenseKeyScreen, layout: 'split', sidePanel: 'features' },
	[ STEPS.WORKSPACE ]: { Comp: WorkspaceScreen, layout: 'dialog' },
	[ STEPS.WELCOME ]: { Comp: WelcomeScreen, layout: 'dialog' },
};

const App = () => {
	const dispatch = useDispatch();
	const step = useSelector( ( state ) => state.onboarding.step );
	const proceedToWorkspace = useProceedToWorkspace();
	const [ googleLogin ] = useGoogleLoginMutation();
	const handledCode = useRef( false );

	// Google OAuth code lands back in this SPA (single-use) → exchange for a JWT.
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

	const { Comp, layout, sidePanel } = SCREENS[ step ] || SCREENS[ STEPS.ENTRY ];

	return (
		<OnboardingModal layout={ layout } sidePanel={ sidePanel }>
			<Comp />
		</OnboardingModal>
	);
};

export default App;
