/**
 * GoDAM Layer API: the layer type registry (#2292).
 *
 * Built as the `godam-layers` script and exposed as `window.godam.layers`.
 * GoDAM's own bundles import it as `@godam/layers` (a webpack external), and
 * add-ons do the same with their script depending on `godam-layers`.
 */

/**
 * Internal dependencies
 */
import { store } from './store';
import {
	registerLayerType,
	unregisterLayerType,
	getLayerType,
	getLayerTypes,
	__unstableRegisterLegacyLayerType,
} from './registration';
import {
	getDefaultAttributes,
	getLayerVariation,
	getDefaultVariation,
	isVariationAvailable,
	getAvailability,
	supportsMedia,
} from './utils';
import { CORE_LAYER_TYPES, STORE_NAME } from './constants';

export {
	store,
	STORE_NAME,
	CORE_LAYER_TYPES,
	registerLayerType,
	unregisterLayerType,
	getLayerType,
	getLayerTypes,
	getDefaultAttributes,
	getLayerVariation,
	getDefaultVariation,
	isVariationAvailable,
	getAvailability,
	supportsMedia,
	__unstableRegisterLegacyLayerType,
};

if ( typeof window !== 'undefined' ) {
	window.godam = window.godam || {};
	window.godam.layers = {
		store,
		STORE_NAME,
		CORE_LAYER_TYPES,
		registerLayerType,
		unregisterLayerType,
		getLayerType,
		getLayerTypes,
		getDefaultAttributes,
		getLayerVariation,
		getDefaultVariation,
		isVariationAvailable,
		getAvailability,
		supportsMedia,
		__unstableRegisterLegacyLayerType,
	};
}
