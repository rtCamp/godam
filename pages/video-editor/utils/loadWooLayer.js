/**
 * Ensure WooCommerce layer component is registered into the video editor runtime.
 * It dynamically imports the Woo layer only when PHP exposes it via layerComponents.
 */
export const ensureWooLayerRegistered = async () => {
	const phpComponents = window.godamVideoEditorConfig?.layerComponents || {};
	const componentName = phpComponents.woo;

	if ( ! componentName ) {
		return; // Woo is not enabled via PHP filters.
	}

	// Avoid re-registering if already loaded.
	if ( window.godamLayerComponents?.[ componentName ] ) {
		return;
	}

	// Dynamically import the WooCommerce layer component from the integrations folder.
	const module = await import(
		/* webpackChunkName: "woo-layer-component" */
		'../../../integrations/woocommerce/pages/components/WoocommerceLayer'
	);

	window.godamLayerComponents = window.godamLayerComponents || {};
	window.godamLayerComponents[ componentName ] = module.default;
};
