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
