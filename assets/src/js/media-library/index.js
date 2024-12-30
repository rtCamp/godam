/**
 * Internal dependencies
 */
import '../../libs/jquery-ui-1.14.1.draggable/jquery-ui';
import './transcoding-status';

import AttachmentsBrowser from './views/attachment-browser.js';
import Attachments from './views/attachment.js';

/**
 * MediaLibrary class.
 */
class MediaLibrary {
	constructor() {
		this.setupAttachmentBrowser();
	}

	setupAttachmentBrowser() {
		wp.media.view.AttachmentsBrowser = AttachmentsBrowser;
		wp.media.view.Attachments = Attachments;
	}
}

const mediaLibrary = new MediaLibrary();

export default mediaLibrary;

document.addEventListener( 'DOMContentLoaded', function() {
	const mediaLibraryRoot = document.createElement( 'div' );
	mediaLibraryRoot.id = 'rt-transcoder-media-library-root';
	const wpbody = document.querySelector( '#wpbody' );
	wpbody.insertBefore( mediaLibraryRoot, wpbody.firstChild );
} );
