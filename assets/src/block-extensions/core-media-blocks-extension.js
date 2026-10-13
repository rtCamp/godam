/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useEffect } from '@wordpress/element';

/**
 * Blocks that store a single attachment ID, mapped to the attribute name that holds it.
 */
const SINGLE_ID_BLOCKS = {
	'core/image': 'id',
	'core/video': 'id',
	'core/audio': 'id',
	'core/file': 'id',
	'core/cover': 'id',
	'core/media-text': 'mediaId',
	'godam/audio': 'id',
	'godam/pdf': 'id',
};

/**
 * Higher-order component that wraps media block edit components
 * to handle the godam-virtual-attachment-created event.
 *
 * Covers single-ID blocks: core/image, core/video, core/audio, core/file, core/cover,
 * core/media-text, godam/audio, godam/pdf. Modern WP 5.9+ gallery inner core/image
 * blocks are handled via replaceVirtualIdInCoreImageBlocks in godam-media-frame-shared.js.
 *
 * @param {Function} BlockEdit - Original block edit component.
 * @return {Function} Enhanced block edit component.
 */
const withVirtualAttachmentHandler = createHigherOrderComponent(
	( BlockEdit ) => {
		return ( props ) => {
			const { name, attributes, setAttributes } = props;

			const singleIdAttr = SINGLE_ID_BLOCKS[ name ];

			// Current media ID (primitive — safe as effect dep).
			const mediaId = singleIdAttr ? attributes[ singleIdAttr ] : undefined;

			// Re-registers when mediaId changes so the closure captures the new value.
			useEffect( () => {
				// Skip blocks that don't use a single media attachment ID.
				if ( ! singleIdAttr ) {
					return;
				}

				const handleVirtualAttachmentCreated = ( event ) => {
					const { attachment, virtualMediaId } = event.detail || {};

					// Update id attribute only if it's undefined, null, or matches the virtualMediaId.
					if (
						attachment &&
						( mediaId === undefined || mediaId === null || String( mediaId ) === String( virtualMediaId ) )
					) {
						setAttributes( { [ singleIdAttr ]: attachment.id } );
					}
				};
				document.addEventListener(
					'godam-virtual-attachment-created',
					handleVirtualAttachmentCreated,
				);

				return () => {
					document.removeEventListener(
						'godam-virtual-attachment-created',
						handleVirtualAttachmentCreated,
					);
				};
			}, [ mediaId, setAttributes, singleIdAttr ] );

			return <BlockEdit { ...props } />;
		};
	},
	'withVirtualAttachmentHandler',
);

/**
 * Extend supported block edit components to handle virtual attachment events.
 */
addFilter(
	'editor.BlockEdit',
	'godam/core-media-virtual-attachment',
	withVirtualAttachmentHandler,
);
