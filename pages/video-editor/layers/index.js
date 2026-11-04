/**
 * Register every layer type the editor knows: GoDAM's own, its form providers
 * (Form layer variations), then the types add-ons described through the old
 * hooks. Add-ons on the Layer API register themselves through
 * `window.godam.layers.registerLayerType()` and `registerLayerVariation()`.
 */

/**
 * Internal dependencies
 */
import { registerCoreLayerTypes } from '../../../assets/src/layers';
import { registerCoreFormProviders } from '../../../assets/src/layers/form/providers';
import { registerLegacyLayerTypes } from './legacy';

export function registerEditorLayerTypes() {
	registerCoreLayerTypes();
	registerCoreFormProviders();
	registerLegacyLayerTypes();
}
