/**
 * External dependencies
 */

/**
 * Internal dependencies
 */
import GravityForm from '../components/forms/GravityForm';
import WPForm from '../components/forms/WPForm';
import EverestForm from '../components/forms/EverestForm';
import CF7 from '../components/forms/CF7';
import JetpackForm from '../components/forms/JetpackForm';
import SureForm from '../components/forms/Sureform.js';
import FluentForm from '../components/forms/FluentForm.js';
import ForminatorForm from '../components/forms/forminatorForms.js';

/**
 * FormLayer Components Object mapping.
 */
export const FormLayerComponentType = {
	gravity: {
		isActive: Boolean( window?.videoData?.gfActive ) ?? false,
		component: GravityForm,
		idField: 'gf_id',
		settingsUrl: 'admin.php?subview=confirmation&page=gf_edit_forms&id={formId}&view=settings',
	},
	cf7: {
		isActive: Boolean( window?.videoData?.cf7Active ) ?? false,
		component: CF7,
		idField: 'cf7_id',
		settingsUrl: 'admin.php?page=wpcf7&post={formId}&action=edit',
	},
	jetpack: {
		isActive: Boolean( window?.videoData?.jetpackActive ) ?? false,
		component: JetpackForm,
		idField: 'jp_id',
		settingsUrl: 'admin.php?page=jetpack-forms-admin#/responses',
		// Special handling for Jetpack forms (extract post ID from form ID)
		getFormId: ( formId ) => {
			if ( ! formId ) {
				return null;
			}
			const parts = formId.split( '-' );
			return parts[ 0 ] ? parseInt( parts[ 0 ] ) : null;
		},
	},
	wpforms: {
		isActive: Boolean( window?.videoData?.wpformsActive ) ?? false,
		component: WPForm,
		idField: 'wpform_id',
		settingsUrl: 'admin.php?page=wpforms-builder&view=settings&form_id={formId}&section=general',
	},
	sureforms: {
		isActive: Boolean( window?.videoData?.sureformsActive ) ?? false,
		component: SureForm,
		idField: 'sureform_id',
		settingsUrl: 'post.php?post={formId}&action=edit',
	},
	forminator: {
		isActive: Boolean( window?.videoData?.forminatorActive ) ?? false,
		component: ForminatorForm,
		idField: 'forminator_id',
		settingsUrl: 'admin.php?page=forminator-cform-wizard&id={formId}',
	},
	fluentforms: {
		isActive: Boolean( window?.videoData?.fluentformsActive ) ?? false,
		component: FluentForm,
		idField: 'fluent_form_id',
		settingsUrl: 'admin.php?page=fluent_forms&form_id={formId}&route=settings&sub_route=form_settings',
	},
	everestforms: {
		isActive: Boolean( window?.videoData?.everestFormsActive ) ?? false,
		component: EverestForm,
		idField: 'everest_form_id',
		settingsUrl: 'admin.php?page=evf-builder&view=fields&form_id={formId}&tab=settings',
	},
};

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
