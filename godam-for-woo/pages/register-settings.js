/**
 * Internal dependencies
 */
import WooCommerceSettings from './components/settings/WooCommerceSettings.jsx';

// Expose WooCommerce settings component globally for the GoDAM Integrations Settings page.
if ( ! window.godamIntegrationComponents ) {
	window.godamIntegrationComponents = {};
}

window.godamIntegrationComponents.WooCommerceSettings = WooCommerceSettings;
