/**
 * The Form layer. Each form plugin is a variation, registered separately with
 * `registerLayerVariation( 'form', … )` (see ../form-providers.js); a
 * variation's `name` is stored as the layer's `form_type`.
 */

/**
 * External dependencies
 */
import { getLayerType, isVariationAvailable } from '@godam/layers';

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
	// A form layer can't be saved until a form is picked.
	validate: ( layer ) => Boolean( getFormIdFromLayer( layer, layer.form_type ) ),
};
