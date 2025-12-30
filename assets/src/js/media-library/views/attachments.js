/* global jQuery */

/**
 * Internal dependencies
 */
import Attachment from './attachment';

const $ = jQuery;
const Attachments = wp?.media?.view?.Attachments;

export default Attachments?.extend( {

	initialize() {
		const BREAKPOINT_WIDTH = 640;
		const SMALL_COLUMN_WIDTH = 135;
		const LARGE_COLUMN_WIDTH = 200;

		// Call the parent initialize method
		Attachments.prototype.initialize.apply( this, arguments );

		// Use modal container width instead of window width for more accurate calculation
		const getIdealColumnWidth = () => {
			const containerWidth = this.$el.closest( '.attachments-wrapper, .media-frame-content' ).width() || window.innerWidth;
			return containerWidth < BREAKPOINT_WIDTH ? SMALL_COLUMN_WIDTH : LARGE_COLUMN_WIDTH;
		};

		// Set initial column width
		this.options.idealColumnWidth = getIdealColumnWidth();

		// This condition to use default Attachment incase of the sortable area.
		if ( Attachment && ! ( this.$el.hasClass( 'ui-sortable' ) && ! this.$el.hasClass( 'ui-sortable-disabled' ) ) ) {
			/**
			 * Override the default AttachmentView with our custom view.
			 *
			 * This custom view will attach the draggable event to the attachment element.
			 */
			this.options.AttachmentView = Attachment;
		}
	},

	ready() {
		// Call parent ready method
		Attachments.prototype.ready.apply( this, arguments );

		// Force column recalculation after the view is ready and DOM is settled
		setTimeout( () => {
			// Trigger a resize event to force WordPress to recalculate columns
			if ( this.options.resize ) {
				$( window ).trigger( 'resize' );
			}
		}, 50 );
	},

} );
