/**
 * External dependencies
 */

/**
 * Internal dependencies
 */
import { FormLayerComponentType } from '../components/layers/FormLayer';

/**
 * Helper function to get form ID from layer data
 *
 * @param {Object} layer    - The layer object
 * @param {string} formType - The form type
 * @return {string|null} - The form ID or null if not found
 */
export const getFormIdFromLayer = ( layer, formType ) => {
	const config = FormLayerComponentType[ formType ];
	if ( ! config || ! config.idField ) {
		return null;
	}
	return layer[ config.idField ] || null;
};

/**
 * Helper function to build settings URL for a form
 *
 * @param {string} formType - The form type
 * @param {string} formId   - The form ID
 * @return {string} - The complete settings URL
 */
export const buildSettingsUrl = ( formType, formId ) => {
	const config = FormLayerComponentType[ formType ];
	if ( ! config ) {
		return '#';
	}

	const adminUrl = window?.videoData?.adminUrl || '';
	let url = config.settingsUrl;

	// Special handling for Jetpack forms
	if ( formType === 'jetpack' && config.getFormId ) {
		const postId = config.getFormId( formId );
		if ( postId ) {
			url = `post.php?post=${ postId }&action=edit`;
		}
	} else {
		url = url.replace( '{formId}', formId );
	}

	return `${ adminUrl }${ url }`;
};
