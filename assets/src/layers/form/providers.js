/**
 * GoDAM's own form providers: one Form layer variation per form plugin,
 * registered through `registerLayerVariation( 'form', … )` like an add-on's
 * provider would be (#2293). Registration order is the Form submenu order.
 *
 * A provider is described by:
 * - `name` — the layer's `form_type`
 * - `title`, `icon` — shown in the Form submenu, layer list and timeline
 * - `isAvailable()`, `unavailableReason` — whether its plugin can be used, and why not (a string, or a function returning one)
 * - `edit` — its settings panel
 * - `idField` — the layer key that holds the chosen form's ID
 * - `settingsUrl` — admin path to the form's settings, with `{formId}`, or a function of the form ID
 */

/**
 * External dependencies
 */
import { registerLayerVariation, getLayerVariationByName } from '@godam/layers';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import GravityForm from '../../../../pages/video-editor/components/forms/GravityForm';
import WPForm from '../../../../pages/video-editor/components/forms/WPForm';
import EverestForm from '../../../../pages/video-editor/components/forms/EverestForm';
import CF7 from '../../../../pages/video-editor/components/forms/CF7';
import JetpackForm from '../../../../pages/video-editor/components/forms/JetpackForm';
import SureForm from '../../../../pages/video-editor/components/forms/Sureform.js';
import FluentForm from '../../../../pages/video-editor/components/forms/FluentForm.js';
import MetForm from '../../../../pages/video-editor/components/forms/MetForm.js';
import ForminatorForm from '../../../../pages/video-editor/components/forms/forminatorForms.js';
import NinjaForm from '../../../../pages/video-editor/components/forms/NinjaForm.js';
import Marketo from '../../../../pages/video-editor/components/forms/Marketo.js';
import HubSpotForm from '../../../../pages/video-editor/components/forms/HubSpotForm.js';
import GFIcon from '../../../../pages/video-editor/assets/layers/GFIcon.svg';
import WPFormsIcon from '../../../../pages/video-editor/assets/layers/WPForms-Mascot.svg';
import EverestFormsIcon from '../../../../pages/video-editor/assets/layers/EverestFormsIcon.svg';
import CF7Icon from '../../../../pages/video-editor/assets/layers/CF7Icon.svg';
import JetpackIcon from '../../../../pages/video-editor/assets/layers/JetpackIcon.svg';
import SureformsIcon from '../../../../pages/video-editor/assets/layers/SureFormsIcons.svg';
import ForminatorIcon from '../../../../pages/video-editor/assets/layers/Forminator.png';
import FluentFormsIcon from '../../../../pages/video-editor/assets/layers/FluentFormsIcon.png';
import NinjaFormsIcon from '../../../../pages/video-editor/assets/layers/NinjaFormsIcon.png';
import MetformIcon from '../../../../pages/video-editor/assets/layers/MetFormIcon.png';
import MarketoIcon from '../../../../pages/video-editor/assets/layers/MarketoIcon.svg';
import HubSpotIcon from '../../../../pages/video-editor/assets/layers/HubSpotIcon.svg';

// Availability is read when asked, not at import, so page data localized after
// this module loads still counts.
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

// Jetpack form IDs are `<postId>-<n>`; the form is edited on its post.
const jetpackSettingsUrl = ( formId ) => {
	const postId = formId ? parseInt( String( formId ).split( '-' )[ 0 ], 10 ) : NaN;
	return postId ? `post.php?post=${ postId }&action=edit` : 'admin.php?page=jetpack-forms-admin#/responses';
};

export const coreFormProviders = () => [
	{
		name: 'gravity',
		title: __( 'Gravity Forms', 'godam' ),
		icon: GFIcon,
		isDefault: true,
		isAvailable: flag( 'gfActive' ),
		unavailableReason: __( 'Gravity Forms plugin is not active', 'godam' ),
		edit: GravityForm,
		idField: 'gf_id',
		settingsUrl: 'admin.php?subview=confirmation&page=gf_edit_forms&id={formId}&view=settings',
	},
	{
		name: 'wpforms',
		title: __( 'WPForms', 'godam' ),
		icon: WPFormsIcon,
		isAvailable: flag( 'wpformsActive' ),
		unavailableReason: __( 'WPForms plugin is not active', 'godam' ),
		edit: WPForm,
		idField: 'wpform_id',
		settingsUrl: 'admin.php?page=wpforms-builder&view=settings&form_id={formId}&section=general',
	},
	{
		name: 'cf7',
		title: __( 'Contact Form 7', 'godam' ),
		icon: CF7Icon,
		isAvailable: flag( 'cf7Active' ),
		unavailableReason: __( 'Contact Form 7 plugin is not active', 'godam' ),
		edit: CF7,
		idField: 'cf7_id',
		settingsUrl: 'admin.php?page=wpcf7&post={formId}&action=edit',
	},
	{
		name: 'jetpack',
		title: __( 'Jetpack Forms', 'godam' ),
		icon: JetpackIcon,
		isAvailable: flag( 'jetpackActive' ),
		unavailableReason: __( 'Jetpack plugin is not active', 'godam' ),
		edit: JetpackForm,
		idField: 'jp_id',
		settingsUrl: jetpackSettingsUrl,
	},
	{
		name: 'sureforms',
		title: __( 'SureForms', 'godam' ),
		icon: SureformsIcon,
		isAvailable: flag( 'sureformsActive' ),
		unavailableReason: __( 'SureForms plugin is not active', 'godam' ),
		edit: SureForm,
		idField: 'sureform_id',
		settingsUrl: 'post.php?post={formId}&action=edit',
	},
	{
		name: 'forminator',
		title: __( 'Forminator Forms', 'godam' ),
		icon: ForminatorIcon,
		isAvailable: flag( 'forminatorActive' ),
		unavailableReason: __( 'Forminator Forms plugin is not active', 'godam' ),
		edit: ForminatorForm,
		idField: 'forminator_id',
		settingsUrl: 'admin.php?page=forminator-cform-wizard&id={formId}',
	},
	{
		name: 'fluentforms',
		title: __( 'Fluent Forms', 'godam' ),
		icon: FluentFormsIcon,
		isAvailable: flag( 'fluentformsActive' ),
		unavailableReason: __( 'Fluent Forms plugin is not active', 'godam' ),
		edit: FluentForm,
		idField: 'fluent_form_id',
		settingsUrl: 'admin.php?page=fluent_forms&form_id={formId}&route=settings&sub_route=form_settings',
	},
	{
		name: 'everestforms',
		title: __( 'Everest Forms', 'godam' ),
		icon: EverestFormsIcon,
		isAvailable: flag( 'everestFormsActive' ),
		unavailableReason: __( 'Everest Forms plugin is not active', 'godam' ),
		edit: EverestForm,
		idField: 'everest_form_id',
		settingsUrl: 'admin.php?page=evf-builder&view=fields&form_id={formId}&tab=settings',
	},
	{
		name: 'ninjaforms',
		title: __( 'Ninja Forms', 'godam' ),
		icon: NinjaFormsIcon,
		isAvailable: flag( 'ninjaFormsActive' ),
		unavailableReason: __( 'Ninja Forms plugin is not active', 'godam' ),
		edit: NinjaForm,
		idField: 'ninja_form_id',
		settingsUrl: 'admin.php?page=ninja-forms&form_id={formId}',
	},
	{
		name: 'metform',
		title: __( 'MetForm', 'godam' ),
		icon: MetformIcon,
		isAvailable: flag( 'metformActive' ),
		unavailableReason: __( 'MetForm plugin is not active', 'godam' ),
		edit: MetForm,
		idField: 'metform_id',
		settingsUrl: '?post={formId}&action=elementor',
	},
	{
		// Marketo has no plugin to activate: it is always offered, and its panel
		// links to Settings → Integrations → Marketo when credentials are missing.
		name: 'marketo',
		title: __( 'Marketo', 'godam' ),
		icon: MarketoIcon,
		isAvailable: () => true,
		unavailableReason: '',
		edit: Marketo,
		idField: 'marketo_id',
		settingsUrl: 'admin.php?page=rtgodam_settings',
	},
	{
		name: 'hubspot',
		title: __( 'HubSpot', 'godam' ),
		icon: HubSpotIcon,
		isAvailable: flag( 'hubspotActive' ),
		unavailableReason: hubspotReason,
		edit: HubSpotForm,
		idField: 'hubspot_id',
		// HubSpot forms are managed in HubSpot, not in wp-admin.
		settingsUrl: '',
	},
];

export function registerCoreFormProviders() {
	coreFormProviders().forEach( ( provider ) => {
		if ( ! getLayerVariationByName( 'form', provider.name ) ) {
			registerLayerVariation( 'form', provider );
		}
	} );
}
