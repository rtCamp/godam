
/**
 * Internal dependencies
 */
import Attachment from './attachment';

const Attachments = wp?.media?.view?.Attachments;

export default Attachments?.extend( {

	initialize() {
		const BREAKPOINT_WIDTH = 640;
		const SMALL_COLUMN_WIDTH = 135;
		const LARGE_COLUMN_WIDTH = 200;

		// Call the parent initialize method
		Attachments.prototype.initialize.apply( this, arguments );

		// Increase the column width for media attachments.
		this.options.idealColumnWidth = window.innerWidth < BREAKPOINT_WIDTH ? SMALL_COLUMN_WIDTH : LARGE_COLUMN_WIDTH;

		if ( Attachment ) {
			/**
			 * Override the default AttachmentView with our custom view.
			 *
			 * This custom view will attach the draggable event to the attachment element.
			 */
			this.options.AttachmentView = Attachment;
		}
	},
} );
