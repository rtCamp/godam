/**
 * Internal dependencies
 */
import { LAYER_TYPES, FORM_TYPES } from '../../utils/constants.js';

/**
 * Layer Validator
 * Handles layer dependency checking and validation
 */
export default class LayerValidator {
	/**
	 * Check if layer should be processed based on dependencies
	 *
	 * @param {Object} layer - Layer configuration object
	 * @return {boolean} True if layer should be processed
	 */
	static shouldProcessLayer( layer ) {
		const dependencies = window.godamPluginDependencies;

		const layerTypeChecks = {
			[ LAYER_TYPES.FORM ]: () => LayerValidator.checkFormDependency( layer.form_type, dependencies ),
			[ LAYER_TYPES.POLL ]: () => dependencies?.wpPolls,
			[ LAYER_TYPES.CTA ]: () => true,
			[ LAYER_TYPES.HOTSPOT ]: () => true,
			[ LAYER_TYPES.WOOCOMMERCE ]: () => dependencies?.woocommerce,
		};

		const checker = layerTypeChecks[ layer.type ];
		return checker ? checker() : true;
	}

	/**
	 * Check form dependency
	 *
	 * @param {string} formType     - Type of form to check
	 * @param {Array}  dependencies - Array of dependency objects
	 * @return {boolean} True if form dependency is satisfied
	 */
	static checkFormDependency( formType, dependencies ) {
		const formChecks = {
			[ FORM_TYPES.GRAVITY ]: dependencies?.gravityforms,
			[ FORM_TYPES.WPFORMS ]: dependencies?.wpforms,
			[ FORM_TYPES.EVEREST ]: dependencies?.everestForms,
			[ FORM_TYPES.CF7 ]: dependencies?.cf7,
			[ FORM_TYPES.JETPACK ]: dependencies?.jetpack,
			[ FORM_TYPES.SUREFORMS ]: dependencies?.sureforms,
			[ FORM_TYPES.FORMINATOR ]: dependencies?.forminator,
			[ FORM_TYPES.FLUENT ]: dependencies?.fluentForms,
			[ FORM_TYPES.NINJA ]: dependencies?.ninjaForms,
			[ FORM_TYPES.METFORM ]: dependencies?.metform,
		};

		return formChecks[ formType ] || false;
	}

	/**
	 * Check if layer is form, CTA, or poll
	 *
	 * @param {string} layerType - Type of layer to check
	 * @return {boolean} True if layer is form-based
	 */
	static isFormOrCTAOrPoll( layerType ) {
		return [ LAYER_TYPES.FORM, LAYER_TYPES.CTA, LAYER_TYPES.POLL ].includes( layerType );
	}
}
