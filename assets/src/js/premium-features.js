/**
 * Premium feature helpers.
 *
 * The authoritative list of premium feature slugs lives exclusively in PHP:
 *   rtgodam_get_premium_features() — inc/helpers/custom-functions.php
 *
 * That array is localized into window.pluginInfo.premiumFeatures via
 * wp_localize_script() in class-assets.php, so no slug is ever duplicated here.
 */

/**
 * Whether a specific plugin feature requires a Pro license.
 * Reads the feature list from the server-localized window.pluginInfo object.
 *
 * @param {string} feature Feature slug (e.g. 'seo').
 * @return {boolean} True if the feature is gated behind a Pro license.
 */
export const isFeaturePremium = ( feature ) => {
	const premiumFeatures = window?.pluginInfo?.premiumFeatures ?? [];
	return premiumFeatures.includes( feature );
};
