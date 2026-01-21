/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';

/**
 * Internal dependencies
 */
import WoocommerceLayer from './components/WoocommerceLayer';

// Register WooCommerce layer option in the layer selector
import './register-layer-option';

/**
 * Register WooCommerce layer component with the video editor.
 *
 * This filter allows the WooCommerce integration to register its layer type
 * without the core video editor having a direct dependency on it.
 *
 * @param {Object} components - Existing layer components.
 * @return {Object} Updated layer components including WooCommerce layer.
 */
const registerWoocommerceLayer = ( components ) => {
	return {
		...components,
		woo: {
			component: WoocommerceLayer,
		},
	};
};

addFilter(
	'godam.videoEditor.layerComponents',
	'godam/woocommerce/register-layer',
	registerWoocommerceLayer,
);
