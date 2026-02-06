/* global _ */

/**
 * WordPress dependencies
 */
// The `wp.i18n` global is imported via the `wp-i18n` script dependency.
const { __, sprintf } = wp.i18n;

/**
 * Internal dependencies
 */
import MediaLibraryTaxonomyFilter from './filters/media-library-taxonomy-filter';
import MediaDateRangeFilter from './filters/media-date-range-filter';
import MediaRetranscode from './filters/media-retranscode';

import { isAPIKeyValid, isUploadPage } from '../utility';

const AttachmentsBrowser = wp?.media?.view?.AttachmentsBrowser;

/**
 * Extends the AttachmentsBrowser to add custom functionality,
 * including a fix for the pagination count display.
 */
export default AttachmentsBrowser?.extend( {
	/**
	 * Initializes the view, binding events to update the pagination count.
	 */
	initialize() {
		// Call the parent class's initialize method.
		AttachmentsBrowser.prototype.initialize.apply( this, arguments );

		this.updateCollectionObserve();
		this.addUploadParam(); // Note: bindEvents is called by the parent `initialize`.

		/**
		 * The key to the fix is listening for the 'change:total' event on the collection's props.
		 * This event fires specifically when the total item count is updated from the server response.
		 * We also listen to standard collection events to keep the 'loaded' count accurate.
		 *
		 * @see https://backbonejs.org/#Events-catalog
		 * @see https://backbonejs.org/#Collection-Events
		 */
		this.collection.props.on( 'change:total', this.updateCount, this );
		this.collection.on( 'add remove reset', this.updateCount, this );

		// We also need to run the update when the toolbar is created and ready.
		this.on( 'ready', this.updateCount, this );
	},

	/**
	 * Updates the attachment count in the media library toolbar.
	 *
	 * Reads the number of loaded attachments and the total number of attachments
	 * from the collection to display an accurate "Showing X of Y" count.
	 */
	updateCount() {
		// Defer the execution slightly to ensure all DOM elements and properties are available.
		_.defer( () => {
			if ( ! this.toolbar || ! this.toolbar.$el || ! this.toolbar.$el.length ) {
				return;
			}

			const loadedCount = this.collection.length;
			const totalCount = this.collection.props.get( 'total' );
			const $countContainer = this.toolbar.$( '.count' );

			// Only update the text if we have a valid total count.
			if ( totalCount && $countContainer.length ) {
				$countContainer.text(
					sprintf(
						/* translators: 1: number of media items shown, 2: total number of media items */
						__( 'Showing %1$d of %2$d media items', 'godam' ),
						loadedCount,
						totalCount,
					),
				);
			}
		} );
	},

	async createToolbar() {
		// Make sure to load the original toolbar
		AttachmentsBrowser.prototype.createToolbar.call( this );

		let showFoldersInMediaLibrary = false;
		if ( ! isUploadPage() ) {
			try {
				const settings = await getGodamSettings();
				showFoldersInMediaLibrary = settings?.general?.enable_folder_organization === true;
			} catch ( error ) {
				// Silently fail if settings cannot be fetched.
			}
		}

		if ( ToggleFoldersButton && ! isUploadPage() && showFoldersInMediaLibrary ) {
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
	},

	/**
	 * Enable/disable observation of uploading queue.
	 */
	updateCollectionObserve() {
		if ( ! wp.Uploader ) {
			return;
		}

		const currentQuery = this.collection.props.toJSON();

		// Observe the central `wp.Uploader.queue` collection to watch for
		// new matches for the query.
		//
		// Only observe when a limited number of query args are set. There
		// are no filters for other properties, so observing will result in
		// false positives in those queries.
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

		// Fire a event notifying that the collection param has been changed.
		const event = new CustomEvent( 'godam-attachment-browser:changed' );
		document.dispatchEvent( event );
	},
} );