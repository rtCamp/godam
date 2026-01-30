/**
 * Scroll to the top of the page
 *
 * @return {void}
 */
export const scrollToTop = () => {
	window.scrollTo( { top: 0, behavior: 'smooth' } );
};

/**
 * Check if the API key is valid
 */
export const hasValidAPIKey = window?.userData?.validApiKey || false;

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
