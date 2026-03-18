/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { API_KEY_STATUS } from '../../shared/enums';

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
export const hasValidAPIKey = apiKeyStatus === API_KEY_STATUS.VALID;

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
	// NO_API_KEY is the explicit "no key entered" state. Also guard against the
	// legacy case where the status was never persisted and still reads 'valid'
	// but no physical key exists (hasAPIKey catches that).
	if ( ! hasAPIKey || apiKeyStatus === API_KEY_STATUS.NO_API_KEY ) {
		return {
			type: 'missing_key',
			title: null, // Use default "Upgrade" message
			message: null,
			showRefresh: false,
		};
	}

	if ( hasValidAPIKey ) {
		return null;
	}

	// Has key but it's not valid
	if ( apiKeyStatus === API_KEY_STATUS.EXPIRED ) {
		return {
			type: API_KEY_STATUS.EXPIRED,
			title: __( 'Your API key has expired.', 'godam' ),
			message: __( 'Please renew your subscription from your Account to continue.', 'godam' ),
			showRefresh: true,
		};
	}

	if ( apiKeyStatus === API_KEY_STATUS.VERIFICATION_FAILED ) {
		return {
			type: API_KEY_STATUS.VERIFICATION_FAILED,
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

/**
 * Detect if the browser is Safari
 *
 * @return {boolean} True if the browser is Safari, false otherwise
 */
export const isSafari = () => {
	if ( typeof window === 'undefined' ) {
		return false;
	}

	const userAgent = window.navigator.userAgent;

	// Check for Safari but exclude Chrome and other Chromium-based browsers
	// Safari's user agent contains "Safari" but not "Chrome"
	const isSafariBrowser = /Safari/.test( userAgent ) && ! /(Chrome|Chromium|Edg|CriOS|FxiOS|OPR)/.test( userAgent );

	return isSafariBrowser;
};
