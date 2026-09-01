/**
 * GoDAM Media Frame Shared
 *
 * Shared functionality for GoDAM integration in WordPress media frames.
 * Used by both MediaFrame.Select and MediaFrame.Post to provide consistent
 * GoDAM tab functionality and virtual attachment creation.
 */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { select, dispatch } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { getQuery } from '../utility.js';
import { setupClassicFeaturedImage, resolveClassicFeaturedImage } from '../classic-featured-image.js';
import { ALLOWED_MEDIA_TYPES as DOCUMENT_MIME_TYPES } from '../../../blocks/godam-pdf/constants.js';

const l10n = wp?.media?.view?.l10n;

/**
 * Collapse a media-frame `type` filter into the single token the GoDAM tab endpoint expects.
 *
 * The frame's `type` prop is whatever the opener asked for, and the GoDAM tab passes it
 * straight through to Central as `job_type`. That works for a single value, but the Document
 * block requests a dozen MIME types at once — joined with "-" that produces a token Central
 * has never heard of, and the tab comes back empty.
 *
 * Any request made up purely of document MIME types is therefore reported as
 * `application/pdf`, which the REST handler already expands to `pdf,document`.
 *
 * @param {string|string[]} mimeTypes The frame's `type` prop.
 * @return {string} A token the GoDAM tab endpoint understands.
 */
function normalizeGoDAMTabType( mimeTypes ) {
	if ( ! mimeTypes ) {
		return 'all';
	}

	const types = Array.isArray( mimeTypes ) ? mimeTypes : [ mimeTypes ];

	if ( types.length && types.every( ( type ) => DOCUMENT_MIME_TYPES.includes( type ) ) ) {
		return 'application/pdf';
	}

	return types.join( '-' );
}

/**
 * Recursively collects all blocks (including inner blocks at any depth) into a flat array.
 *
 * @param {Array} blocks - Top-level blocks from the block editor store.
 * @return {Array} Flat list of all blocks.
 */
function getAllBlocksFlat( blocks ) {
	const result = [];
	for ( const block of blocks ) {
		result.push( block );
		if ( block.innerBlocks?.length ) {
			result.push( ...getAllBlocksFlat( block.innerBlocks ) );
		}
	}
	return result;
}

/**
 * Replaces the virtual GoDAM ID with the real WP attachment ID on any core/image block
 * that is currently holding the virtual ID. Handles modern core/gallery inner blocks
 * synchronously at the point of attachment creation, avoiding event-listener timing issues.
 *
 * @param {string|number} virtualMediaId - The GoDAM item ID used as a placeholder.
 * @param {number}        realId         - The newly created WP attachment ID.
 */
function replaceVirtualIdInCoreImageBlocks( virtualMediaId, realId ) {
	let blocks;
	let blockEditorDispatch;

	try {
		blocks = select( 'core/block-editor' ).getBlocks();
		blockEditorDispatch = dispatch( 'core/block-editor' );
	} catch {
		// Not in a block-editor context (e.g. classic editor / media library screen).
		return;
	}

	if ( ! Array.isArray( blocks ) || blocks.length === 0 ) {
		return;
	}

	const allBlocks = getAllBlocksFlat( blocks );

	for ( const block of allBlocks ) {
		if (
			block.name === 'core/image' &&
			block.attributes?.id !== undefined &&
			block.attributes?.id !== null &&
			String( block.attributes.id ) === String( virtualMediaId )
		) {
			blockEditorDispatch.updateBlockAttributes( block.clientId, { id: realId } );
		}
	}
}

/**
 * Repoints the post's featured image from the virtual GoDAM ID to the real WP
 * attachment ID.
 *
 * The featured image is not a block attribute — `core/post-featured-image` (and the
 * document sidebar's Featured image panel) writes it to the post entity's
 * `featured_media` field. So the block-attribute swap performed by
 * core-media-blocks-extension.js never reaches it: the field keeps the GoDAM job ID,
 * `getEntityRecord( 'postType', 'attachment', <job id> )` 404s, and the block renders
 * an empty placeholder with no preview.
 *
 * Core sets `featured_media` synchronously from the frame's `select` event, while the
 * attachment is created asynchronously — so by the time this runs the field already
 * holds the virtual ID and can simply be replaced. The classic editor offers no such
 * window and is handled by classic-featured-image.js instead.
 *
 * @param {string|number} virtualMediaId - The GoDAM item ID used as a placeholder.
 * @param {number}        realId         - The newly created WP attachment ID.
 */
function replaceVirtualIdInFeaturedImage( virtualMediaId, realId ) {
	let currentFeaturedMedia;

	try {
		// Undefined outside the post editor (media library screen, classic editor).
		currentFeaturedMedia = select( 'core/editor' )?.getEditedPostAttribute?.( 'featured_media' );
	} catch {
		return;
	}

	if ( currentFeaturedMedia === undefined || currentFeaturedMedia === null ) {
		return;
	}

	if ( String( currentFeaturedMedia ) !== String( virtualMediaId ) ) {
		return;
	}

	dispatch( 'core/editor' ).editPost( { featured_media: realId } );
}

/**
 * Check if the current frame is an analytics context.
 *
 * @since 1.6.0
 *
 * @param {wp.media.view.MediaFrame} frame
 * @return {boolean} True if analytics context, false otherwise.
 */
const checkIfAnalyticsContext = ( frame ) => {
	// Check if this frame was opened from the Analytics page
	if ( frame && frame.options && frame.options.godamAnalyticsContext === true ) {
		return true;
	}

	return false;
};

/**
 * Shared object containing GoDAM-specific media frame functionality
 */
const GoDAMMediaFrameShared = {
	browseRouter( routerView ) {
		const isAnalyticsContext = checkIfAnalyticsContext( this );

		if ( window.godamTabCallback && window.godamTabCallback.validAPIKey && ! isAnalyticsContext ) {
			routerView.set( {
				upload: {
					text: l10n.uploadFilesTitle,
					priority: 20,
				},
				browse: {
					text: l10n.mediaLibraryTitle,
					priority: 40,
				},
				godam: {
					text: 'GoDAM',
					priority: 60,
				},
			} );
		} else {
			routerView.set( {
				upload: {
					text: l10n.uploadFilesTitle,
					priority: 20,
				},
				browse: {
					text: l10n.mediaLibraryTitle,
					priority: 40,
				},
			} );
		}
	},

	GoDAMCreate() {
		const state = this.state();

		// Hold back a classic-editor featured image pick until its attachment exists.
		setupClassicFeaturedImage();

		const mimeTypes = normalizeGoDAMTabType(
			state.get( 'library' )?.props?.get( 'type' ),
		);

		this.$el.removeClass( 'hide-toolbar' );

		// Clear the GoDAM query cache each time the tab is activated so that
		// subsequent visits always start a fresh query (page 1, _hasMore=true).
		// Without this, stale cached queries with _hasMore=false would prevent
		// the Load More button from appearing on re-opened GoDAM tab sessions.
		if ( wp?.media?.godamQuery?.clearCache ) {
			wp.media.godamQuery.clearCache();
		}

		// Browse our library of attachments.
		const RenderedContent = new wp.media.view.AttachmentsBrowser( {
			controller: this,
			collection: getQuery( { controller: this, type: mimeTypes } ),
			selection: state.get( 'selection' ),
			model: state,
		} );

		this.content.set( RenderedContent );

		// Attaches callback to create attachment entry in WordPress for GoDAM Video.
		state.off( 'select', this.onGoDAMSelect, this );
		state.on( 'select', this.onGoDAMSelect, this );

		// Track models added to the selection while on GoDAM tab (for gallery workflow).
		// GalleryLibrary never fires 'select' — it calls setState('gallery-edit') directly.
		// We need to know which items came from GoDAM before that transition happens.
		if ( ! this._godamTrackedModels ) {
			this._godamTrackedModels = new WeakSet();
		}
		const selection = state.get( 'selection' );
		selection.off( 'add', this._onGoDAMSelectionAdd, this );
		selection.on( 'add', this._onGoDAMSelectionAdd, this );

		// GalleryEdit fires frame-level 'update' (not 'select') when "Insert gallery" is clicked.
		this.off( 'update', this.onGoDAMGalleryUpdate, this );
		this.on( 'update', this.onGoDAMGalleryUpdate, this );
	},

	async onGoDAMSelect() {
		// Use the actual content mode instead of stale state
		const isGodamTab = this.content.mode() === 'godam';

		if ( ! isGodamTab ) {
			return;
		}

		const selection = this.state().get( 'selection' );

		// Process every selected item (supports multi-select).
		selection.each( ( selected ) => {
			this.processGoDAMItem( selected );
		} );
	},

	async processGoDAMItem( selected ) {
		const data = selected.attributes;

		try {
			// apiFetch uses the WordPress REST API configuration, including nonce handling.
			const response = await apiFetch( {
				path: '/godam/v1/media-library/create-media-entry',
				method: 'POST',
				data: {
					id: data.id,
					title: data.title,
					filename: data.filename,
					name: data.title,
					url: data.url,
					hls_url: data.hls_url,
					mpd_url: data.mpd_url,
					mime: data.mime,
					type: data.type,
					subtype: data.subtype,
					status: data.status,
					date: data.date,
					modified: data.modified,
					filesizeInBytes: data.filesizeInBytes,
					filesizeHumanReadable: data.filesizeHumanReadable,
					owner: data.owner,
					label: data.label,
					icon: data.icon,
					thumbnail_url: data.thumbnail_url,
					caption: data.caption,
					description: data.description,
					video_duration: data.video_duration || 0,
					width: data.width || 0,
					height: data.height || 0,
					chapters: data.chapters || [],
					// The renderable PDF for a document. Must travel separately from mpd_url,
					// which for a converted document holds the original .docx/.xlsx.
					preview_pdf_url: data.preview_pdf_url || '',
				},
			} );

			if ( response && response.success ) {
				const attachment = response.attachment;

				// Directly update any core/image blocks (e.g. inside core/gallery) that still
				// carry the virtual GoDAM ID. This runs synchronously before the custom event
				// so that inner blocks are resolved without relying on React effect timing.
				replaceVirtualIdInCoreImageBlocks( data.id, attachment.id );

				// The featured image lives on the post entity rather than on block
				// attributes, so it needs its own swap. The classic editor gets no
				// placeholder at all — its pick was parked, and is released here.
				replaceVirtualIdInFeaturedImage( data.id, attachment.id );
				resolveClassicFeaturedImage( data.id, attachment.id );

				// Trigger custom JS event godam-virtual-attachment-created
				const event = new CustomEvent( 'godam-virtual-attachment-created', {
					detail: { virtualMediaId: data.id, attachment },
				} );

				document.dispatchEvent( event );

				// Also trigger count refresh for React components
				const countRefreshEvent = new CustomEvent( 'godam-attachment-browser:changed' );
				document.dispatchEvent( countRefreshEvent );
			}
		} catch {
			// Swallow request failures so one item does not break the rest of the selection flow.
		}
	},

	// Tracks Backbone models added to the selection while the GoDAM tab is active.
	// Called via selection.on('add', ...) registered in GoDAMCreate().
	_onGoDAMSelectionAdd( model ) {
		if ( this.content.mode() === 'godam' ) {
			if ( ! this._godamTrackedModels ) {
				this._godamTrackedModels = new WeakSet();
			}
			this._godamTrackedModels.add( model );
		}
	},

	// Handles the gallery workflow: GalleryEdit fires frame-level 'update' (not 'select')
	// when the user clicks "Insert gallery". GalleryLibrary never fires 'select' — it
	// transitions directly to gallery-edit via setState() without any select event.
	async onGoDAMGalleryUpdate( library ) {
		if ( ! this._godamTrackedModels || ! library || typeof library.each !== 'function' ) {
			return;
		}

		// Snapshot and reset so the next gallery session starts with a clean slate.
		const trackedModels = this._godamTrackedModels;
		this._godamTrackedModels = new WeakSet();

		// Only call create-media-entry for items that originated from the GoDAM tab.
		// Native WP attachments selected from the browse tab are NOT in the WeakSet.
		library.each( ( selected ) => {
			if ( trackedModels.has( selected ) ) {
				this.processGoDAMItem( selected );
			}
		} );
	},
};

export default GoDAMMediaFrameShared;
