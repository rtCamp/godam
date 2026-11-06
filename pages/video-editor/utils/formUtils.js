/**
 * External dependencies
 */
import { getLayerVariationByName } from '@godam/layers';

/**
 * The layer key a form provider saves the chosen form's ID under: its
 * `idField`, else `form_id`. Shared by the settings panel and the save check,
 * so they always read and write the same key.
 *
 * @param {Object} provider - A form provider (Form layer variation)
 * @return {string} The layer key.
 */
export const getFormIdField = ( provider ) => provider?.idField || 'form_id';

/**
 * The form ID a form layer holds, read from its provider's `idField` (default `form_id`).
 *
 * @param {Object} layer    - The layer object
 * @param {string} formType - The layer's `form_type` (its form provider)
 * @return {string|null} - The form ID or null if not found
 */
export const getFormIdFromLayer = ( layer, formType ) => {
	const provider = getLayerVariationByName( 'form', formType );
	if ( ! provider ) {
		return null;
	}
	return layer?.[ getFormIdField( provider ) ] || null;
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
