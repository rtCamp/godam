/**
 * Internal dependencies
 */
import '../../libs/jquery-ui-1.14.1.draggable/jquery-ui';
import './transcoding-status';

import AttachmentsBrowser from './views/attachment-browser.js';

/**
 * MediaLibrary class.
 */
class MediaLibrary {
	constructor() {
		this.setupAttachmentBrowser();
	}

	setupAttachmentBrowser() {
		wp.media.view.AttachmentsBrowser = AttachmentsBrowser;
	}
}

const mediaLibrary = new MediaLibrary();

export default mediaLibrary;

const $ = jQuery;

document.addEventListener( 'DOMContentLoaded', function() {
	const mediaLibraryRoot = document.createElement( 'div' );
	mediaLibraryRoot.id = 'rt-transcoder-media-library-root';
	const wpbody = document.querySelector( '#wpbody' );
	wpbody.insertBefore( mediaLibraryRoot, wpbody.firstChild );
} );

async function assignToFolder( attachmentIds, folderTermId ) {
	const response = await fetch( '/wp-json/easydam/v1/media-library/assign-folder', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-WP-Nonce': wpApiSettings.nonce,
		},
		body: JSON.stringify( {
			attachment_ids: attachmentIds,
			folder_term_id: folderTermId,
		} ),
	} );

	if ( response.ok ) {
		// Remove the dragged items from the list
		attachmentIds.forEach( ( id ) => {
			$( `li.attachment[data-id="${ id }"]` ).remove();
		} );
	}
}

const attachDragEvent = () => {
	// Initialize draggable items
	$( 'li.attachment' ).draggable( {
		cursor: 'move',
		helper( event ) {
			const hoveredElement = $( event.currentTarget );
			const selectedElements = $( '.attachments-wrapper li.attachment.selected' );
			const elementsToDrag = selectedElements.add( hoveredElement );

			const draggedItemIds = elementsToDrag.map( function() {
				return $( this ).data( 'id' );
			} ).get();

			hoveredElement.data( 'draggedItems', draggedItemIds );

			return $( '<div>', {
				text: `Moving ${ draggedItemIds.length } item${ draggedItemIds.length > 1 ? 's' : '' }`,
				css: {
					background: '#333',
					color: '#fff',
					padding: '8px 12px',
					borderRadius: '4px',
					fontSize: '14px',
					fontWeight: 'bold',
					boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
					zIndex: 1000,
					PointerEvent: 'none',
				},
			} );
		},
		opacity: 0.7,
		zIndex: 1000,
		appendTo: 'body',
		cursorAt: { top: 5, left: 5 },
	} );

	// Initialize droppable tree items
	$( '.tree-item' ).droppable( {
		accept: 'li.attachment, th.check-column',
		hoverClass: 'droppable-hover',
		tolerance: 'pointer',
		drop( event, ui ) {
			const draggedItems = ui.draggable.data( 'draggedItems' );

			if ( draggedItems ) {
				const targetFolderId = $( event.target ).data( 'id' );
				assignToFolder( draggedItems, targetFolderId );
			}
		},
	} );

	// Add hover effect styles dynamically
	if ( ! $( '#drag-drop-styles' ).length ) {
		$( '<style>', {
			id: 'drag-drop-styles',
			text: `
				.droppable-hover {
					background: #e0f7fa !important;
					border: 2px dashed #00796b;
				}
			`,
		} ).appendTo( 'head' );
	}
};

setTimeout( attachDragEvent, 1000 );

/**
 * On AJAX complete, check if the request is for 'query-attachments' and attach the drag event
 */
jQuery( document ).ajaxComplete( function( event, jqXHR, ajaxOptions ) {
	if ( ajaxOptions.url === '/wp-admin/admin-ajax.php' ) {
		const params = new URLSearchParams( ajaxOptions.data );
		const action = params.get( 'action' );

		if ( action === 'query-attachments' ) {
			attachDragEvent();
		}
	}
} );
