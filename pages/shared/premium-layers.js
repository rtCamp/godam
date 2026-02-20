/**
 * Shared premium layer type constants.
 *
 * Single source of truth for which layer types require a Pro license.
 * Keep in sync with the PHP helper: rtgodam_get_premium_layer_types() in custom-functions.php.
 */

/**
 * Layer types that require a valid API key (Pro plan).
 * CTA and Hotspot are free. Forms, Ads, and Polls are premium.
 */
export const PREMIUM_LAYER_TYPES = [ 'form', 'ad', 'poll' ];

/**
 * GoDAM pricing page URL with UTM tracking.
 *
 * @param {string} utmContent - The UTM content parameter for tracking (e.g., 'layer-selector', 'sidebar').
 * @return {string} The full pricing URL with UTM params.
 */
export const getPricingUrl = ( utmContent = 'upgrade' ) => {
	const host = window?.location?.host || '';
	return `https://godam.io/pricing?utm_campaign=upgrade&utm_source=${ host }&utm_medium=plugin&utm_content=${ utmContent }`;
};
