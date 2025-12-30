/**
 * External dependencies
 */
import posthog from 'posthog-js';

/**
 * Initialize PostHog analytics
 *
 * @return {Object} PostHog instance
 */
const initPostHog = () => {
	const posthogConfig = window.posthogConfig || {};

	const posthogKey = posthogConfig.key || '';
	const posthogHost = posthogConfig.host || '';
	const posthogEnabled = posthogConfig.enabled !== '0'; // Enable by default, disable on 0, "0", or false

	if ( ! posthogEnabled ) {
		return posthog;
	}

	if ( ! posthogKey || ! posthogHost ) {
		return posthog;
	}

	posthog.init( posthogKey, {
		api_host: posthogHost,
		defaults: '2025-05-24',
	} );

	if ( posthogConfig.properties ) {
		posthog.register( posthogConfig.properties );
		if ( posthogConfig.properties.user_email ) {
			posthog.identify( posthogConfig.properties.user_email, {
				email: posthogConfig.properties.user_email,
				name: posthogConfig.properties.user_name,
			} );
		}
	}

	return posthog;
};

const posthogInstance = initPostHog();

export default posthogInstance;
