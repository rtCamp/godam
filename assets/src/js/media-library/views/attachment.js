
/* global jQuery */

const $ = jQuery;

const Attachment = wp?.media?.view?.Attachment?.extend( {

	/**
	 * Enables the checkmark for bulk selection of items.
	 *
	 * While the exact cause and effect of this implementation are unclear, it is required to ensure the checkmark appears during bulk selection.
	 * If any issues arise, this functionality should be reviewed as a potential source.
	 */
	buttons: {
		check: true,
	},

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
			 * not using it here would result in you having to use timeout function to wait for the initialization of the view.
			 */
			helper: () => {
				// Get the current selection from Backbone's state
				const selection = wp.media.frame.state().get( 'selection' );

				// Map through the selection to extract IDs
				let draggedItemIds = selection?.map( ( model ) => model.get( 'id' ) );

				// If no items are selected, use the current item's ID
				if ( ! draggedItemIds || draggedItemIds.length === 0 ) {
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
						zIndex: 160001, // Ensure that the helper is above media library popup
						PointerEvent: 'none',
						position: 'relative',
					},
				} );
			},
			opacity: 0.7,
			appendTo: 'body',
			cursorAt: { top: 5, left: 5 },

		} );
	},

	render() {
		/**
		 * Finish the parent's render method call before making custom modifications.
		 *
		 * This is necessary because the parent's render method will set up the view's element and other properties.
		 */
		wp.media.view.Attachment.prototype.render.call( this );

		if ( this.model.get( 's3_url' ) ) {
			this.$el.append( `
				<div class="attachment-s3-status">
					<span class="dashicons dashicons-cloud"></span>
				</div>
			` );
		}

		return this;
	},
} );

export default Attachment;
