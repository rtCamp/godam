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
		integrationLabel: __( 'WooCommerce', 'godam' ),
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
];

export default integrationTabs;
