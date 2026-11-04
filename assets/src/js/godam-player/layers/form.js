/**
 * The Form layer's front-end runtime (#2294).
 *
 * Each form plugin is a variation selected by `layer.form_type` (see
 * `form-providers.js`). A provider says whether its plugin is active, how to
 * tell the form was sent, and its label in analytics. An add-on adds a
 * provider with `registerLayerRuntimeVariation( 'form', { … } )`.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import {
	registerLayerRuntime,
	getLayerRuntime,
	getLayerRuntimeVariation,
} from '../../godam-layers/runtime/registry.js';
import { mountOverlayLayer } from './overlay.js';
import { registerCoreFormProviders } from './form-providers.js';

/**
 * Whether a form layer's provider is registered and its plugin is active.
 *
 * @param {Object} layer          Saved layer.
 * @param {Object} [dependencies] Active plugins (`window.godamPluginDependencies`).
 * @return {boolean} True to show the layer.
 */
export function isFormProviderAvailable( layer, dependencies ) {
	const provider = getLayerRuntimeVariation( 'form', layer );
	if ( ! provider ) {
		return false;
	}
	return typeof provider.isAvailable !== 'function' || Boolean( provider.isAvailable( dependencies ) );
}

/**
 * Watch a form layer for its provider's "sent" (or "couldn't load") state.
 *
 * @param {Object} provider The layer's form provider.
 * @return {Function} `watchOutcome( element )` for `FormLayerManager`.
 */
function watchFormOutcome( provider ) {
	return ( element ) => () => {
		const submitted = Boolean( provider?.isSubmitted?.( element ) );
		// A form that could not load lets the viewer continue, even with skip
		// turned off, but records no submission.
		const unavailable = Boolean( provider?.isUnavailable?.( element ) );
		return submitted || unavailable ? { converted: submitted } : null;
	};
}

/**
 * Register the Form runtime and the core form providers, unless something already did.
 */
export function registerFormRuntime() {
	if ( ! getLayerRuntime( 'form' ) ) {
		registerLayerRuntime( 'form', {
			title: 'Form',
			variationAttribute: 'form_type',
			validate: ( layer, { dependencies } ) => isFormProviderAvailable( layer, dependencies ),
			mount: mountOverlayLayer( ( ctx ) => {
				const provider = getLayerRuntimeVariation( 'form', ctx.layer );
				provider?.onMount?.( ctx );
				return {
					skipText: () => __( 'Skip Form', 'godam' ),
					watchOutcome: watchFormOutcome( provider ),
					conversionAction: 'submitted',
					analyticsLabel: () => provider?.title,
					analyticsMetadata: ( layer ) => ( { form_type: layer.form_type } ),
				};
			} ),
		} );
	}
	registerCoreFormProviders();
}
