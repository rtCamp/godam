
/**
 * Internal dependencies
 */
import Attachment from './attachment';

const Attachments = wp?.media?.view?.Attachments;

export default Attachments?.extend( {

	initialize() {
		// Call the parent initialize method
		Attachments.prototype.initialize.call( this );

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
