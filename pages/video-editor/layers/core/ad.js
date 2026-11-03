/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { video } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import metadata from '../../../../assets/src/layers/ad/layer.json';
import AdsLayer from '../../components/layers/AdsLayer';

export { metadata };

export const settings = {
	title: __( 'Ad', 'godam' ),
	description: __( 'Insert an advertisement', 'godam' ),
	icon: video,
	edit: AdsLayer,
	// With an ad server configured its ads win, so no new Ad layers. Existing
	// ones stay editable and show the warning.
	getAvailability: ( { videoConfig } = {} ) => (
		'ad-server' === videoConfig?.adServer
			? { available: false, reason: __( 'This ad will be overridden by Ad server\'s ads', 'godam' ), disablesExisting: false }
			: null
	),
};
