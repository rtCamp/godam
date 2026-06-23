/**
 * Shared layer-type registry for the timeline / seeker.
 *
 * Maps each layer `type` to its display title and the WordPress icon used on
 * the timeline marker chips. Add-on layer types (e.g. WooCommerce) registered
 * via PHP filters are merged in at load time and may carry an `iconUrl`.
 */

/**
 * WordPress dependencies
 */
import { customLink, customPostType, preformatted, video, thumbsUp } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import GFIcon from '../assets/layers/GFIcon.svg';
import WPFormsIcon from '../assets/layers/WPForms-Mascot.svg';
import CF7Icon from '../assets/layers/CF7Icon.svg';
import JetpackIcon from '../assets/layers/JetpackIcon.svg';
import SureformsIcon from '../assets/layers/SureFormsIcons.svg';
import ForminatorIcon from '../assets/layers/Forminator.png';
import FluentFormsIcon from '../assets/layers/FluentFormsIcon.png';
import EverestFormsIcon from '../assets/layers/EverestFormsIcon.svg';
import NinjaFormsIcon from '../assets/layers/NinjaFormsIcon.png';
import MetformIcon from '../assets/layers/MetFormIcon.png';

/**
 * Per-form-plugin display name and icon, keyed by a form layer's `form_type`.
 * Used to show the specific form (e.g. WPForms) on the timeline marker rather
 * than the generic "Form" type. Mirrors the form options in `SidebarLayers`.
 */
export const FORM_PLUGIN_META = {
	gravity: { name: __( 'Gravity Forms', 'godam' ), icon: GFIcon },
	wpforms: { name: __( 'WPForms', 'godam' ), icon: WPFormsIcon },
	cf7: { name: __( 'Contact Form 7', 'godam' ), icon: CF7Icon },
	jetpack: { name: __( 'Jetpack Forms', 'godam' ), icon: JetpackIcon },
	sureforms: { name: __( 'SureForms', 'godam' ), icon: SureformsIcon },
	forminator: { name: __( 'Forminator Forms', 'godam' ), icon: ForminatorIcon },
	fluentforms: { name: __( 'Fluent Forms', 'godam' ), icon: FluentFormsIcon },
	everestforms: { name: __( 'Everest Forms', 'godam' ), icon: EverestFormsIcon },
	ninjaforms: { name: __( 'Ninja Forms', 'godam' ), icon: NinjaFormsIcon },
	metform: { name: __( 'MetForm', 'godam' ), icon: MetformIcon },
};

export const layerTypes = [
	{
		title: __( 'Gravity Forms', 'godam' ),
		icon: preformatted,
		type: 'form',
	},
	{
		title: __( 'CTA', 'godam' ),
		icon: customLink,
		type: 'cta',
	},
	{
		title: __( 'Hotspot', 'godam' ),
		icon: customPostType,
		type: 'hotspot',
	},
	{
		title: __( 'Ad', 'godam' ),
		icon: video,
		type: 'ad',
	},
	{
		title: __( 'Poll', 'godam' ),
		icon: thumbsUp,
		type: 'poll',
	},
	// Merge add-on layer types registered via PHP filters (e.g. WooCommerce).
	...( window.godamVideoEditorConfig?.layerOptions || [] ),
];
