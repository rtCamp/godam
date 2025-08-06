/* global jQuery, _ */

/**
 * WordPress dependencies
 */
const { __, sprintf } = wp.i18n;

/**
 * Internal dependencies
 */
import MediaLibraryTaxonomyFilter from './filters/media-library-taxonomy-filter';
import MediaDateRangeFilter from './filters/media-date-range-filter';
import MediaRetranscode from './filters/media-retranscode';
import ToggleFoldersButton from './filters/toggle-folders-button';

// This function was added in the main branch and is needed.
import { isAPIKeyValid, isUploadPage, isFolderOrgDisabled, getGodamSettings } from '../utility';

const AttachmentsBrowser = wp?.media?.view?.AttachmentsBrowser;

const $ = jQuery;

/**
 * Attachment Browser with Custom Filters
 */
export default AttachmentsBrowser?.extend( {

	initialize() {
		// Initialize the parent class.
		AttachmentsBrowser.prototype.initialize.apply( this, arguments );

		this.updateCollectionObserve();
		this.bindEvents();
		this.addUploadParam();

		// Your fix: Call the count update method on initialization and when items are added.
		this.collection.on( 'add remove reset', this.updateCount, this );
		this.updateCount();
	},

	bindEvents() {
		this.collection.props.on( 'change', this.updateCollectionObserve, this );
		this.collection.props.on( 'change', this.addUploadParam, this );
	},

	/**
	 * Your fix: This is the new method to correctly update the media count display.
	 */
	updateCount() {
		// Ensure the toolbar and count element exist before proceeding.
		if ( ! this.toolbar || ! this.toolbar.$el ) {
			return;
		}

		// Get the number of attachments currently loaded in the browser.
		const loadedCount = this.collection.length;

		// Get the absolute total number of attachments from the collection's properties.
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

	/**
	 * This is the updated async function from the main branch.
	 */
	async createToolbar() {
		// Make sure to load the original toolbar
		AttachmentsBrowser.prototype.createToolbar.call( this );

		let showFoldersInMediaLibrary = false;
		if ( ! isUploadPage() ) {
			try {
				const settings = await getGodamSettings();
				showFoldersInMediaLibrary = settings?.general?.enable_folder_organization === true;
			} catch ( error ) {
				// Handle error if needed
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

		if ( ! isUploadPage() && ! isFolderOrgDisabled() ) {
			setTimeout( () => {
				$( '.media-frame' ).removeClass( 'hide-menu' );

				if ( window.elementor ) {
					const visibleContainers = Array.from( document.querySelectorAll( '.supports-drag-drop' ) ).filter(
						( container ) => getComputedStyle( container ).display !== 'none',
					);

					const activeContainer = visibleContainers.at( -1 );

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