/**
 * GoDAM Media Frame Shared
 *
 * Shared functionality for GoDAM integration in WordPress media frames.
 * Used by both MediaFrame.Select and MediaFrame.Post to provide consistent
 * GoDAM tab functionality and virtual attachment creation.
 */

/**
 * Internal dependencies
 */
import { getQuery } from '../utility.js';

const l10n = wp?.media?.view?.l10n;

/**
 * Check if the current frame is a featured image context.
 *
 * Note: This will not cover the media modal opened from the core feature image block.
 *
 * @since n.e.x.t
 *
 * @param {*} frame
 * @return {boolean} True if featured image context, false otherwise.
 */
const checkIfFeatureImage = ( frame ) => {
	// Check if this is a featured image context.
	if ( frame && frame.state && frame.state() ) {
		const state = frame.state();
		const stateId = state.id || '';

		// Featured image context
		if ( stateId === 'featured-image' || frame.id === 'featured-image' ) {
			return true;
		}
	}

	// Check frame title for featured image
	if ( frame && frame.title && typeof frame.title === 'string' ) {
		if ( frame.title.toLowerCase().includes( 'featured' ) ) {
			return true;
		}
	}

	return false;
};

/**
 * Shared object containing GoDAM-specific media frame functionality
 */
const GoDAMMediaFrameShared = {
	browseRouter( routerView ) {
		const isFeatureImage = checkIfFeatureImage( this );

		if ( window.godamTabCallback && window.godamTabCallback.validAPIKey && ! isFeatureImage ) {
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

		let mimeTypes = state.get( 'library' )?.props?.get( 'type' );

		if ( ! mimeTypes ) {
			mimeTypes = 'all';
		} else {
			mimeTypes = Array.isArray( mimeTypes ) ? mimeTypes.join( '-' ) : mimeTypes;
		}

		this.$el.removeClass( 'hide-toolbar' );

		// Browse our library of attachments.
		const RenderedContent = new wp.media.view.AttachmentsBrowser( {
			controller: this,
			collection: getQuery( { controller: this, type: mimeTypes } ),
			selection: state.get( 'selection' ),
			model: state,
		} );

		this.content.set( RenderedContent );

		// Attaches callback to create attachment entry in WordPress for GoDAM Video.
		if ( 'video' === mimeTypes ) {
			state.off( 'select', this.onGoDAMSelect, this );
			state.on( 'select', this.onGoDAMSelect, this );
		}
	},

	onGoDAMSelect() {
		// Use the actual content mode instead of stale state
		const isGodamTab = this.content.mode() === 'godam';

		if ( ! isGodamTab ) {
			return;
		}

		const selection = this.state().get( 'selection' );
		const selected = selection?.first();
		const data = selected.attributes;

		// API call to website to create the attachment.
		fetch( '/wp-json/godam/v1/media-library/create-media-entry', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': window.wpApiSettings?.nonce,
			},
			body: JSON.stringify( {
				id: data.id,
				title: data.title,
				filename: data.filename,
				name: data.title,
				url: data.url,
				hls_url: data.hls_url,
				mpd_url: data.mpd_url,
				mime: 'video/mp4',
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
				caption: data.caption,
				description: data.description,
			} ),
		} )
			.then( ( res ) => res.json() )
			.then( ( response ) => {
				if ( response && response.success ) {
					const attachment = response.attachment;

					// Trigger custom JS event godam-virtual-attachment-created
					const event = new CustomEvent( 'godam-virtual-attachment-created', {
						detail: { virtualMediaId: data.id, attachment },
					} );

					document.dispatchEvent( event );
				}
			} );
	},
};

export default GoDAMMediaFrameShared;
