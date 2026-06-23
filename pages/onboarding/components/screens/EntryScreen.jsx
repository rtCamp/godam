/**
 * WordPress dependencies
 */
import { Button, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';

/**
 * Internal dependencies
 */
import BrandLogo from '../BrandLogo';
import { MailIcon, GoogleIcon, KeyIcon } from '../icons';
import { goToStep, setNotice } from '../../redux/slice/onboarding';
import { STEPS } from '../../utils/constants';
import { useGoogleOauthUrlMutation } from '../../redux/api/onboarding';

/**
 * Entry — "Welcome to GoDAM Pro!" with the trial CTA + sign-in options.
 */
const EntryScreen = () => {
	const dispatch = useDispatch();
	const [ getGoogleOauthUrl, { isLoading: isGoogleLoading } ] = useGoogleOauthUrlMutation();

	const handleGoogle = async () => {
		// godam-core builds the Google URL; the OAuth code lands back in this
		// SPA (App.js) and is exchanged for a session via the proxy.
		try {
			const { url } = await getGoogleOauthUrl().unwrap();
			if ( url ) {
				window.location.href = url;
			}
		} catch ( error ) {
			dispatch( setNotice( { status: 'error', message: error?.data?.message || __( 'Could not start Google sign-in.', 'godam' ) } ) );
		}
	};

	return (
		<>
			<BrandLogo markOnly />
			<h1 className="godam-onboarding__title">{ __( 'Welcome to GoDAM Pro!', 'godam' ) }</h1>
			<p className="godam-onboarding__subtitle">
				{ __( 'A scalable digital asset management platform for WordPress, optimized for conversion-driven video content.', 'godam' ) }
			</p>

			<Button variant="primary" className="godam-onb-btn godam-onb-btn--primary godam-onboarding__cta" onClick={ () => dispatch( goToStep( STEPS.SIGNUP ) ) } data-test-id="godam-onboarding-button-start-trial">
				{ __( 'New here? Start your 30-day free trial now.', 'godam' ) }
			</Button>
			<p className="godam-onboarding__trial-note">
				{ __( 'Enjoy a 30-day free trial. After that, continue for $290/year or cancel anytime. No payment required today.', 'godam' ) }
			</p>

			<div className="godam-onboarding__or">{ __( 'OR', 'godam' ) }</div>

			<Button className="godam-onb-btn godam-onb-btn--secondary" onClick={ () => dispatch( goToStep( STEPS.LOGIN ) ) } data-test-id="godam-onboarding-button-login-email">
				<MailIcon /> { __( 'Login with Email', 'godam' ) }
			</Button>
			<Button className="godam-onb-btn godam-onb-btn--secondary" onClick={ handleGoogle } disabled={ isGoogleLoading } data-test-id="godam-onboarding-button-google">
				{ isGoogleLoading ? <Spinner /> : <GoogleIcon /> } { __( 'Continue with Google', 'godam' ) }
			</Button>
			<Button className="godam-onb-btn godam-onb-btn--secondary" onClick={ () => dispatch( goToStep( STEPS.LICENSE ) ) } data-test-id="godam-onboarding-button-license">
				<KeyIcon /> { __( 'Already have a License key?', 'godam' ) }
			</Button>
		</>
	);
};

export default EntryScreen;
