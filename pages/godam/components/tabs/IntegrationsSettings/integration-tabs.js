/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Integration tab definitions.
 *
 * Each add-on that needs an Integrations Settings tab should have an entry here.
 * The `name` must match the key used in:
 * - `window.godamIntegrationComponents[ name ]` (extended settings component)
 * - `mediaSettings.integrations[ name ]` (saved settings object)
 *
 * @type {Array<Object>}
 */
const integrationTabs = [
	{
		name: 'woocommerce',
		pluginSlug: 'godam-for-woo/godam-for-woo.php',
		requiredPlugin: 'woocommerce/woocommerce.php',
		fdItemId: 'godam-for-woo',
		integrationLabel: __( 'WooCommerce', 'godam' ),
		addonLabel: __( 'GoDAM for Woo', 'godam' ),
		title: (
			<>
				{ __( 'WooCommerce', 'godam' ) }
				<span className="godam-pro-badge">
					{ __( 'Pro', 'godam' ) }
				</span>
			</>
		),
		className: 'godam-tab',
	},
	{
		// Marketo has no add-on plugin to install, so no `pluginSlug`/`fdItemId`:
		// `IntegrationsSettings` treats it as always-installed and renders the
		// fields from `window.godamIntegrationComponents.marketo`.
		name: 'marketo',
		integrationLabel: __( 'Marketo', 'godam' ),
		title: __( 'Marketo', 'godam' ),
		className: 'godam-tab',
	},
];

export default integrationTabs;
