/* global jQuery */

/**
 * Internal dependencies
 */
import { isAPIKeyValid, isFolderOrgDisabled } from '../utility';

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

		if ( ! isFolderOrgDisabled() ) {
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
		}
	},

	render() {
		/**
		 * Finish the parent's render method call before making custom modifications.
		 *
		 * This is necessary because the parent's render method will set up the view's element and other properties.
		 */
		wp.media.view.Attachment.prototype.render.call( this );

		if ( isAPIKeyValid() && ( this.model.get( 'type' ) === 'video' || this.model.get( 'type' ) === 'audio' ) ) {
			// Get the transcoding status from the model
			const transcodingStatus = this.model.get( 'transcoding_status' );

			// Check if the status is 'transcoded' or if we have a transcoded URL
			if ( transcodingStatus === 'transcoded' ) {
				this.$el.append( `
					<div class="transcoding-status__loader" data-percent="100">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="size-6">
							<path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.75-5.25Z" clip-rule="evenodd" />
						</svg>
					</div>
				` );

				this.$el.addClass( 'transcoding-status' );
				this.$el.addClass( 'transcoding-status--completed' );
			} else {
				this.$el.append( `
					<div class="transcoding-status__loader" data-percent="100">
						<svg class="transcoding-status__loader__progress">
							<circle class="background" cx="50%" cy="50%" r="45%" />
							<circle class="progress"   cx="50%" cy="50%" r="45%" />
						</svg>
					</div>
				` );

				this.$el.addClass( 'transcoding-status' );
				this.$el.addClass( 'transcoding-status--in-progress' );
			}
		}

		return this;
	},
} );

export default Attachment;
