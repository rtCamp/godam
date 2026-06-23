/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { Button, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';

/**
 * Internal dependencies
 */
import { useResetPasswordMutation } from '../../redux/api/onboarding';
import { goToStep, setNotice } from '../../redux/slice/onboarding';
import { STEPS } from '../../utils/constants';
import { isValidEmail } from '../../utils/validators';

/**
 * O4 — request a reset link. The reset itself completes on the web
 * (godam-core emails a link → Frappe's update-password page).
 */
const ForgotPasswordScreen = () => {
	const dispatch = useDispatch();
	const [ reset, { isLoading } ] = useResetPasswordMutation();
	const [ email, setEmailValue ] = useState( '' );
	const [ sent, setSent ] = useState( false );

	const handleSubmit = async () => {
		if ( ! isValidEmail( email ) ) {
			dispatch( setNotice( { status: 'error', message: __( 'Enter a valid email address.', 'godam' ) } ) );
			return;
		}
		try {
			await reset( email.trim().toLowerCase() ).unwrap();
			setSent( true );
		} catch ( error ) {
			dispatch( setNotice( { status: 'error', message: error?.data?.message || __( 'Could not send the reset link.', 'godam' ) } ) );
		}
	};

	return (
		<>
			<button type="button" className="godam-onboarding__back" onClick={ () => dispatch( goToStep( STEPS.LOGIN ) ) } data-test-id="godam-onboarding-button-back">
				‹ { __( 'BACK', 'godam' ) }
			</button>
			<h1 className="godam-onboarding__title">{ __( 'Reset your password', 'godam' ) }</h1>

			{ sent ? (
				<p className="godam-onboarding__subtitle" data-test-id="godam-onboarding-text-reset-sent">
					{ __( "If that account exists, we've emailed a link to set a new password. Open it to finish resetting, then come back and sign in.", 'godam' ) }
				</p>
			) : (
				<>
					<p className="godam-onboarding__subtitle">{ __( "Confirm your email and we'll send you a link to set up a new password.", 'godam' ) }</p>
					<div className="godam-onboarding__form">
						<TextControl __nextHasNoMarginBottom type="email" label={ __( 'Email', 'godam' ) } value={ email } onChange={ setEmailValue } placeholder="you@example.com" data-test-id="godam-onboarding-input-email" />
					</div>
					<Button variant="primary" className="godam-onb-btn godam-onb-btn--primary godam-onboarding__cta" onClick={ handleSubmit } disabled={ isLoading } isBusy={ isLoading } data-test-id="godam-onboarding-button-reset">
						{ isLoading ? __( 'Sending…', 'godam' ) : __( 'Reset Password', 'godam' ) }
					</Button>
				</>
			) }

			<p className="godam-onboarding__alt">
				<button type="button" className="godam-onboarding__link" onClick={ () => dispatch( goToStep( STEPS.LOGIN ) ) } data-test-id="godam-onboarding-link-back-signin">{ __( 'Go back to sign in', 'godam' ) }</button>
			</p>
		</>
	);
};

export default ForgotPasswordScreen;
