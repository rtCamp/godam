/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { Button, ExternalLink } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import { useDispatch } from 'react-redux';

/**
 * Internal dependencies
 */
import BrandLogo from '../BrandLogo';
import { goToStep, setNotice } from '../../redux/slice/onboarding';
import { config, STEPS, SUPPORT_URL } from '../../utils/constants';

/**
 * Ask GoDAM Central again whether the stored key is live (Settings → Refresh status).
 *
 * @return {Promise<boolean>} True once the key is valid again.
 */
export const checkConnectionAgain = async () => {
	const response = await window.fetch( `${ config.restUrl || '/wp-json/' }godam/v1/settings/refresh-api-key-status`, {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'X-WP-Nonce': config.nonce || window.wpApiSettings?.nonce || '' },
	} );
	const body = await response.json();

	return !! body?.valid_api_key;
};

/**
 * Renewal screen for a site whose GoDAM plan lapsed (#101).
 *
 * Before this, an expired trial or plan landed on the signup screens, as if the site
 * had never connected. Renewing keeps the same key, so once it's done "Check again"
 * picks it up without signing in.
 */
const RenewScreen = () => {
	const dispatch = useDispatch();
	const [ isChecking, setIsChecking ] = useState( false );

	const handleCheck = async () => {
		setIsChecking( true );

		try {
			if ( await checkConnectionAgain() ) {
				window.location.reload();
				return;
			}

			dispatch( setNotice( { status: 'warning', message: __( 'Your plan still shows as expired. If you just renewed, wait a minute and check again.', 'godam' ) } ) );
		} catch ( error ) {
			dispatch( setNotice( { status: 'error', message: __( 'Couldn\'t reach GoDAM. Try again in a moment.', 'godam' ) } ) );
		}

		setIsChecking( false );
	};

	return (
		<div className="godam-onboarding__center">
			<BrandLogo markOnly />
			<h1 className="godam-onboarding__title godam-onboarding__title--lg">{ __( 'Your GoDAM plan has expired', 'godam' ) }</h1>
			<p className="godam-onboarding__subtitle">
				{ __( 'Transcoding and other Pro features are paused until you renew.', 'godam' ) }
			</p>

			<Button
				variant="primary"
				className="godam-onb-btn godam-onb-btn--primary godam-onboarding__cta"
				href={ config.renewalUrl || 'https://app.godam.io/web/billing?tab=Plans' }
				target="_blank"
				rel="noopener noreferrer"
				data-test-id="godam-onboarding-button-renew"
			>
				{ __( 'Renew plan', 'godam' ) }
			</Button>

			<Button
				variant="secondary"
				className="godam-onb-btn godam-onboarding__cta"
				onClick={ handleCheck }
				disabled={ isChecking }
				isBusy={ isChecking }
				data-test-id="godam-onboarding-button-check-renewal"
			>
				{ isChecking ? __( 'Checking…', 'godam' ) : __( 'I\'ve renewed, check again', 'godam' ) }
			</Button>

			<p className="godam-onboarding__alt">
				{ __( 'Have a different license key?', 'godam' ) }{ ' ' }
				<button type="button" className="godam-onboarding__link" onClick={ () => dispatch( goToStep( STEPS.LICENSE ) ) } data-test-id="godam-onboarding-link-other-key">{ __( 'Use it instead', 'godam' ) }</button>
			</p>
			<p className="godam-onboarding__alt">
				<ExternalLink href={ SUPPORT_URL }>{ __( 'Contact support', 'godam' ) }</ExternalLink>
			</p>
		</div>
	);
};

export default RenewScreen;
