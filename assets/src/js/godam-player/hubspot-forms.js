/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

const HUBSPOT_SCRIPT = 'https://js.hsforms.net/forms/v2.js';

let hubspotScriptLoaded = null;

export const getForms = async ( id ) => {
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

	loadHubspotForm( layerElement.id, layer.hubspot_id );
};

const getPortalId = async () => {
	return apiFetch( { path: `/godam/v1/hubspot-portal-id` } );
};

const loadHubspotScript = () => {
	if ( ! hubspotScriptLoaded ) {
		hubspotScriptLoaded = new Promise( ( resolve ) => {
			if ( window.hbspt ) {
				resolve(); // Script already loaded.
				return;
			}

			if ( document.querySelector( '#hubspot-script' ) ) {
				// Script tag exists but hbspt might not be ready. Wait for it.
				const checkHbspt = setInterval( () => {
					if ( window.hbspt ) {
						clearInterval( checkHbspt );
						resolve();
					}
				}, 100 );
				return;
			}

			const script = document.createElement( 'script' );
			script.src = HUBSPOT_SCRIPT;
			script.async = true;
			script.id = 'hubspot-script';
			script.onload = () => {
				resolve();
			};
			document.body.appendChild( script );
		} );
	}
	return hubspotScriptLoaded;
};

const loadHubspotForm = async ( containerId, formId ) => {
	try {
		await loadHubspotScript();

		if ( ! window.hbspt || ! window.hbspt.forms ) {
			return;
		}

		const { hubspotPortalId } = await getPortalId();

		window.hbspt.forms.create( {
			portalId: hubspotPortalId,
			formId,
			target: `#${ containerId }`,
		} );
	} catch ( error ) {}
};
