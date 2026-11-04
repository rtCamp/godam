/**
 * The form plugins GoDAM supports, as variations of the Form runtime (#2294).
 *
 * The editor registers the same providers (`pages/video-editor/layers/
 * form-providers.js`) with their settings panels; this is their front-end part.
 * Each provider has a `title` (its analytics label, a brand name, not
 * translated), `isAvailable( dependencies )` (is the plugin active, read from
 * `window.godamPluginDependencies`) and `isSubmitted( element )` (does the layer
 * show the plugin's confirmation, so the skip button becomes "Continue" and
 * `submitted` fires). Optional: `isUnavailable( element )` (the form could not
 * load: the viewer may continue, nothing is recorded) and `onMount( ctx )`.
 */

/**
 * Internal dependencies
 */
import { registerLayerRuntimeVariation, getLayerRuntime } from '../../godam-layers/runtime/registry.js';

/**
 * `isSubmitted()` for a provider whose confirmation matches a selector.
 *
 * @param {...string} selectors CSS selectors.
 * @return {Function} The check.
 */
const showsAny = ( ...selectors ) => ( element ) => selectors.some( ( selector ) => element.querySelector( selector ) );

/**
 * `isSubmitted()` for a provider whose response node is always there but only filled in on success.
 *
 * @param {string} selector CSS selector.
 * @param {string} property `innerHTML` or `textContent`.
 * @return {Function} The check.
 */
const fills = ( selector, property ) => ( element ) => {
	const node = element.querySelector( selector );
	return Boolean( node ) && node[ property ] !== '';
};

/**
 * `isAvailable()` reading one key of `window.godamPluginDependencies`.
 *
 * @param {string} key Dependency key.
 * @return {Function} The check.
 */
const active = ( key ) => ( dependencies ) => Boolean( dependencies?.[ key ] );

/**
 * The core providers, in the editor's submenu order.
 *
 * @return {Array} Variations.
 */
export function coreFormProviders() {
	return [
		{ name: 'gravity', title: 'Gravity Forms', isAvailable: active( 'gravityforms' ), isSubmitted: showsAny( '.gform_confirmation_message' ) },
		{
			name: 'wpforms',
			title: 'WPForms',
			isAvailable: active( 'wpforms' ),
			isSubmitted: showsAny( '.wpforms-confirmation-container-full' ),
			// WPForms scrolls the page to a field error or its confirmation, which
			// jumps away from the player. Inside a layer that is never wanted.
			onMount: () => {
				if ( typeof window.wpforms !== 'undefined' ) {
					window.wpforms.scrollToError = () => {};
					window.wpforms.animateScrollTop = () => {};
				}
			},
		},
		{ name: 'cf7', title: 'Contact Form 7', isAvailable: active( 'cf7' ), isSubmitted: showsAny( 'form.wpcf7-form.sent' ) },
		{ name: 'jetpack', title: 'Jetpack Forms', isAvailable: active( 'jetpack' ), isSubmitted: showsAny( '.contact-form-success' ) },
		{ name: 'sureforms', title: 'SureForms', isAvailable: active( 'sureforms' ), isSubmitted: showsAny( '.srfm-success-box.srfm-active' ) },
		{ name: 'forminator', title: 'Forminator Forms', isAvailable: active( 'forminator' ), isSubmitted: showsAny( '.forminator-success.forminator-show' ) },
		{ name: 'fluentforms', title: 'Fluent Forms', isAvailable: active( 'fluentForms' ), isSubmitted: showsAny( '.ff-message-success' ) },
		{ name: 'everestforms', title: 'Everest Forms', isAvailable: active( 'everestForms' ), isSubmitted: showsAny( '.everest-forms-notice--success' ) },
		{ name: 'ninjaforms', title: 'Ninja Forms', isAvailable: active( 'ninjaForms' ), isSubmitted: fills( '.nf-response-msg', 'innerHTML' ) },
		{ name: 'metform', title: 'MetForm', isAvailable: active( 'metform' ), isSubmitted: fills( '.mf-response-msg>p', 'textContent' ) },
		{
			name: 'marketo',
			title: 'Marketo',
			isAvailable: active( 'marketo' ),
			// Inserted by marketo-form.js onSuccess / when the form can't load.
			isSubmitted: showsAny( '.godam-marketo-success' ),
			isUnavailable: showsAny( '.godam-marketo-unavailable' ),
		},
		{
			name: 'hubspot',
			title: 'HubSpot',
			isAvailable: active( 'hubspot' ),
			// `.submitted-message` / `.hs-form__submitted-message` cover a
			// non-iframe (Legacy/raw) form; `.godam-hubspot-submitted` is set by
			// hubspot-form.js onFormSubmitted for the usual iframe-rendered form,
			// whose success node lives inside the iframe and cannot be queried.
			isSubmitted: showsAny( '.submitted-message', '.hs-form__submitted-message', '.godam-hubspot-submitted' ),
		},
	];
}

/**
 * Register the core providers, skipping any already registered.
 */
export function registerCoreFormProviders() {
	const registered = new Set( ( getLayerRuntime( 'form' )?.variations || [] ).map( ( { name } ) => name ) );
	coreFormProviders()
		.filter( ( { name } ) => ! registered.has( name ) )
		.forEach( ( provider ) => registerLayerRuntimeVariation( 'form', provider ) );
}
