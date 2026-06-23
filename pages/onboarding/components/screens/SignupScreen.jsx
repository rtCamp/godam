/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { Button, TextControl, CheckboxControl, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';

/**
 * Internal dependencies
 */
import { GoogleIcon } from '../icons';
import { useSignupMutation, useGoogleLoginMutation } from '../../redux/api/onboarding';
import { goToStep, setEmail, setNotice } from '../../redux/slice/onboarding';
import { STEPS, config } from '../../utils/constants';
import { validateSignup } from '../../utils/validators';
import { useProceedToWorkspace } from '../../utils/use-connect';

const Required = () => <span className="godam-onboarding__required">*</span>;

/**
 * O1 — Free-trial signup. On success godam-core creates a disabled account +
 * emails a verification link (no JWT) → advance to the verify screen.
 */
const SignupScreen = () => {
	const dispatch = useDispatch();
	const [ signup, { isLoading } ] = useSignupMutation();
	const [ googleLogin, { isLoading: isGoogleLoading } ] = useGoogleLoginMutation();
	const proceedToWorkspace = useProceedToWorkspace();
	const [ fields, setFields ] = useState( { firstName: '', lastName: '', email: '', password: '', confirm: '', tnc: false, newsletter: false } );
	const [ errors, setErrors ] = useState( {} );

	const set = ( key ) => ( value ) => setFields( ( f ) => ( { ...f, [ key ]: value } ) );

	const handleGoogle = async () => {
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

	const handleSubmit = async () => {
		const validation = validateSignup( fields );
		setErrors( validation );
		if ( Object.keys( validation ).length ) {
			return;
		}
		try {
			await signup( {
				first_name: fields.firstName,
				last_name: fields.lastName,
				email: fields.email.trim().toLowerCase(),
				password: fields.password,
				tnc: fields.tnc ? 1 : 0,
				newsletter: fields.newsletter ? 1 : 0,
				wordpress_site: config.siteUrl,
			} ).unwrap();
			dispatch( setEmail( fields.email.trim().toLowerCase() ) );
			dispatch( goToStep( STEPS.VERIFY_EMAIL ) );
		} catch ( error ) {
			dispatch( setNotice( { status: 'error', message: error?.data?.message || __( 'Could not create your account. Please try again.', 'godam' ) } ) );
		}
	};

	return (
		<>
			<button type="button" className="godam-onboarding__back" onClick={ () => dispatch( goToStep( STEPS.ENTRY ) ) } data-test-id="godam-onboarding-button-back">
				‹ { __( 'BACK', 'godam' ) }
			</button>
			<h1 className="godam-onboarding__title">{ __( 'Create your account', 'godam' ) }</h1>

			<Button className="godam-onb-btn godam-onb-btn--secondary" onClick={ handleGoogle } disabled={ isGoogleLoading } data-test-id="godam-onboarding-button-google">
				{ isGoogleLoading ? <Spinner /> : <GoogleIcon /> } { __( 'Continue with Google', 'godam' ) }
			</Button>

			<div className="godam-onboarding__or">{ __( 'OR', 'godam' ) }</div>

			<div className="godam-onboarding__form">
				<div className="godam-onboarding__row">
					<TextControl __nextHasNoMarginBottom label={ <>{ __( 'First Name', 'godam' ) } <Required /></> } value={ fields.firstName } onChange={ set( 'firstName' ) } help={ errors.firstName } placeholder={ __( 'First Name', 'godam' ) } data-test-id="godam-onboarding-input-first-name" />
					<TextControl __nextHasNoMarginBottom label={ <>{ __( 'Last Name', 'godam' ) } <Required /></> } value={ fields.lastName } onChange={ set( 'lastName' ) } placeholder={ __( 'Last Name', 'godam' ) } data-test-id="godam-onboarding-input-last-name" />
				</div>
				<TextControl __nextHasNoMarginBottom type="email" label={ <>{ __( 'Email', 'godam' ) } <Required /></> } value={ fields.email } onChange={ set( 'email' ) } help={ errors.email } placeholder="you@example.com" data-test-id="godam-onboarding-input-email" />
				<TextControl __nextHasNoMarginBottom type="password" label={ <>{ __( 'Password', 'godam' ) } <Required /></> } value={ fields.password } onChange={ set( 'password' ) } help={ errors.password } placeholder={ __( 'Enter password', 'godam' ) } data-test-id="godam-onboarding-input-password" />
				<TextControl __nextHasNoMarginBottom type="password" label={ <>{ __( 'Confirm Password', 'godam' ) } <Required /></> } value={ fields.confirm } onChange={ set( 'confirm' ) } help={ errors.confirm } placeholder={ __( 'Enter Password', 'godam' ) } data-test-id="godam-onboarding-input-confirm" />

				<CheckboxControl __nextHasNoMarginBottom checked={ fields.tnc } onChange={ set( 'tnc' ) } help={ errors.tnc } data-test-id="godam-onboarding-checkbox-tnc"
					label={ <>{ __( 'I agree to', 'godam' ) } <a className="godam-onboarding__link" href="https://godam.io/terms/" target="_blank" rel="noreferrer">{ __( 'Terms and Conditions, Privacy Policy, Refund Policy', 'godam' ) }</a></> } />
				<CheckboxControl __nextHasNoMarginBottom checked={ fields.newsletter } onChange={ set( 'newsletter' ) } label={ __( 'I agree to Subscribe Newsletter to receive future updates and releases news.', 'godam' ) } data-test-id="godam-onboarding-checkbox-newsletter" />
			</div>

			<Button variant="primary" className="godam-onb-btn godam-onb-btn--primary godam-onboarding__cta" onClick={ handleSubmit } disabled={ isLoading } isBusy={ isLoading } data-test-id="godam-onboarding-button-signup">
				{ isLoading ? __( 'Creating…', 'godam' ) : __( 'Sign Up', 'godam' ) }
			</Button>
			<p className="godam-onboarding__alt">
				{ __( 'Already have an account?', 'godam' ) }{ ' ' }
				<button type="button" className="godam-onboarding__link" onClick={ () => dispatch( goToStep( STEPS.LOGIN ) ) } data-test-id="godam-onboarding-link-login">{ __( 'Sign in', 'godam' ) }</button>
			</p>
		</>
	);
};

export default SignupScreen;
