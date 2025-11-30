/* global jQuery */

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
import GoDAMMediaFrameShared from './views/godam-media-frame-shared.js';

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
		this.setupDeleteEventListeners();
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

		if ( wp?.media?.view?.MediaFrame?.Select ) {
			const OriginalSelect = wp.media.view.MediaFrame.Select;
			wp.media.view.MediaFrame.Select = OriginalSelect.extend( {
				initialize() {
					// Call the original Select initialize method
					OriginalSelect.prototype.initialize.apply( this, arguments );

					// Initialize GoDAM functionality
					this.on( 'content:render:godam', this.GoDAMCreate, this );
				},

				// Include all other GoDAM methods from the shared object
				...GoDAMMediaFrameShared,
			} );
		}

		if ( wp?.media?.view?.MediaFrame?.Post ) {
			const OriginalPost = wp.media.view.MediaFrame.Post;
			wp.media.view.MediaFrame.Post = OriginalPost.extend( {
				initialize() {
					// Call the original Post initialize method
					OriginalPost.prototype.initialize.apply( this, arguments );

					// Initialize GoDAM functionality
					this.on( 'content:render:godam', this.GoDAMCreate, this );
				},

				// Include all other GoDAM methods from the shared object
				...GoDAMMediaFrameShared,
			} );
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

	/**
	 * Set up event listeners for attachment deletion to trigger count refresh
	 */
	setupDeleteEventListeners() {
		// Monitor for WordPress admin AJAX actions that delete attachments
		const originalAjaxPost = jQuery.post;
		jQuery.post = function( url, data, ...args ) {
			const result = originalAjaxPost.apply( this, [ url, data, ...args ] );

			// Check if this is a delete attachment action
			if ( data && (
				data.action === 'delete-post' ||
				data.action === 'delete-attachment' ||
				( typeof data === 'string' && data.includes( 'action=delete-post' ) ) ||
				( typeof data === 'string' && data.includes( 'action=delete-attachment' ) )
			) ) {
				// Trigger count refresh after successful deletion
				result.done( () => {
					setTimeout( () => {
						const event = new CustomEvent( 'godam-attachment-browser:changed' );
						document.dispatchEvent( event );
					}, 100 );
				} );
			}

			return result;
		};

		// Monitor for bulk actions
		const originalSubmit = HTMLFormElement.prototype.submit;
		HTMLFormElement.prototype.submit = function() {
			const actionSelect = this.querySelector( 'select[name="action"], select[name="action2"]' );
			const isBulkDelete = actionSelect && actionSelect.value === 'delete';

			if ( isBulkDelete ) {
				// Set up a delayed event trigger for bulk deletion
				setTimeout( () => {
					const event = new CustomEvent( 'godam-attachment-browser:changed' );
					document.dispatchEvent( event );
				}, 1000 ); // Longer delay for bulk operations
			}

			return originalSubmit.call( this );
		};

		// Monitor for attachment removals in media modal
		if ( wp?.media?.model?.Attachments ) {
			const originalRemove = wp.media.model.Attachments.prototype.remove;
			wp.media.model.Attachments.prototype.remove = function( ...args ) {
				const result = originalRemove.apply( this, args );

				// Trigger count refresh when attachments are removed from collections
				setTimeout( () => {
					const event = new CustomEvent( 'godam-attachment-browser:changed' );
					document.dispatchEvent( event );
				}, 100 );

				return result;
			};
		}
	}
}

new MediaLibrary();
