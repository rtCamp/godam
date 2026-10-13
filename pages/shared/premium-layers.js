/**
 * WordPress dependencies
 */
import { addQueryArgs } from '@wordpress/url';

/**
 * Returns a GoDAM pricing URL with UTM parameters.
 *
 * @param {string} utmContent - The utm_content value identifying the feature/location.
 * @return {string} The full pricing URL with UTM query parameters.
 */
export const getPricingUrl = ( utmContent ) => {
	const baseUrl = window?.videoData?.godamBaseUrl || 'https://godam.io';

	return addQueryArgs( `${ baseUrl }/pricing`, {
		utm_campaign: 'upgrade',
		utm_source: window?.location?.host || '',
		utm_medium: 'plugin',
		utm_content: utmContent,
	} );
};
