/**
 * Layer Registry Global Initialization
 * Exposes the layer registry API to window.godamLayerRegistry for add-ons
 * This file should be imported early in the godam-player build
 */

/**
 * Internal dependencies
 */
import {
	registerLayerType,
	getLayerTypes,
	getLayerValidator,
	getLayerManager,
	isLayerTypeRegistered,
	addLayerRegistryHook,
	getAllRegisteredLayerTypes,
} from './layer-registry.js';

/**
 * Initialize the global layer registry API for add-ons.
 *
 * Add-on scripts that load before the main player can push registrations to
 * window.godamLayerRegistryQueue. This function drains that queue once the
 * registry is ready.
 */
function initializeLayerRegistry() {
	if ( typeof window !== 'undefined' && ! window.godamLayerRegistry ) {
		window.godamLayerRegistry = {
			registerLayerType,
			getLayerTypes,
			getLayerValidator,
			getLayerManager,
			isLayerTypeRegistered,
			addLayerRegistryHook,
			getAllRegisteredLayerTypes,
		};

		// Process any registrations queued before the registry was ready.
		if ( Array.isArray( window.godamLayerRegistryQueue ) ) {
			window.godamLayerRegistryQueue.forEach( ( { id, config } ) => {
				registerLayerType( id, config );
			} );
			delete window.godamLayerRegistryQueue;
		}
	}
}

// Initialize immediately
initializeLayerRegistry();

export { initializeLayerRegistry };
