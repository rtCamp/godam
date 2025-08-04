/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

export const getForms = ( id ) => {
	return apiFetch( { path: `/godam/v1/hubspot-forms?id=${ id }` } ).then( ( hubspotForms ) => {
		const hubspotLayers = hubspotForms?.layers?.map( ( form ) => {
			return {
				id: form.id,
				allow_skip: form.allowSkip,
				hubspot_id: form.formId,
				form_type: form.formProvider,
				displayTime: form.timestamp.toFixed( 2 ),
				backgroundColor: form.backgroundColor,
				backgroundOpacity: form.backgroundOpacity,
				type: 'form',
			};
		} );
		return hubspotLayers;
	} );
};

export const createFormElement = ( layerElement, layer ) => {
	layerElement.classList.add( `godam-form-type-hubspot` );

	if ( layer.backgroundColor && layer.backgroundOpacity ) {
		const rgba = `rgba(${ parseInt( layer.backgroundColor.slice( 1, 3 ), 16 ) }, ${ parseInt( layer.backgroundColor.slice( 3, 5 ), 16 ) }, ${ parseInt( layer.backgroundColor.slice( 5, 7 ), 16 ) }, ${ layer.backgroundOpacity })`;
		layerElement.style.backgroundColor = rgba;
	}
};
