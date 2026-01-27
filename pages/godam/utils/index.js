/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Scroll to the top of the page
 *
 * @return {void}
 */
export const scrollToTop = () => {
	window.scrollTo( { top: 0, behavior: 'smooth' } );
};

/**
 * Check if an API key exists (regardless of validity)
 */
export const hasAPIKey = !! ( window?.userData?.userApiData?.masked_api_key );

/**
 * API Key status
 */
export const apiKeyStatus = window?.userData?.apiKeyStatus;

/**
 * Check if the API key is valid
 */
export const hasValidAPIKey = apiKeyStatus === 'valid';

/**
 * Masked API key
 */
export const maskedAPIKey = window?.userData?.userApiData?.masked_api_key || '';

/**
 * Check if the user is on the Starter plan
 */
export const isOnStarterPlan = window?.userData?.userApiData?.active_plan === 'Starter';

/**
 * GODAM API base URL
 */
export const GODAM_API_BASE = window?.godamSettings?.apiBase || '';

/**
 * Get API key error info based on status.
 * Returns null if API key is valid, otherwise returns error details.
 *
 * @return {Object|null} Error object with title, message, and showRefresh properties, or null if valid.
 */
export const getAPIKeyErrorInfo = () => {
	if ( hasValidAPIKey ) {
		return null;
	}

	if ( ! hasAPIKey ) {
		return {
			type: 'missing_key',
			title: null, // Use default "Upgrade" message
			message: null,
			showRefresh: false,
		};
	}

	// Has key but it's not valid
	if ( apiKeyStatus === 'expired' ) {
		return {
			type: 'expired',
			title: __( 'Your API key has expired.', 'godam' ),
			message: __( 'Please renew your subscription from your Account to continue.', 'godam' ),
			showRefresh: true,
		};
	}

	if ( apiKeyStatus === 'verification_failed' ) {
		return {
			type: 'verification_failed',
			title: __( 'Unable to verify API key.', 'godam' ),
			message: __( 'This may be a temporary issue. Please try again later.', 'godam' ),
			showRefresh: true,
		};
	}

	// Default for unknown invalid states
	return {
		type: 'invalid',
		title: __( 'API key issue detected.', 'godam' ),
		message: __( 'Please check your API key settings.', 'godam' ),
		showRefresh: true,
	};
};
