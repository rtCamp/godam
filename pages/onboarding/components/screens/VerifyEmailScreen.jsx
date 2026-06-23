/**
 * WordPress dependencies
 */
import { Button, Spinner } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { useDispatch, useSelector } from 'react-redux';

/**
 * Internal dependencies
 */
import { useResendVerificationMutation } from '../../redux/api/onboarding';
import { goToStep, setNotice } from '../../redux/slice/onboarding';
import { STEPS } from '../../utils/constants';

/**
 * Verify-email gate (not in the Figma — design follow-up). `signup` returns no
 * JWT; the account is disabled until the emailed link is clicked.
 */
const VerifyEmailScreen = () => {
	const dispatch = useDispatch();
	const email = useSelector( ( state ) => state.onboarding.email );
	const [ resend, { isLoading } ] = useResendVerificationMutation();

	const handleResend = async () => {
		try {
			const res = await resend( email ).unwrap();
			dispatch( setNotice( { status: 'success', message: res?.message || __( 'Verification email re-sent.', 'godam' ) } ) );
		} catch ( error ) {
			dispatch( setNotice( { status: 'error', message: error?.data?.message || __( 'Could not resend the email.', 'godam' ) } ) );
		}
	};

	return (
		<>
			<h1 className="godam-onboarding__title">{ __( 'Verify your email', 'godam' ) }</h1>
			<p className="godam-onboarding__subtitle">
				{ email
					? sprintf( /* translators: %s: user email address. */ __( 'We sent a verification link to %s. Click it to activate your account, then sign in.', 'godam' ), email )
					: __( 'We sent you a verification link. Click it to activate your account, then sign in.', 'godam' ) }
			</p>

			<Button variant="primary" className="godam-onb-btn godam-onb-btn--primary godam-onboarding__cta" onClick={ () => dispatch( goToStep( STEPS.LOGIN ) ) } data-test-id="godam-onboarding-button-verified-continue">
				{ __( "I've verified — sign in", 'godam' ) }
			</Button>
			<Button className="godam-onb-btn godam-onb-btn--secondary" onClick={ handleResend } disabled={ isLoading } data-test-id="godam-onboarding-button-resend">
				{ isLoading ? <Spinner /> : null } { isLoading ? __( 'Resending…', 'godam' ) : __( 'Resend email', 'godam' ) }
			</Button>
		</>
	);
};

export default VerifyEmailScreen;
