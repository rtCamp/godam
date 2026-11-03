/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import metadata from '../../../../assets/src/layers/hotspot/layer.json';
import HotspotLayer from '../../components/layers/HotspotLayer';
import { HotspotLayerIcon } from '../../components/editor-shell/icons';

export { metadata };

export const settings = {
	title: __( 'Hotspot', 'godam' ),
	description: __( 'Add an info hotspot', 'godam' ),
	icon: HotspotLayerIcon,
	edit: HotspotLayer,
};
