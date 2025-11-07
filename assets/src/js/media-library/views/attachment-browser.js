/* global jQuery, _ */

/**
 * Internal dependencies
 */
import MediaLibraryTaxonomyFilter from './filters/media-library-taxonomy-filter';
import MediaDateRangeFilter from './filters/media-date-range-filter';
import MediaRetranscode from './filters/media-retranscode';

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
					// Find all visible media frames (same logic as Elementor)
					const visibleFrames = Array.from( document.querySelectorAll( '.media-frame' ) ).filter(
						( frame ) => getComputedStyle( frame ).display !== 'none',
					);

					const activeFrame = visibleFrames.at( -1 ); // most recently opened visible one

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
			}, 50 );
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
