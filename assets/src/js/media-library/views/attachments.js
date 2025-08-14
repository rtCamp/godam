
/**
 * Internal dependencies
 */
import Attachment from './attachment';

const Attachments = wp?.media?.view?.Attachments;

export default Attachments?.extend( {

	initialize() {
		// Call the parent initialize method
		Attachments.prototype.initialize.apply( this, arguments );

		// Increase the column width for media attachments.
		this.options.idealColumnWidth = window.innerWidth < 640 ? 135 : 250;

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
