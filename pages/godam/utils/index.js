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
export const hasValidAPIKey = window?.userData?.valid_api_key || false;

/**
 * Masked API key
 */
export const maskedAPIKey = window?.userData?.user_data?.masked_api_key || '';

/**
 * Check if the user is on the Starter plan
 */
export const isOnStarterPlan = window?.userData?.user_data?.active_plan === 'Starter';

/**
 * GODAM API base URL
 */
export const GODAM_API_BASE = 'https://godam.io';
