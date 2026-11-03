/**
 * Register every layer type the editor knows: GoDAM's own, then those add-ons
 * described through the old hooks. Add-ons on the Layer API register
 * themselves through `window.godam.layers.registerLayerType()`.
 */

/**
 * Internal dependencies
 */
import { registerCoreLayerTypes } from './core';
import { registerLegacyLayerTypes } from './legacy';

export function registerEditorLayerTypes() {
	registerCoreLayerTypes();
	registerLegacyLayerTypes();
}
