/**
 * External dependencies
 */
import { getLayerVariationByName } from '@godam/layers';

/**
 * The form ID a form layer holds, read from its provider's `idField`.
 *
 * @param {Object} layer    - The layer object
 * @param {string} formType - The layer's `form_type` (its form provider)
 * @return {string|null} - The form ID or null if not found
 */
export const getFormIdFromLayer = ( layer, formType ) => {
	const idField = getLayerVariationByName( 'form', formType )?.idField;
	if ( ! idField ) {
		return null;
	}
	return layer?.[ idField ] || null;
};

/**
 * The admin URL of a form's settings, from its provider's `settingsUrl`: an
 * admin path with `{formId}`, or a function of the form ID. A full URL is used
 * as it is; anything else is relative to wp-admin.
 *
 * @param {string} formType - The layer's `form_type` (its form provider)
 * @param {string} formId   - The form ID
 * @return {string} - The complete settings URL
 */
export const buildSettingsUrl = ( formType, formId ) => {
	const provider = getLayerVariationByName( 'form', formType );
	if ( ! provider ) {
		return '#';
	}

	const { settingsUrl = '' } = provider;
	const path = typeof settingsUrl === 'function'
		? settingsUrl( formId )
		: String( settingsUrl ).replace( '{formId}', formId );

	return /^https?:\/\//.test( path ) ? path : `${ window?.videoData?.adminUrl || '' }${ path }`;
};
