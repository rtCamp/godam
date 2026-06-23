/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { Button, TextControl, CheckboxControl, Spinner, ExternalLink } from '@wordpress/components';
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
 * O5 — "Activate with license key". This is NOT a JWT login; it reuses the
 * existing `verify_api_key` flow (validates the key + registers the site), so
 * on success the plugin is connected directly.
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
			dispatch( setConnected( key.trim() ) );
		} catch ( error ) {
			dispatch( setNotice( { status: 'error', message: error?.data?.message || __( 'That license key could not be verified.', 'godam' ) } ) );
		}
	};

	return (
		<div className="godam-onboarding__form">
			<h1 className="godam-onboarding__title">{ __( 'Sign in with license key', 'godam' ) }</h1>

			<TextControl __nextHasNoMarginBottom label={ __( 'License key', 'godam' ) } placeholder="GODAM-XXXX-XXXX-XXXX" value={ key } onChange={ setKey } data-test-id="godam-onboarding-input-license" />
			<CheckboxControl __nextHasNoMarginBottom label={ __( 'Keep me signed in', 'godam' ) } checked={ remember } onChange={ setRemember } data-test-id="godam-onboarding-checkbox-remember" />

			<Button variant="primary" className="godam-onboarding__cta" onClick={ handleSubmit } disabled={ isLoading } isBusy={ isLoading } icon={ isLoading && <Spinner /> } data-test-id="godam-onboarding-button-verify-license">
				{ isLoading ? __( 'Verifying…', 'godam' ) : __( 'Verify to sign in', 'godam' ) }
			</Button>

			<p className="godam-onboarding__alt">
				<ExternalLink href="https://app.godam.io/">{ __( 'Lost your key? Find it on your GoDAM app', 'godam' ) }</ExternalLink>
			</p>
			<p className="godam-onboarding__alt">
				{ __( 'Login with email instead?', 'godam' ) }{ ' ' }
				<Button variant="link" onClick={ () => dispatch( goToStep( STEPS.LOGIN ) ) } data-test-id="godam-onboarding-link-login">{ __( 'Sign in', 'godam' ) }</Button>
			</p>
		</div>
	);
};

export default LicenseKeyScreen;
