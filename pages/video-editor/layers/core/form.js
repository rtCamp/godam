/**
 * The Form layer. Each form plugin is a variation that sets `form_type`; #2293
 * turns these into separately registered providers.
 */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import metadata from '../../../../assets/src/layers/form/layer.json';
import FormLayer from '../../components/layers/FormLayer';
import { FormLayerIcon } from '../../components/editor-shell/icons';
import { getFormIdFromLayer } from '../../utils/formUtils';
import GFIcon from '../../assets/layers/GFIcon.svg';
import WPFormsIcon from '../../assets/layers/WPForms-Mascot.svg';
import EverestFormsIcon from '../../assets/layers/EverestFormsIcon.svg';
import CF7Icon from '../../assets/layers/CF7Icon.svg';
import JetpackIcon from '../../assets/layers/JetpackIcon.svg';
import SureformsIcon from '../../assets/layers/SureFormsIcons.svg';
import ForminatorIcon from '../../assets/layers/Forminator.png';
import FluentFormsIcon from '../../assets/layers/FluentFormsIcon.png';
import NinjaFormsIcon from '../../assets/layers/NinjaFormsIcon.png';
import MetformIcon from '../../assets/layers/MetFormIcon.png';
import MarketoIcon from '../../assets/layers/MarketoIcon.svg';
import HubSpotIcon from '../../assets/layers/HubSpotIcon.svg';

export { metadata };

/**
 * A form-plugin variation. Availability is read when asked, not at import, so
 * page data localized after this module loads still counts.
 *
 * @param {string}          name        The `form_type` value.
 * @param {string}          title       Display name.
 * @param {string}          icon        Icon URL.
 * @param {Function}        isAvailable Whether the form plugin can be used.
 * @param {string|Function} reason      Why it can't, shown as a tooltip.
 * @return {Object} The variation.
 */
const provider = ( name, title, icon, isAvailable, reason ) => ( {
	name,
	title,
	icon,
	attributes: { form_type: name },
	isAvailable,
	get unavailableReason() {
		return typeof reason === 'function' ? reason() : reason;
	},
} );

const flag = ( key ) => () => Boolean( window?.videoData?.[ key ] );

const hubspotReason = () => {
	// Say what actually unblocks the layer: turning the integration on, or
	// connecting the source the admin chose (GoDAM Central by default, where
	// activating the HubSpot plugin alone is not enough).
	if ( window?.videoData?.hubspotEnabled === false ) {
		return __( 'Turn on HubSpot in Settings → Integrations → HubSpot to use this form', 'godam' );
	}
	return 'leadin' === ( window?.videoData?.hubspotChosenSource ?? 'central' )
		? __( 'Activate and connect the HubSpot plugin to use this form', 'godam' )
		: __( 'Connect HubSpot in Settings → Integrations → HubSpot to use this form', 'godam' );
};

const variations = [
	{ ...provider( 'gravity', __( 'Gravity Forms', 'godam' ), GFIcon, flag( 'gfActive' ), __( 'Gravity Forms plugin is not active', 'godam' ) ), isDefault: true },
	provider( 'wpforms', __( 'WPForms', 'godam' ), WPFormsIcon, flag( 'wpformsActive' ), __( 'WPForms plugin is not active', 'godam' ) ),
	provider( 'cf7', __( 'Contact Form 7', 'godam' ), CF7Icon, flag( 'cf7Active' ), __( 'Contact Form 7 plugin is not active', 'godam' ) ),
	provider( 'jetpack', __( 'Jetpack Forms', 'godam' ), JetpackIcon, flag( 'jetpackActive' ), __( 'Jetpack plugin is not active', 'godam' ) ),
	provider( 'sureforms', __( 'SureForms', 'godam' ), SureformsIcon, flag( 'sureformsActive' ), __( 'SureForms plugin is not active', 'godam' ) ),
	provider( 'forminator', __( 'Forminator Forms', 'godam' ), ForminatorIcon, flag( 'forminatorActive' ), __( 'Forminator Forms plugin is not active', 'godam' ) ),
	provider( 'fluentforms', __( 'Fluent Forms', 'godam' ), FluentFormsIcon, flag( 'fluentformsActive' ), __( 'Fluent Forms plugin is not active', 'godam' ) ),
	provider( 'everestforms', __( 'Everest Forms', 'godam' ), EverestFormsIcon, flag( 'everestFormsActive' ), __( 'Everest Forms plugin is not active', 'godam' ) ),
	provider( 'ninjaforms', __( 'Ninja Forms', 'godam' ), NinjaFormsIcon, flag( 'ninjaFormsActive' ), __( 'Ninja Forms plugin is not active', 'godam' ) ),
	provider( 'metform', __( 'MetForm', 'godam' ), MetformIcon, flag( 'metformActive' ), __( 'MetForm plugin is not active', 'godam' ) ),
	// Marketo has no plugin to activate: it is always offered. Its settings panel
	// links to Settings → Integrations → Marketo when credentials are missing.
	provider( 'marketo', __( 'Marketo', 'godam' ), MarketoIcon, () => true, '' ),
	provider( 'hubspot', __( 'HubSpot', 'godam' ), HubSpotIcon, flag( 'hubspotActive' ), hubspotReason ),
];

export const settings = {
	title: __( 'Form', 'godam' ),
	description: __( 'Embed a lead form', 'godam' ),
	icon: FormLayerIcon,
	edit: FormLayer,
	variations,
	getAvailability: () => (
		variations.some( ( variation ) => variation.isAvailable() )
			? null
			: { available: false, reason: __( 'No form plugin is active', 'godam' ) }
	),
	// A form layer can't be saved until a form is picked.
	validate: ( layer ) => Boolean( getFormIdFromLayer( layer, layer.form_type ) ),
};
