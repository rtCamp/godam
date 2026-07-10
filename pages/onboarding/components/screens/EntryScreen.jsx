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
import { goToStep } from '../../redux/slice/onboarding';
import { STEPS, config } from '../../utils/constants';
import { useGoogleSignIn } from '../../utils/use-google-signin';

/**
 * Entry — the trial CTA + sign-in options. O9: when WooCommerce is active
 * (config.isWoo) the heading/intro switch to the Woo-specific variant.
 */
const EntryScreen = () => {
	const dispatch = useDispatch();
	const { signIn: handleGoogle, isLoading: isGoogleLoading } = useGoogleSignIn();
	const isWoo = !! config.isWoo;

	return (
		<>
			<BrandLogo markOnly />
			<h1 className="godam-onboarding__title godam-onboarding__title--lg">
				{ isWoo ? __( 'You have unlocked GoDAM for Woo', 'godam' ) : __( 'Welcome to GoDAM Pro!', 'godam' ) }
			</h1>
			<p className="godam-onboarding__subtitle">
				{ isWoo
					? __( 'Turn your product videos into interactive shopping experiences, focused video content for WooCommerce.', 'godam' )
					: __( 'A scalable digital asset management platform for WordPress, optimized for conversion-driven video content.', 'godam' ) }
			</p>

			<Button variant="primary" className="godam-onb-btn godam-onb-btn--primary godam-onboarding__cta" onClick={ () => dispatch( goToStep( STEPS.SIGNUP ) ) } data-test-id="godam-onboarding-button-start-trial">
				{ __( 'New here? Start your 60-day free trial now.', 'godam' ) }
			</Button>
			<p className="godam-onboarding__trial-note">
				{ __( 'Enjoy a 60-day free trial. After that, continue for $9/month or cancel anytime. No credit card or payment required today.', 'godam' ) }
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
