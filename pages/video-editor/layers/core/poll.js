/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import metadata from '../../../../assets/src/layers/poll/layer.json';
import PollLayer from '../../components/layers/PollLayer';
import { PollLayerIcon } from '../../components/editor-shell/icons';

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
