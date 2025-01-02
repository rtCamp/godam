/**
 * Internal dependencies
 */
import '../../libs/jquery-ui-1.14.1.draggable/jquery-ui';
import './transcoding-status';

import AttachmentsBrowser from './views/attachment-browser.js';
import Attachments from './views/attachments.js';

/**
 * MediaLibrary class.
 */
class MediaLibrary {
	constructor() {
		this.setupAttachmentBrowser();
	}

	setupAttachmentBrowser() {
		if ( wp?.media?.view?.AttachmentsBrowser && AttachmentsBrowser ) {
			wp.media.view.AttachmentsBrowser = AttachmentsBrowser;
		}

		if ( wp?.media?.view?.Attachments && Attachments ) {
			wp.media.view.Attachments = Attachments;
		}
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
