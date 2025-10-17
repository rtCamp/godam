/**
 * WordPress dependencies
 */
const { __ } = wp.i18n;

/**
 * Internal dependencies
 */
import '../../libs/jquery-ui-1.14.1.draggable/jquery-ui';
import './transcoding-status';

import AttachmentsBrowser from './views/attachment-browser.js';
import Attachments from './views/attachments.js';
import AttachmentDetailsTwoColumn from './views/attachment-detail-two-column.js';
import AttachmentDetails from './views/attachment-details.js';
import mediaFrameSelect from './views/media-frame-select.js';
import mediaFramePost from './views/media-frame-post.js';

import MediaDateRangeFilter from './views/filters/media-date-range-filter-list-view.js';
import MediaListViewTableDragHandler from './views/attachment-list.js';

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
		this.addInputPlaceholder();
		this.handleBannerClose();
	}

	addInputPlaceholder() {
		if ( wp?.media?.view?.Search ) {
			wp.media.view.Search = wp?.media?.view?.Search?.extend( {
				initialize() {
					wp.media.view.Search.__super__.initialize.apply( this, arguments );
					this.$el.attr( 'placeholder', __( 'Search Media', 'godam' ) );
				},
			} );
		}
	}

	/**
	 * Handles the closing of the offer banner.
	 * Hides the banner and sends an AJAX request to dismiss the offer.
	 */
	handleBannerClose() {
		const banner = document.querySelector( '.annual-plan-offer-banner' );
		if ( banner ) {
			const closeButton = banner.querySelector( '.annual-plan-offer-banner__dismiss' );
			if ( closeButton ) {
				closeButton.addEventListener( 'click', () => {
					banner.style.display = 'none';

					window.wp.ajax.post( 'godam_dismiss_offer_banner', {
						nonce: window?.godamSettings?.showOfferBannerNonce || '',
					} );
				} );
			}
		}
	}

	setupAttachmentBrowser() {
		if ( wp?.media?.view?.AttachmentsBrowser && AttachmentsBrowser ) {
			wp.media.view.AttachmentsBrowser = AttachmentsBrowser;
		}

		if ( wp?.media?.view?.Attachments && Attachments ) {
			wp.media.view.Attachments = Attachments;
		}

		if ( wp?.media?.view?.Attachment?.Details && AttachmentDetails ) {
			wp.media.view.Attachment.Details = AttachmentDetails;
		}

		if ( wp?.media?.view?.Attachment?.Details?.TwoColumn && AttachmentDetailsTwoColumn ) {
			wp.media.view.Attachment.Details.TwoColumn = AttachmentDetailsTwoColumn;
		}

		if ( wp?.media?.view?.MediaFrame?.Select && mediaFrameSelect ) {
			wp.media.view.MediaFrame.Select = mediaFrameSelect;
		}

		if ( wp?.media?.view?.MediaFrame?.Post && mediaFramePost ) {
			wp.media.view.MediaFrame.Post = mediaFramePost;
		}

		new MediaListViewTableDragHandler();
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
