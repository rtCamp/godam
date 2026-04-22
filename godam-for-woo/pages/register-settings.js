/**
 * Internal dependencies
 */
import WooCommerceSettings from './components/settings/WooCommerceSettings.jsx';

// Expose WooCommerce extended settings component globally.
// The key MUST match the integration tab name used in IntegrationsSettings.
if ( ! window.godamIntegrationComponents ) {
	window.godamIntegrationComponents = {};
}

window.godamIntegrationComponents.woocommerce = WooCommerceSettings;
