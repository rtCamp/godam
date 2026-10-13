/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { Button, TextControl, ExternalLink } from '@wordpress/components';
import { seen, unseen } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';

/**
 * Internal dependencies
 */
import BackButton from '../BackButton';
import { useVerifyLicenseKeyMutation } from '../../redux/api/onboarding';
import { goToStep, setConnected, setNotice } from '../../redux/slice/onboarding';
import { config, STEPS } from '../../utils/constants';

/**
 * O5 — "Activate with license key" (reuses the existing verify_api_key flow;
 * not a JWT login). Mirrors Settings → API key: a maskable field with no
 * client-side format check — godam-core is the authority. On success the plugin
 * connects directly.
 */
const LicenseKeyScreen = () => {
	const dispatch = useDispatch();
	const [ verifyLicenseKey, { isLoading } ] = useVerifyLicenseKeyMutation();
	const [ key, setKey ] = useState( '' );
	const [ showKey, setShowKey ] = useState( false );

	const handleSubmit = async () => {
		if ( ! key.trim() ) {
			dispatch( setNotice( { status: 'error', message: __( 'Please enter your license key.', 'godam' ) } ) );
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
			<BackButton onClick={ () => dispatch( goToStep( STEPS.ENTRY ) ) } />
			<h1 className="godam-onboarding__title">{ __( 'Sign in with license key', 'godam' ) }</h1>

			<div className="godam-onboarding__form">
				<div className="godam-onboarding__pw">
					<TextControl
						__nextHasNoMarginBottom
						type={ showKey ? 'text' : 'password' }
						label={ __( 'License key', 'godam' ) }
						placeholder={ __( 'Enter your license key', 'godam' ) }
						value={ key }
						onChange={ setKey }
						data-test-id="godam-onboarding-input-license"
					/>
					<Button
						icon={ showKey ? seen : unseen }
						onClick={ () => setShowKey( ! showKey ) }
						className="godam-onboarding__pw-toggle"
						aria-label={ showKey ? __( 'Hide license key', 'godam' ) : __( 'Show license key', 'godam' ) }
						data-test-id="godam-onboarding-button-toggle-license"
					/>
				</div>
			</div>

			<Button variant="primary" className="godam-onb-btn godam-onb-btn--primary godam-onboarding__cta" onClick={ handleSubmit } disabled={ isLoading } isBusy={ isLoading } data-test-id="godam-onboarding-button-verify-license">
				{ isLoading ? __( 'Verifying…', 'godam' ) : __( 'Verify to Sign in', 'godam' ) }
			</Button>

			<p className="godam-onboarding__alt">
				<ExternalLink href={ `${ config.appOrigin || 'https://app.godam.io' }/web/billing?tab=API` }>{ __( 'Lost your key? Find it on your GoDAM app', 'godam' ) }</ExternalLink>
			</p>
			<p className="godam-onboarding__alt">
				{ __( 'Login with email instead?', 'godam' ) }{ ' ' }
				<button type="button" className="godam-onboarding__link" onClick={ () => dispatch( goToStep( STEPS.LOGIN ) ) } data-test-id="godam-onboarding-link-login">{ __( 'Sign in', 'godam' ) }</button>
			</p>
		</>
	);
};

export default LicenseKeyScreen;
