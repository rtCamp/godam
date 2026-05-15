/**
 * Ensure all add-on layer components are registered into the video editor runtime.
 * Add-on layer components are loaded via PHP filters (godamVideoEditorConfig.layerComponents)
 * and their actual React components are registered to window.godamLayerComponents by add-on scripts.
 */
export const ensureAddonLayersRegistered = async () => {
	const phpComponents = window.godamVideoEditorConfig?.layerComponents || {};
	const loadedComponents = window.godamLayerComponents || {};

	Object.entries( phpComponents ).forEach( ( [ layerType, componentName ] ) => {
		if ( ! loadedComponents[ componentName ] ) {
			// eslint-disable-next-line no-console
			console.warn(
				`GoDAM: Layer component "${ componentName }" for type "${ layerType }" not found. Ensure the relevant add-on is active.`
			);
		}
	} );
};
