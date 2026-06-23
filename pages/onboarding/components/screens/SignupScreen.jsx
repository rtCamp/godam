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
import { useSignupMutation } from '../../redux/api/onboarding';
import { goToStep, setEmail, setNotice } from '../../redux/slice/onboarding';
import { STEPS, config } from '../../utils/constants';
import { validateSignup } from '../../utils/validators';

/**
 * O1 — Free-trial signup. On success godam-core creates a *disabled* account
 * and emails a verification link (no JWT yet) → advance to the verify screen.
 */
const SignupScreen = () => {
	const dispatch = useDispatch();
	const [ signup, { isLoading } ] = useSignupMutation();
	const [ fields, setFields ] = useState( { firstName: '', lastName: '', email: '', password: '', confirm: '', tnc: false, newsletter: false } );
	const [ errors, setErrors ] = useState( {} );

	const set = ( key ) => ( value ) => setFields( ( f ) => ( { ...f, [ key ]: value } ) );

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
		<div className="godam-onboarding__form">
			<h1 className="godam-onboarding__title">{ __( 'Create your account', 'godam' ) }</h1>
			<p className="godam-onboarding__subtitle">{ __( 'New here? Start your 30-day free trial now.', 'godam' ) }</p>

			<div className="godam-onboarding__row">
				<TextControl __nextHasNoMarginBottom label={ __( 'First name', 'godam' ) } value={ fields.firstName } onChange={ set( 'firstName' ) } help={ errors.firstName } className={ errors.firstName ? 'is-error' : '' } data-test-id="godam-onboarding-input-first-name" />
				<TextControl __nextHasNoMarginBottom label={ __( 'Last name', 'godam' ) } value={ fields.lastName } onChange={ set( 'lastName' ) } data-test-id="godam-onboarding-input-last-name" />
			</div>
			<TextControl __nextHasNoMarginBottom type="email" label={ __( 'Email', 'godam' ) } value={ fields.email } onChange={ set( 'email' ) } help={ errors.email } data-test-id="godam-onboarding-input-email" />
			<TextControl __nextHasNoMarginBottom type="password" label={ __( 'Password', 'godam' ) } value={ fields.password } onChange={ set( 'password' ) } help={ errors.password } data-test-id="godam-onboarding-input-password" />
			<TextControl __nextHasNoMarginBottom type="password" label={ __( 'Confirm password', 'godam' ) } value={ fields.confirm } onChange={ set( 'confirm' ) } help={ errors.confirm } data-test-id="godam-onboarding-input-confirm" />

			<CheckboxControl __nextHasNoMarginBottom label={ __( 'I agree to the Terms, Privacy Policy and Refund Policy.', 'godam' ) } checked={ fields.tnc } onChange={ set( 'tnc' ) } help={ errors.tnc } data-test-id="godam-onboarding-checkbox-tnc" />
			<CheckboxControl __nextHasNoMarginBottom label={ __( 'Subscribe to the newsletter for updates.', 'godam' ) } checked={ fields.newsletter } onChange={ set( 'newsletter' ) } data-test-id="godam-onboarding-checkbox-newsletter" />

			<Button variant="primary" className="godam-onboarding__cta" onClick={ handleSubmit } disabled={ isLoading } isBusy={ isLoading } icon={ isLoading && <Spinner /> } data-test-id="godam-onboarding-button-signup">
				{ isLoading ? __( 'Creating…', 'godam' ) : __( 'Sign up', 'godam' ) }
			</Button>

			<p className="godam-onboarding__alt">
				{ __( 'Already have an account?', 'godam' ) }{ ' ' }
				<Button variant="link" onClick={ () => dispatch( goToStep( STEPS.LOGIN ) ) } data-test-id="godam-onboarding-link-login">{ __( 'Sign in', 'godam' ) }</Button>
			</p>
		</div>
	);
};

export default SignupScreen;
