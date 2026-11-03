/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import metadata from '../../../../assets/src/layers/cta/layer.json';
import CTALayer from '../../components/layers/CTALayer';
import { CtaLayerIcon } from '../../components/editor-shell/icons';

export { metadata };

export const settings = {
	title: __( 'CTA', 'godam' ),
	description: __( 'Add a clickable button', 'godam' ),
	icon: CtaLayerIcon,
	edit: CTALayer,
};
