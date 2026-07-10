/* global Backbone */

/**
 * Open the native WordPress "attachment details" popup for a given attachment.
 *
 * This reuses the exact same two-column modal shown in the media library when an
 * attachment is clicked — including GoDAM's overrides (Edit Video / Analytics
 * buttons, video thumbnail picker, transcoding info, EXIF). The modal is a
 * Backbone `wp.media` view, so we drive it through `wp.media` rather than
 * rebuilding it in React.
 *
 * This relies on three things already present on the video editor screen:
 * `wp_enqueue_media()` (the `wp.media` framework), the core `media-grid` script
 * (which defines the `EditAttachments` frame that renders the two-column view),
 * and GoDAM's `easydam-media-library` bundle (which globally overrides
 * `wp.media.view.Attachment.Details.TwoColumn` so the popup matches the library).
 *
 * @param {number}   attachmentID       The attachment ID to edit.
 * @param {Object}   [options]          Optional settings.
 * @param {Function} [options.onChange] Called with the attachment's attributes whenever the modal mutates the model (e.g. a title edit), so the editor can stay in sync.
 * @return {boolean} `true` if the modal could be opened, `false` otherwise.
 */
export function openAttachmentDetailsModal( attachmentID, { onChange } = {} ) {
	const wp = window.wp;

	if (
		! attachmentID ||
		typeof Backbone === 'undefined' ||
		! wp?.media?.attachment ||
		! wp?.media?.view?.MediaFrame?.EditAttachments ||
		! wp?.media?.model?.Attachments
	) {
		return false;
	}

	const model = wp.media.attachment( attachmentID );

	// Keep the editor in sync with edits made inside the modal. WordPress saves
	// each field through this Backbone model, so its `change` event fires as soon
	// as a field (e.g. the title) is saved. Replace any prior listener we added
	// so repeat opens don't stack callbacks.
	if ( model._godamOnChange ) {
		model.off( 'change', model._godamOnChange );
		delete model._godamOnChange;
	}
	if ( typeof onChange === 'function' ) {
		model._godamOnChange = () => onChange( model.attributes );
		model.on( 'change', model._godamOnChange );
	}

	// Prevent the EditAttachments frame from rewriting the browser URL (its
	// grid router expects the `upload.php` grid). We also hand it a no-op
	// router shim below, so the editor's own `?tab=` URL state is untouched.
	model.set( 'skipHistory', true );

	// Fetch fresh so the details view renders with complete metadata.
	model.fetch().always( () => {
		wp.media.frames = wp.media.frames || {};

		// Reuse the frame across clicks (mirrors core's grid behaviour): the
		// editor always targets the same attachment, so a refresh is enough.
		if ( wp.media.frames.godamAttachmentEdit ) {
			wp.media.frames.godamAttachmentEdit.open();
			wp.media.frames.godamAttachmentEdit.trigger( 'refresh', model );
			return;
		}

		// The EditAttachments frame normally lives inside the media-grid "Manage"
		// controller and talks to its `gridRouter`. Off the grid there is no such
		// controller, so we supply a minimal event-emitting router shim that
		// satisfies the calls the frame makes (`navigate`, `baseUrl`, and the
		// `route:search` listener) without touching the URL.
		const gridRouter = Object.assign( {}, Backbone.Events, {
			navigate() {},
			baseUrl: ( url ) => url,
		} );

		wp.media.frames.godamAttachmentEdit = new wp.media.view.MediaFrame.EditAttachments( {
			controller: { gridRouter },
			// A single-item library hides the prev/next navigation arrows.
			library: new wp.media.model.Attachments( [ model ] ),
			model,
		} );
	} );

	return true;
}
