/**
 * Internal dependencies
 */
import WoocommerceLayer from './components/WoocommerceLayer';

// Expose WooCommerce layer component globally for PHP-filtered registration
if ( ! window.godamLayerComponents ) {
	window.godamLayerComponents = {};
}

window.godamLayerComponents.WoocommerceLayer = WoocommerceLayer;
