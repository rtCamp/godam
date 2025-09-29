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
