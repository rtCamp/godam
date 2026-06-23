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
import { goToStep, setNotice } from '../../redux/slice/onboarding';
import { STEPS, config } from '../../utils/constants';
import { useGoogleLoginMutation } from '../../redux/api/onboarding';
import { useProceedToWorkspace } from '../../utils/use-connect';

/**
 * Entry — "Welcome to GoDAM Pro!" with the three entry CTAs.
 */
const EntryScreen = () => {
	const dispatch = useDispatch();
	const proceedToWorkspace = useProceedToWorkspace();
	const [ googleLogin, { isLoading: isGoogleLoading } ] = useGoogleLoginMutation();

	const handleGoogle = async () => {
		// Real flow: redirect to godam-core's get_oauth2_url; the OAuth `code`
		// then lands back in this SPA and is POSTed to google_login. In mock
		// mode we short-circuit with a fake code so the flow stays clickable.
		if ( ! config.mock && config.googleOauthUrl ) {
			window.location.href = config.googleOauthUrl;
			return;
		}
		try {
			const session = await googleLogin( 'mock-oauth-code' ).unwrap();
			await proceedToWorkspace( session );
		} catch ( error ) {
			dispatch( setNotice( { status: 'error', message: error?.data?.message || __( 'Google sign-in failed.', 'godam' ) } ) );
		}
	};

	return (
		<div className="godam-onboarding__form">
			<h1 className="godam-onboarding__title">{ __( 'Welcome to GoDAM Pro!', 'godam' ) }</h1>
			<p className="godam-onboarding__subtitle">{ __( 'Start your 30-day free trial. No credit card required.', 'godam' ) }</p>

			<Button
				variant="primary"
				className="godam-onboarding__cta"
				onClick={ () => dispatch( goToStep( STEPS.SIGNUP ) ) }
				data-test-id="godam-onboarding-button-start-trial"
			>
				{ __( 'Start free trial', 'godam' ) }
			</Button>

			<Button
				variant="secondary"
				className="godam-onboarding__cta"
				onClick={ handleGoogle }
				disabled={ isGoogleLoading }
				icon={ isGoogleLoading && <Spinner /> }
				data-test-id="godam-onboarding-button-google"
			>
				{ __( 'Continue with Google', 'godam' ) }
			</Button>

			<Button
				variant="tertiary"
				className="godam-onboarding__cta"
				onClick={ () => dispatch( goToStep( STEPS.LICENSE ) ) }
				data-test-id="godam-onboarding-button-license"
			>
				{ __( 'Activate with license key', 'godam' ) }
			</Button>

			<p className="godam-onboarding__alt">
				{ __( 'Already have an account?', 'godam' ) }{ ' ' }
				<Button variant="link" onClick={ () => dispatch( goToStep( STEPS.LOGIN ) ) } data-test-id="godam-onboarding-link-login">
					{ __( 'Sign in', 'godam' ) }
				</Button>
			</p>
		</div>
	);
};

export default EntryScreen;
