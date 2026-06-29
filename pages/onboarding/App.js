/**
 * External dependencies
 */
import { useSelector } from 'react-redux';

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
import { STEPS, config } from './utils/constants';

// Each step → its screen + how the modal frames it (split two-pane vs small dialog).
// O9: Woo users see the feature grid on the entry screen (the design's Woo variant).
const SCREENS = {
	[ STEPS.ENTRY ]: { Comp: EntryScreen, layout: 'split', sidePanel: config.isWoo ? 'features' : 'social' },
	[ STEPS.SIGNUP ]: { Comp: SignupScreen, layout: 'split', sidePanel: 'features' },
	[ STEPS.VERIFY_EMAIL ]: { Comp: VerifyEmailScreen, layout: 'split', sidePanel: 'features' },
	[ STEPS.LOGIN ]: { Comp: LoginScreen, layout: 'split', sidePanel: 'features' },
	[ STEPS.FORGOT_PASSWORD ]: { Comp: ForgotPasswordScreen, layout: 'split', sidePanel: 'features' },
	[ STEPS.LICENSE ]: { Comp: LicenseKeyScreen, layout: 'split', sidePanel: 'features' },
	[ STEPS.WORKSPACE ]: { Comp: WorkspaceScreen, layout: 'dialog' },
	[ STEPS.WELCOME ]: { Comp: WelcomeScreen, layout: 'dialog' },
};

const App = () => {
	const step = useSelector( ( state ) => state.onboarding.step );
	const { Comp, layout, sidePanel } = SCREENS[ step ] || SCREENS[ STEPS.ENTRY ];

	return (
		<OnboardingModal layout={ layout } sidePanel={ sidePanel }>
			<Comp />
		</OnboardingModal>
	);
};

export default App;
