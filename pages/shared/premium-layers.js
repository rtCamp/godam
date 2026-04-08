/**
 * WordPress dependencies
 */
import { addQueryArgs } from '@wordpress/url';

/**
 * Returns a pricing URL with UTM parameters for the given content identifier.
 *
 * @param {string} utmContent - The utm_content value identifying the upgrade context.
 * @return {string} The full pricing URL with UTM parameters.
 */
export const getPricingUrl = ( utmContent ) => {
	return addQueryArgs( 'https://godam.io/pricing', {
		utm_campaign: 'buy-plan',
		utm_source: window?.location?.host || '',
		utm_medium: 'plugin',
		utm_content: utmContent,
	} );
};
