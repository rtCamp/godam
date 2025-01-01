
/* global jQuery */

const Attachments = wp.media.view.Attachments;

const $ = jQuery;

const Attachment = wp.media.view.Attachment.extend( {

	initialize() {
		wp.media.view.Attachment.prototype.initialize.call( this );

		/**
		 * Attach drag event to the attachment element, this will allow the user to drag the attachment.
		 * It's more useful to do this here, because on re-render, the draggable event will be lost.
		 */
		this.$el.draggable( {
			cursor: 'move',

			/**
			 * Using arrow function here is necessary to bind the context of `this` to the parent view.
			 * Otherwise, `this` will refer to the draggable instance.
			 *
			 * Otherwise you would have ot use timeout function to wait for the initialization of the view.
			 */
			helper: () => {
				// Get the current selection from Backbone's state
				const selection = wp.media.frame.state().get( 'selection' );

				// Map through the selection to extract IDs
				let draggedItemIds = selection.map( ( model ) => model.get( 'id' ) );

				// If no items are selected, use the current item's ID
				if ( draggedItemIds.length === 0 ) {
					const currentItemId = this.model.get( 'id' ); // Get the ID of the current attachment
					draggedItemIds = [ currentItemId ];
				}

				this.$el.data( 'draggedItems', draggedItemIds );

				return $( '<div>', {
					text: `Moving ${ draggedItemIds.length } item${ draggedItemIds.length > 1 ? 's' : '' }`,
					css: {
						background: '#333',
						color: '#fff',
						padding: '8px 12px',
						borderRadius: '4px',
						fontSize: '14px',
						fontWeight: 'bold',
						boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
						zIndex: 1000,
						PointerEvent: 'none',
					},
				} );
			},
			opacity: 0.7,
			zIndex: 1000,
			appendTo: 'body',
			cursorAt: { top: 5, left: 5 },

		} );
	},

} );

export default Attachments.extend( {

	initialize() {
		// Call the parent initialize method
		Attachments.prototype.initialize.call( this );

		/**
		 * Override the default AttachmentView with our custom view.
		 *
		 * This custom view will attach the draggable event to the attachment element.
		 */
		this.options.AttachmentView = Attachment;
	},

} );
