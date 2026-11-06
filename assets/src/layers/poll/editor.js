/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import metadata from './layer.json';
import PollLayer from './edit';
import { PollLayerIcon } from '../../../../pages/video-editor/components/editor-shell/icons';

export { metadata };

export const settings = {
	title: __( 'Poll', 'godam' ),
	description: __( 'Create an interactive poll', 'godam' ),
	icon: PollLayerIcon,
	edit: PollLayer,
	getAvailability: () => (
		window?.easydamMediaLibrary?.isPollPluginActive
			? null
			: { available: false, reason: __( 'Poll plugin is not active', 'godam' ) }
	),
};
