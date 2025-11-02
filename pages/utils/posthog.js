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

	if ( ! posthogKey || ! posthogHost ) {
		return posthog;
	}

	posthog.init( posthogKey, {
		api_host: posthogHost,
		defaults: '2025-05-24',
	} );

	return posthog;
};

const posthogInstance = initPostHog();

export default posthogInstance;
