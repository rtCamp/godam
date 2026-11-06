/**
 * The Form layer. Each form plugin is a variation, registered separately with
 * `registerLayerVariation( 'form', … )` (see ../form-providers.js); a
 * variation's `name` is stored as the layer's `form_type`.
 */

/**
 * External dependencies
 */
import { getLayerType, getLayerVariation, isVariationAvailable } from '@godam/layers';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import metadata from './layer.json';
import FormLayer from './edit';
import { FormLayerIcon } from '../../../../pages/video-editor/components/editor-shell/icons';
import { getFormIdFromLayer } from '../../../../pages/video-editor/utils/formUtils';

export { metadata };

export const settings = {
	title: __( 'Form', 'godam' ),
	description: __( 'Embed a lead form', 'godam' ),
	icon: FormLayerIcon,
	edit: FormLayer,
	variationAttribute: 'form_type',
	getAvailability: () => (
		( getLayerType( 'form' )?.variations || [] ).some( isVariationAvailable )
			? null
			: { available: false, reason: __( 'No form plugin is active', 'godam' ) }
	),
	// A form layer can't be saved until a form is picked. A layer whose provider
	// isn't registered (its add-on is inactive) is kept as it was, so it never
	// blocks saving the rest of the attachment.
	validate: ( layer ) => {
		const provider = getLayerVariation( getLayerType( 'form' ), layer );
		return ! provider || Boolean( getFormIdFromLayer( layer, provider.name ) );
	},
};
