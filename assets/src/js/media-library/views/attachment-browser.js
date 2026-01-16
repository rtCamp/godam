/* global _ */

/**
 * Internal dependencies
 */
import MediaLibraryTaxonomyFilter from './filters/media-library-taxonomy-filter';
import MediaDateRangeFilter from './filters/media-date-range-filter';
import MediaCategoryFilter from './filters/media-category-filter';
import MediaTagFilter from './filters/media-tag-filter';
import MediaRetranscode from './filters/media-retranscode';

import { isAPIKeyValid, isUploadPage } from '../utility';

const AttachmentsBrowser = wp?.media?.view?.AttachmentsBrowser;

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
	},

	bindEvents() {
		this.collection.props.on( 'change', this.updateCollectionObserve, this );
		this.collection.props.on( 'change', this.addUploadParam, this );
	},

	async createToolbar() {
		// Make sure to load the original toolbar
		AttachmentsBrowser.prototype.createToolbar.call( this );

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

		if ( MediaCategoryFilter ) {
			this.toolbar.set(
				'MediaCategoryFilter',
				new MediaCategoryFilter( {
					controller: this.controller,
					model: this.collection.props,
					priority: -80,
				} ).render(),
			);
		}

		if ( MediaTagFilter ) {
			this.toolbar.set(
				'MediaTagFilter',
				new MediaTagFilter( {
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
