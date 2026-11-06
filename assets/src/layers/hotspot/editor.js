/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import metadata from './layer.json';
import HotspotLayer from './edit';
import { HotspotLayerIcon } from '../../../../pages/video-editor/components/editor-shell/icons';

export { metadata };

export const settings = {
	title: __( 'Hotspot', 'godam' ),
	description: __( 'Add an info hotspot', 'godam' ),
	icon: HotspotLayerIcon,
	edit: HotspotLayer,
};
