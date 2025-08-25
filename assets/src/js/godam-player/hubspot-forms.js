/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';

const HUBSPOT_SCRIPT = 'https://js.hsforms.net/forms/v2.js';

let hubspotScriptLoaded = null;

/**
 * Fetches Hubspot forms by media id from the backend.
 *
 * @param {string} id The ID to filter the forms by.
 * @return {Promise<Array<object>>} A promise that resolves to an array of Hubspot form objects.
 */
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

/**
 * Creates and configures the HTML element for a Hubspot form.
 *
 * @param {HTMLElement} layerElement              The DOM element representing the layer.
 * @param {Object}      layer                     The layer data, containing Hubspot form information.
 * @param {string}      layer.hubspot_id          The ID of the Hubspot form.
 * @param {string}      [layer.backgroundColor]   The background color for the form container.
 * @param {number}      [layer.backgroundOpacity] The background opacity for the form container.
 */
export const createFormElement = ( layerElement, layer ) => {
	layerElement.classList.add( `godam-form-type-hubspot` );

	if ( layer.backgroundColor && layer.backgroundOpacity ) {
		const rgba = `rgba(${ parseInt( layer.backgroundColor.slice( 1, 3 ), 16 ) }, ${ parseInt( layer.backgroundColor.slice( 3, 5 ), 16 ) }, ${ parseInt( layer.backgroundColor.slice( 5, 7 ), 16 ) }, ${ layer.backgroundOpacity })`;
		layerElement.style.backgroundColor = rgba;
	}

	if ( ! layerElement.querySelector( '.hubspot-form' ) ) {
		const formElement = document.createElement( 'div' );
		formElement.classList.add( 'hubspot-form' );

		layerElement.appendChild( formElement );
	}

	let spinnerElement = layerElement.querySelector( '.hubspot-form-spinner' );
	if ( ! spinnerElement ) {
		spinnerElement = document.createElement( 'div' );
		spinnerElement.classList.add( 'hubspot-form-spinner' );
		layerElement.appendChild( spinnerElement );
	}
	spinnerElement.style.display = 'flex';

	loadHubspotForm( layerElement, layer.hubspot_id );
};

/**
 * Fetches the Hubspot portal ID from the API.
 *
 * @return {Promise<object>} A promise that resolves to an object containing the hubspot portal ID.
 */
const getPortalId = async () => {
	return apiFetch( { path: `/godam/v1/hubspot-portal-id` } );
};

/**
 * Loads the Hubspot script if it hasn't been loaded already.
 *
 * This function ensures that the Hubspot script is only loaded once.
 * It checks if the script is already loaded by looking for `window.hbspt`.
 * If not loaded, it creates a script element, appends it to the body,
 * and resolves the promise when the script is loaded or when `window.hbspt`
 * becomes available.
 *
 * @return {Promise<void>} A promise that resolves when the Hubspot script is loaded and ready.
 */
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

/**
 * Loads and renders a Hubspot form within a given container.
 *
 * This function first ensures the Hubspot script is loaded. It then fetches
 * the Hubspot portal ID and uses `window.hbspt.forms.create` to render the form.
 * It also sets up event listener for form submission.
 *
 * @param {HTMLElement} container The DOM element where the Hubspot form will be rendered.
 * @param {string}      formId    The ID of the Hubspot form to load.
 */
const loadHubspotForm = async ( container, formId ) => {
	const spinnerElement = container.querySelector( '.hubspot-form-spinner' );

	try {
		if ( spinnerElement ) {
			spinnerElement.style.display = 'flex';
		}
		await loadHubspotScript();

		if ( ! window.hbspt || ! window.hbspt.forms ) {
			return;
		}

		const containerId = container?.id;
		if ( ! containerId ) {
			return;
		}
		const { hubspotPortalId } = await getPortalId();

		window.hbspt.forms.create( {
			portalId: hubspotPortalId,
			formId,
			target: `#${ containerId } .hubspot-form`,
		} );

		/**
		 * Hides the spinner element when the form is ready.
		 */
		const handleFormReady = () => {
			if ( spinnerElement ) {
				spinnerElement.style.display = 'none';
			}
		};

		/**
		 * Handles the form submission success event.
		 * If the submitted form matches the target form, it makes the "Continue" button visible and updates its text.
		 *
		 * @param {CustomEvent} event The submission event details.
		 */
		const handleFormSubmission = ( event ) => {
			const { formId: eventFormId } = event.detail;
			if ( formId !== eventFormId ) {
				return;
			}

			const continueButton = container.querySelector( 'button' );
			if ( continueButton ) {
				continueButton.classList.remove( 'hidden' );
				continueButton.innerText = __( 'Continue', 'godam' );
			}
		};

		window.addEventListener(
			'hs-form-event:on-ready',
			handleFormReady,
		);

		window.addEventListener(
			'hs-form-event:on-submission:success',
			handleFormSubmission,
		);
	} catch ( error ) {}
};
