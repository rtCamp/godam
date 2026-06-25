/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { Button, TextControl, CheckboxControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * Internal dependencies
 */
import BackButton from '../BackButton';
import { usePasswordLoginMutation } from '../../redux/api/onboarding';
import { goToStep, setEmail, setNotice } from '../../redux/slice/onboarding';
import { STEPS, config } from '../../utils/constants';
import { isValidEmail } from '../../utils/validators';
import { useProceedToWorkspace } from '../../utils/use-connect';

/**
 * O3 — email/password login → JWT → workspace picker.
 */
const LoginScreen = () => {
	const dispatch = useDispatch();
	const storedEmail = useSelector( ( state ) => state.onboarding.email );
	const proceedToWorkspace = useProceedToWorkspace();
	const [ login, { isLoading } ] = usePasswordLoginMutation();
	const [ email, setLocalEmail ] = useState( storedEmail || '' );
	const [ password, setPassword ] = useState( '' );
	const [ remember, setRemember ] = useState( true );

	const handleSubmit = async () => {
		if ( ! isValidEmail( email ) || ! password ) {
			dispatch( setNotice( { status: 'error', message: __( 'Enter a valid email and password.', 'godam' ) } ) );
			return;
		}
		try {
			const session = await login( { email: email.trim().toLowerCase(), password, remember, wordpress_site: config.siteUrl } ).unwrap();
			dispatch( setEmail( email.trim().toLowerCase() ) );
			await proceedToWorkspace( session );
		} catch ( error ) {
			dispatch( setNotice( { status: 'error', message: error?.data?.message || __( 'Invalid email or password.', 'godam' ) } ) );
		}
	};

	return (
		<>
			<BackButton onClick={ () => dispatch( goToStep( STEPS.ENTRY ) ) } />
			<h1 className="godam-onboarding__title">{ __( 'Sign in to your account', 'godam' ) }</h1>

			<div className="godam-onboarding__form">
				<TextControl __nextHasNoMarginBottom type="email" label={ __( 'Email', 'godam' ) } value={ email } onChange={ setLocalEmail } placeholder="you@example.com" data-test-id="godam-onboarding-input-email" />
				<TextControl __nextHasNoMarginBottom type="password" label={ __( 'Password', 'godam' ) } value={ password } onChange={ setPassword } placeholder={ __( 'Enter Password', 'godam' ) } data-test-id="godam-onboarding-input-password" />
				<div className="godam-onboarding__inline">
					<CheckboxControl __nextHasNoMarginBottom label={ __( 'Keep me signed in', 'godam' ) } checked={ remember } onChange={ setRemember } data-test-id="godam-onboarding-checkbox-remember" />
					<button type="button" className="godam-onboarding__link" onClick={ () => dispatch( goToStep( STEPS.FORGOT_PASSWORD ) ) } data-test-id="godam-onboarding-link-forgot">{ __( 'Forgot Password?', 'godam' ) }</button>
				</div>
			</div>

			<Button variant="primary" className="godam-onb-btn godam-onb-btn--primary godam-onboarding__cta" onClick={ handleSubmit } disabled={ isLoading } isBusy={ isLoading } data-test-id="godam-onboarding-button-login">
				{ isLoading ? __( 'Signing in…', 'godam' ) : __( 'Sign in', 'godam' ) }
			</Button>

			<p className="godam-onboarding__alt">
				{ __( "Don't have an account?", 'godam' ) }{ ' ' }
				<button type="button" className="godam-onboarding__link" onClick={ () => dispatch( goToStep( STEPS.SIGNUP ) ) } data-test-id="godam-onboarding-link-signup">{ __( 'Sign up', 'godam' ) }</button>
			</p>
			<p className="godam-onboarding__alt">
				{ __( 'Got a licence key?', 'godam' ) }{ ' ' }
				<button type="button" className="godam-onboarding__link" onClick={ () => dispatch( goToStep( STEPS.LICENSE ) ) } data-test-id="godam-onboarding-link-license">{ __( 'Login with key', 'godam' ) }</button>
			</p>
		</>
	);
};

export default LoginScreen;
