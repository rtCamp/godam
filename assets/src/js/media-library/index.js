
/**
 * Internal dependencies
 */
import '../../libs/jquery-ui-1.14.1.draggable/jquery-ui';
import './transcoding-status';

import AttachmentsBrowser from './views/attachment-browser.js';
import Attachments from './views/attachments.js';
import AttachmentDetailsTwoColumn from './views/attachment-detail-two-column.js';
import mediaFrameSelect from './views/media-frame-select.js';

import MediaDateRangeFilter from './views/filters/media-date-range-filter-list-view.js';

import { isFolderOrgDisabled, isUploadPage, addManageMediaButton } from './utility.js';

/**
 * MediaLibrary class.
 */
class MediaLibrary {
	constructor() {
		this.initialize();
	}

	initialize() {
		this.setupAttachmentBrowser();
		document.addEventListener( 'DOMContentLoaded', () => this.onDOMContentLoaded() );
	}

	onDOMContentLoaded() {
		this.setupMediaLibraryRoot();
		this.initializeDateRangeFilter();
		addManageMediaButton();
	}

	setupAttachmentBrowser() {
		if ( wp?.media?.view?.AttachmentsBrowser && AttachmentsBrowser ) {
			wp.media.view.AttachmentsBrowser = AttachmentsBrowser;
		}

		if ( wp?.media?.view?.Attachments && Attachments ) {
			wp.media.view.Attachments = Attachments;
		}

		if ( wp?.media?.view?.Attachment?.Details?.TwoColumn && AttachmentDetailsTwoColumn ) {
			wp.media.view.Attachment.Details.TwoColumn = AttachmentDetailsTwoColumn;
		}

		if ( wp?.media?.view?.MediaFrame?.Select && mediaFrameSelect ) {
			wp.media.view.MediaFrame.Select = mediaFrameSelect;
		}
	}

	setupMediaLibraryRoot() {
		if ( ! isFolderOrgDisabled() && isUploadPage() ) {
			const mediaLibraryRoot = document.createElement( 'div' );
			mediaLibraryRoot.id = 'rt-transcoder-media-library-root';
			const wpbody = document.querySelector( '#wpbody' );
			wpbody.insertBefore( mediaLibraryRoot, wpbody.firstChild );
		}
	}

	initializeDateRangeFilter() {
		new MediaDateRangeFilter(
			'media-date-range-filter',
			'media-date-range-filter-start',
			'media-date-range-filter-end',
		);
	}
}

new MediaLibrary();
