/* global jQuery */

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * External dependencies
 */
import videojs from 'video.js';

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
import MediaUploaderHandler from './media-uploader-handler.js';

const $ = jQuery;

/**
 * Destroys all Video.js player instances found within a given DOM element.
 * This is used to stop video playback and free resources when the media modal closes.
 *
 * WordPress core handles native mediaelement players by clicking the pause button
 * inside Modal.close(). For Video.js players (used for virtual/GoDAM proxy videos),
 * we need to explicitly dispose them since they are not managed by mediaelement.
 *
 * @param {HTMLElement} container - The DOM element to search for Video.js players.
 */
function destroyVideoJSPlayersInContainer( container ) {
	if ( ! container || ! videojs ) {
		return;
	}

	const videoElements = container.querySelectorAll( 'video.video-js, video[id^="videojs-player-"]' );

	videoElements.forEach( ( videoElement ) => {
		try {
			const player = videojs.getPlayer( videoElement.id || videoElement );
			if ( player && ! player.isDisposed() ) {
				player.pause();
				player.dispose();
			}
		} catch ( error ) {
			// Silent fail - player might already be disposed or not initialized
		}
	} );

	// Fallback for native elements if a Video.js instance is not available.
	container.querySelectorAll( 'video' ).forEach( ( videoElement ) => {
		try {
			videoElement.pause();
			videoElement.currentTime = 0;
		} catch ( error ) {
			// Silent fail.
		}
	} );
}

/**
 * MediaLibrary class.
 */
class MediaLibrary {
	constructor() {
		this.initialize();
	}

	initialize() {
		this.setupAttachmentBrowser();
		this.setupModalCloseCleanup();
		document.addEventListener( 'DOMContentLoaded', () => this.onDOMContentLoaded() );

		jQuery( () => {
			this.jQueryReadyFunction();
		} );
	}

	jQueryReadyFunction() {
		new MediaUploaderHandler();
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

	/**
	 * Hooks into WordPress media modal close to destroy VideoJS players.
	 *
	 * WordPress core's Modal.close() only hides the modal ($el.hide()) and clicks
	 * the mediaelement pause button. It does NOT call Backbone's remove()/dispose()
	 * on child views. This means any VideoJS player initialized for virtual media
	 * keeps playing even after the modal is hidden.
	 *
	 * This method monkey-patches Modal.prototype.close to also dispose VideoJS players,
	 * mirroring the same pattern WP core uses for mediaelement cleanup.
	 */
	setupModalCloseCleanup() {
		if ( ! wp?.media?.view?.Modal?.prototype?.close ) {
			return;
		}

		const originalClose = wp.media.view.Modal.prototype.close;

		wp.media.view.Modal.prototype.close = function( ...args ) {
			// Destroy all VideoJS players within this modal before it closes.
			// This mirrors WP core's own cleanup: $('.mejs-pause button').trigger('click')
			destroyVideoJSPlayersInContainer( this.el );

			return originalClose.apply( this, args );
		};
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

					// Initialize sidebar immediately
					this.initializeMediaLibrarySidebar();
				},

				initializeMediaLibrarySidebar() {
					const hasActiveSortable = this.$el.find( 'ul.ui-sortable:not(.ui-sortable-disabled)' ).length > 0;

					if ( ! isUploadPage() && ! isFolderOrgDisabled() && ! hasActiveSortable ) {
						/**
						 * This timeout with the custom event is necessary to ensure that the media frame is fully loaded before dispatching the event.
						 */
						setTimeout( () => {
							$( '.media-frame' ).removeClass( 'hide-menu' );

							if ( window.elementor ) {
								const visibleContainers = Array.from( document.querySelectorAll( '.supports-drag-drop' ) ).filter(
									( container ) => getComputedStyle( container ).display !== 'none',
								);

								const activeContainer = visibleContainers[ visibleContainers.length - 1 ]; // most recently opened visible one

								if ( activeContainer ) {
									const menu = activeContainer.querySelector( '.media-frame-menu' );
									if ( menu ) {
										menu.querySelectorAll( '#rt-transcoder-media-library-root' ).forEach( ( el ) => el.remove() );
										const div = document.createElement( 'div' );
										div.id = 'rt-transcoder-media-library-root';
										if ( menu.firstChild ) {
											menu.firstChild.appendChild( div );
										} else {
											menu.appendChild( div );
										}
									}
								}
							} else {
								// Find all visible media frames (same logic as Elementor)
								const visibleFrames = Array.from( document.querySelectorAll( '.media-frame' ) ).filter(
									( frame ) => getComputedStyle( frame ).display !== 'none',
								);

								const activeFrame = visibleFrames[ visibleFrames.length - 1 ]; // most recently opened visible one

								if ( activeFrame ) {
									const menu = activeFrame.querySelector( '.media-frame-menu .media-menu' );
									if ( menu ) {
										// Remove any existing instances
										menu.querySelectorAll( '#rt-transcoder-media-library-root' ).forEach( ( el ) => el.remove() );
										// Create and append new div
										const div = document.createElement( 'div' );
										div.id = 'rt-transcoder-media-library-root';
										menu.appendChild( div );
									}
								}
							}

							const event = new CustomEvent( 'media-frame-opened' );
							document.dispatchEvent( event );
						}, 100 );
					}
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

					this.initializeMediaLibrarySidebar();
				},

				initializeMediaLibrarySidebar() {
					const hasActiveSortable = this.$el.find( 'ul.ui-sortable:not(.ui-sortable-disabled)' ).length > 0;

					if ( ! isUploadPage() && ! isFolderOrgDisabled() && ! hasActiveSortable ) {
						/**
						 * This timeout with the custom event is necessary to ensure that the media frame is fully loaded before dispatching the event.
						 */
						setTimeout( () => {
							$( '.media-frame' ).removeClass( 'hide-menu' );

							if ( window.elementor ) {
								const visibleContainers = Array.from( document.querySelectorAll( '.supports-drag-drop' ) ).filter(
									( container ) => getComputedStyle( container ).display !== 'none',
								);

								const activeContainer = visibleContainers[ visibleContainers.length - 1 ]; // most recently opened visible one

								if ( activeContainer ) {
									const menu = activeContainer.querySelector( '.media-frame-menu' );
									if ( menu ) {
										menu.querySelectorAll( '#rt-transcoder-media-library-root' ).forEach( ( el ) => el.remove() );
										const div = document.createElement( 'div' );
										div.id = 'rt-transcoder-media-library-root';
										if ( menu.firstChild ) {
											menu.firstChild.appendChild( div );
										} else {
											menu.appendChild( div );
										}
									}
								}
							} else {
								// Find all visible media frames (same logic as Elementor)
								const visibleFrames = Array.from( document.querySelectorAll( '.media-frame' ) ).filter(
									( frame ) => getComputedStyle( frame ).display !== 'none',
								);

								const activeFrame = visibleFrames[ visibleFrames.length - 1 ]; // most recently opened visible one

								if ( activeFrame ) {
									const menu = activeFrame.querySelector( '.media-frame-menu .media-menu' );
									if ( menu ) {
										// Remove any existing instances
										menu.querySelectorAll( '#rt-transcoder-media-library-root' ).forEach( ( el ) => el.remove() );
										// Create and append new div
										const div = document.createElement( 'div' );
										div.id = 'rt-transcoder-media-library-root';
										menu.appendChild( div );
									}
								}
							}

							const event = new CustomEvent( 'media-frame-opened' );
							document.dispatchEvent( event );
						}, 100 );
					}
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
		// Monitor for bulk actions
		const originalSubmit = HTMLFormElement.prototype.submit;
		HTMLFormElement.prototype.submit = function() {
			// Only handle media library forms
			const isMediaLibraryForm = this.closest( '#posts-filter' ) ||
									this.closest( '.media-frame' ) ||
									this.id === 'posts-filter' ||
									this.querySelector( '#media-search-input' ) ||
									this.closest( '.upload-php' ) ||
									this.closest( '.media-modal' );

			if ( isMediaLibraryForm ) {
				const actionSelect = this.querySelector( 'select[name="action"], select[name="action2"]' );
				const isBulkDelete = actionSelect && actionSelect.value === 'delete';

				if ( isBulkDelete ) {
					// Set up a delayed event trigger for bulk deletion
					setTimeout( () => {
						const event = new CustomEvent( 'godam-attachment-browser:changed' );
						document.dispatchEvent( event );
					}, 1000 ); // Longer delay for bulk operations
				}
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
