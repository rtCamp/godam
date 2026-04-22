/**
 * GoDAM for Woo — Frontend entry point.
 *
 * Registers WooCommerceLayerManager into the GoDAM layer registry so
 * the main GoDAM player can use it when WooCommerce layers are present.
 */
import WooCommerceLayerManager from './managers/layers/wooCommerceLayerManager';

/**
 * Register the WooCommerce layer type via the GoDAM layer registry.
 *
 * This script loads as a dependency of the main player, so it executes BEFORE
 * the player initializes the registry. We push to a queue that the registry
 * drains when it is ready. If the registry is already available (e.g. the
 * script was loaded late), we register directly.
 */
const wooLayerConfig = {
	label: 'WooCommerce Layer',
	validator: ( layer, dependencies ) =>
		!! dependencies?.woocommerce &&
		!! window.godamAPIKeyData?.validApiKey,
	manager: WooCommerceLayerManager,
};

if ( window.godamLayerRegistry ) {
	window.godamLayerRegistry.registerLayerType( 'woo', wooLayerConfig );
} else {
	window.godamLayerRegistryQueue = window.godamLayerRegistryQueue || [];
	window.godamLayerRegistryQueue.push( { id: 'woo', config: wooLayerConfig } );
}
