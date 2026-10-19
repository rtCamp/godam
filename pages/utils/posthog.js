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
	const posthogEnabled = posthogConfig.enabled === '1' || posthogConfig.enabled === 1; // Only enable when explicitly opted in; never default to enabled.

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
	}

	return posthog;
};

const posthogInstance = initPostHog();

export default posthogInstance;
