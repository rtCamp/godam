/**
 * WordPress dependencies
 */
import { addFilter } from '@wordpress/hooks';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useEffect } from '@wordpress/element';

/**
 * Higher-order component that wraps the core/image block edit component
 * to add the godam-virtual-attachment-created event listener.
 *
 * @param {Function} BlockEdit - Original block edit component.
 * @return {Function} Enhanced block edit component.
 */
const withVirtualAttachmentHandler = createHigherOrderComponent(
	( BlockEdit ) => {
		return ( props ) => {
			// Only apply to core/image block
			if ( props.name !== 'core/image' ) {
				return <BlockEdit { ...props } />;
			}

			const { attributes, setAttributes } = props;
			const { id } = attributes;

			useEffect( () => {
				/**
				 * Handle virtual attachment created event
				 * Updates the block's id attribute when a virtual attachment is created
				 *
				 * @param {CustomEvent} event - The custom event containing attachment details
				 */
				const handleVirtualAttachmentCreated = ( event ) => {
					const { attachment, virtualMediaId } = event.detail || {};

					// Update id attribute only if it's undefined, null or matches the virtualMediaId
					if (
						attachment &&
						( id === undefined || id === null || id === virtualMediaId )
					) {
						setAttributes( { id: attachment.id } );
					}
				};

				// Attach event listener
				document.addEventListener(
					'godam-virtual-attachment-created',
					handleVirtualAttachmentCreated,
				);

				// Cleanup function to remove event listener
				return () => {
					document.removeEventListener(
						'godam-virtual-attachment-created',
						handleVirtualAttachmentCreated,
					);
				};
			}, [ id, setAttributes ] );

			return <BlockEdit { ...props } />;
		};
	},
	'withVirtualAttachmentHandler',
);

/**
 * Extend the core/image block edit component to handle virtual attachment events.
 */
addFilter(
	'editor.BlockEdit',
	'godam/core-image-virtual-attachment',
	withVirtualAttachmentHandler,
);
