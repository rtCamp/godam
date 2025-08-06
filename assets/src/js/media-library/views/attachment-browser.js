/* global jQuery, _ */

/**
 * WordPress dependencies
 */
// FIX START: Import internationalization functions.
const { __, sprintf } = wp.i18n;

/**
 * Internal dependencies
 */
import MediaLibraryTaxonomyFilter from './filters/media-library-taxonomy-filter';
import MediaDateRangeFilter from './filters/media-date-range-filter';
import MediaRetranscode from './filters/media-retranscode';
import ToggleFoldersButton from './filters/toggle-folders-button';

import { isAPIKeyValid, isUploadPage, isFolderOrgDisabled } from '../utility';

const AttachmentsBrowser = wp?.media?.view?.AttachmentsBrowser;

const $ = jQuery;

/**
 * Attachment Browser with Custom Filters
 *
 * Note: Exporting the `extend` object directly works as expected.
 * However, reassigning it to a variable before exporting causes an infinite loop.
 */
export default AttachmentsBrowser?.extend( {

	initialize() {
		// Initialize the parent class.
		AttachmentsBrowser.prototype.initialize.apply( this, arguments );

		this.updateCollectionObserve();
		this.bindEvents();
		this.addUploadParam();

		// FIX START: Call the count update method on initialization and when items are added.
		this.collection.on( 'add remove reset', this.updateCount, this );
		this.updateCount();
		// FIX END
	},

	bindEvents() {
		this.collection.props.on( 'change', this.updateCollectionObserve, this );
		this.collection.props.on( 'change', this.addUploadParam, this );
	},

	// FIX START: Add the method to correctly update the media count display.
	/**
	 * Updates the attachment count in the toolbar.
	 *
	 * This function correctly distinguishes between the number of loaded items
	 * and the total number of items available in the library from the server.
	 */
	updateCount() {
		// Ensure the toolbar and count element exist before proceeding.
		if ( ! this.toolbar || ! this.toolbar.$el ) {
			return;
		}

		// Get the number of attachments currently loaded in the browser.
		const loadedCount = this.collection.length;

		// Get the absolute total number of attachments from the collection's properties.
		// This value comes from the server's AJAX response (`found_posts`).
		// The `|| 0` is a fallback in case it's not set.
		const totalCount = this.collection.props.get( 'total' ) || 0;

		const $countContainer = this.toolbar.$( '.count' );

		if ( totalCount > 0 && $countContainer.length ) {
			const text = sprintf(
				/* translators: 1: number of media items shown, 2: total number of media items */
				__( 'Showing %1$d of %2$d media items', 'godam' ),
				loadedCount,
				totalCount
			);
			$countContainer.text( text );
		} else if ( $countContainer.length ) {
			$countContainer.text( __( 'No media items found.', 'godam' ) );
		}
	},
	// FIX END

	createToolbar() {
		// Make sure to load the original toolbar
		AttachmentsBrowser.prototype.createToolbar.call( this );

		// ... (the rest of your createToolbar function remains unchanged) ...
		if ( ToggleFoldersButton && ! isUploadPage() ) {
			this.toolbar.set(
				'ToggleFoldersButton',
				new ToggleFoldersButton( {
					controller: this.controller,
					model: this.collection.props,
					priority: -105,
				} ).render(),
			);
		}

		if ( MediaLibraryTaxonomyFilter ) {
			this.toolbar.set(
				'MediaLibraryTaxonomyFilter',
				new MediaLibraryTaxonomyFilter( {
					controller: this.controller,
					model: this.collection.props,
					priority: -75,
				} ).render(),
			);
		}

		if ( MediaDateRangeFilter ) {
			this.toolbar.set(
				'MediaDateRangeFilter',
				new MediaDateRangeFilter( {
					controller: this.controller,
					model: this.collection.props,
					priority: -80,
				} ).render(),
			);
		}

		if ( isAPIKeyValid() && isUploadPage() ) {
			if ( MediaRetranscode ) {
				this.toolbar.set(
					'MediaRetranscode',
					new MediaRetranscode( {
						controller: this.controller,
						model: this.collection.props,
						priority: -75,
					} ).render(),
				);
			}
		}

		if ( ! isUploadPage() && ! isFolderOrgDisabled() ) {
			/**
			 * This timeout with the custom event is necessary to ensure that the media frame is fully loaded before dispatching the event.
			 */
			setTimeout( () => {
				$( '.media-frame' ).removeClass( 'hide-menu' );

				if ( window.elementor ) {
					const visibleContainers = Array.from( document.querySelectorAll( '.supports-drag-drop' ) ).filter(
						( container ) => getComputedStyle( container ).display !== 'none',
					);

					const activeContainer = visibleContainers.at( -1 ); // most recently opened visible one

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
					const menu = $( '.media-frame' ).find( '.media-frame-menu' );

					if ( menu.length ) {
						menu.append( '<div id="rt-transcoder-media-library-root"></div>' );
					}
				}

				const event = new CustomEvent( 'media-frame-opened' );
				document.dispatchEvent( event );
			}, 50 );
		}
	},

	/**
	 * Enable/disable observation of uploading queue.
	 */
	updateCollectionObserve() {
		// ... (this function remains unchanged) ...
		if ( ! wp.Uploader ) {
			return;
		}

		const currentQuery = this.collection.props.toJSON();

		const allowed = [
			's',
			'search',
			'order',
			'orderby',
			'posts_per_page',
			'post_mime_type',
			'post_parent',
			'author',
			'query',
			'media-folder',
			'type',
		];

		if ( _( currentQuery ).chain().keys().difference( allowed ).isEmpty().value() ) {
			this.collection.observe( wp.Uploader.queue );
		} else {
			this.collection.unobserve( wp.Uploader.queue );
		}
	},

	/**
	 * Add the media folder to the upload params.
	 */
	addUploadParam() {
		// ... (this function remains unchanged) ...
		if ( 'undefined' === typeof this.controller.uploader.uploader ) {
			return;
		}

		const uploader = this.controller.uploader.uploader.uploader;
		const mediaFolder = this.collection.props.get( 'media-folder' );

		let multipartParams = {};

		multipartParams = {
			'media-folder': mediaFolder,
		};

		multipartParams = _.extend( uploader.getOption( 'multipart_params' ), multipartParams );

		uploader.setOption( 'multipart_params', multipartParams );

		const event = new CustomEvent( 'godam-attachment-browser:changed' );
		document.dispatchEvent( event );
	},
} );