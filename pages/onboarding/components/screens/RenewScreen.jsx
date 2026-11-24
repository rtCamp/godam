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
 * The refresh route answers 200 even when it couldn't reach Central: it says so with
 * `api_key_status: verification_failed`. A failed request (an expired nonce, a server
 * error) isn't an answer about the plan either.
 *
 * @return {Promise<{ok: boolean, valid: boolean, status: string}>} Whether the request worked, whether the key is valid again, and its status.
 */
export const checkConnectionAgain = async () => {
	const response = await window.fetch( `${ config.restUrl || '/wp-json/' }godam/v1/settings/refresh-api-key-status`, {
		method: 'POST',
		credentials: 'same-origin',
		headers: { 'X-WP-Nonce': config.nonce || window.wpApiSettings?.nonce || '' },
	} );
	const body = await response.json().catch( () => ( {} ) );

	return {
		ok: !! response.ok,
		valid: !! body?.valid_api_key,
		status: String( body?.api_key_status || '' ),
	};
};

/**
 * Whether a check couldn't get an answer about the plan.
 *
 * @param {{ok: boolean, status: string}} result What checkConnectionAgain() returned.
 *
 * @return {boolean} True when GoDAM couldn't be reached or the request failed.
 */
export const isUnanswered = ( result ) => ! result.ok || 'verification_failed' === result.status;

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

		const unreachable = { status: 'error', message: __( 'Couldn\'t reach GoDAM. Try again in a moment.', 'godam' ) };

		try {
			const result = await checkConnectionAgain();

			if ( result.ok && result.valid ) {
				window.location.reload();
				return;
			}

			dispatch( setNotice( isUnanswered( result )
				? unreachable
				: { status: 'warning', message: __( 'Your plan still shows as expired. If you just renewed, wait a minute and check again.', 'godam' ) } ) );
		} catch ( error ) {
			dispatch( setNotice( unreachable ) );
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
