/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { Button, TextControl, CheckboxControl, ExternalLink } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';

/**
 * Internal dependencies
 */
import { useVerifyLicenseKeyMutation } from '../../redux/api/onboarding';
import { goToStep, setConnected, setNotice } from '../../redux/slice/onboarding';
import { STEPS } from '../../utils/constants';
import { isValidLicenseKey } from '../../utils/validators';

/**
 * O5 — "Activate with license key" (reuses the existing verify_api_key flow;
 * not a JWT login). On success the plugin connects directly.
 */
const LicenseKeyScreen = () => {
	const dispatch = useDispatch();
	const [ verifyLicenseKey, { isLoading } ] = useVerifyLicenseKeyMutation();
	const [ key, setKey ] = useState( '' );
	const [ remember, setRemember ] = useState( true );

	const handleSubmit = async () => {
		if ( ! isValidLicenseKey( key ) ) {
			dispatch( setNotice( { status: 'error', message: __( 'Enter a valid license key (GODAM-XXXX-XXXX-XXXX).', 'godam' ) } ) );
			return;
		}
		try {
			await verifyLicenseKey( key.trim() ).unwrap();
			dispatch( setConnected() );
		} catch ( error ) {
			dispatch( setNotice( { status: 'error', message: error?.data?.message || __( 'That license key could not be verified.', 'godam' ) } ) );
		}
	};

	return (
		<>
			<button type="button" className="godam-onboarding__back" onClick={ () => dispatch( goToStep( STEPS.ENTRY ) ) } data-test-id="godam-onboarding-button-back">
				‹ { __( 'BACK', 'godam' ) }
			</button>
			<h1 className="godam-onboarding__title">{ __( 'Sign in with license key', 'godam' ) }</h1>

			<div className="godam-onboarding__form">
				<TextControl __nextHasNoMarginBottom label={ __( 'License key', 'godam' ) } placeholder="GODAM-XXXX-XXXX-XXXX" value={ key } onChange={ setKey } data-test-id="godam-onboarding-input-license" />
				<CheckboxControl __nextHasNoMarginBottom label={ __( 'Keep me signed in', 'godam' ) } checked={ remember } onChange={ setRemember } data-test-id="godam-onboarding-checkbox-remember" />
			</div>

			<Button variant="primary" className="godam-onb-btn godam-onb-btn--primary godam-onboarding__cta" onClick={ handleSubmit } disabled={ isLoading } isBusy={ isLoading } data-test-id="godam-onboarding-button-verify-license">
				{ isLoading ? __( 'Verifying…', 'godam' ) : __( 'Verify to Sign in', 'godam' ) }
			</Button>

			<p className="godam-onboarding__alt">
				<ExternalLink href="https://app.godam.io/">{ __( 'Lost your key? Find it on your GoDAM app', 'godam' ) }</ExternalLink>
			</p>
			<p className="godam-onboarding__alt">
				{ __( 'Login with email instead?', 'godam' ) }{ ' ' }
				<button type="button" className="godam-onboarding__link" onClick={ () => dispatch( goToStep( STEPS.LOGIN ) ) } data-test-id="godam-onboarding-link-login">{ __( 'Sign in', 'godam' ) }</button>
			</p>
		</>
	);
};

export default LicenseKeyScreen;
