/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import metadata from './layer.json';
import CTALayer from './edit';
import { CtaLayerIcon } from '../../../../pages/video-editor/components/editor-shell/icons';

export { metadata };

export const settings = {
	title: __( 'CTA', 'godam' ),
	description: __( 'Add a clickable button', 'godam' ),
	icon: CtaLayerIcon,
	edit: CTALayer,
};
