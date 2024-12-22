/**
 * Internal dependencies
 */
import '../../libs/jquery-ui-1.14.1/jquery-ui';

const $ = jQuery;

console.log( 'Media Library JS loaded' );

document.addEventListener( 'DOMContentLoaded', function() {
	const mediaLibraryRoot = document.createElement( 'div' );
	mediaLibraryRoot.id = 'rt-transcoder-media-library-root';
	const wpbody = document.querySelector( '#wpbody' );
	wpbody.insertBefore( mediaLibraryRoot, wpbody.firstChild );
} );

async function assignToFolder( attachmentIds, folderTermId ) {
	await fetch( '/wp-json/easydam/v1/media-library/assign-folder', {
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
				},
			} );
		},
		opacity: 0.7,
		zIndex: 1000,
		appendTo: 'body',
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

$( 'th.check-column' ).draggable( {
	cursor: 'move',
	helper( event ) {
		const hoverItem = $( event.currentTarget );
		const hoveredCheckbox = $( event.target ).closest( 'th.check-column' ).find( 'input[type="checkbox"]' );
		const selectedCheckboxes = $( '.table-view-list th.check-column input[type="checkbox"]:checked' );

		const elementsToDrag = selectedCheckboxes.add( hoveredCheckbox );

		const draggedItemIds = elementsToDrag.map( function() {
			return Number.parseInt( $( this ).val() ); // Fetch the `value` attribute of the input element
		} ).get();

		hoverItem.data( 'draggedItems', draggedItemIds );

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
			},
		} );
	},
	opacity: 0.7,
	zIndex: 1000,
	appendTo: 'body',
} );

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

if ( wp.media?.view ) {
	( function() {
		const MediaLibraryTaxonomyFilter = wp.media.view.AttachmentFilters.extend( {
			id: 'media-folder-filter',

			events: {
				change: 'change',
			},

			change( event ) {
				if ( event.detail ) {
					this.filters[ event.detail.term_id ] = {
						text: event.detail.name,
						props: {
							'media-folder': event.detail.term_id,
						},
					};
				} else {
					const props = this.filters[ this.el.value ].props;
					this.model.set( props );
				}
			},

			createFilters() {
				const filters = {};
				_.each( MediaLibraryTaxonomyFilterData.terms || {}, function( value, index ) {
					filters[ value.term_id ] = {
						text: value.name,
						props: {
							'media-folder': value.term_id,
						},
					};
				} );

				filters.uncategorized = {
					text: 'Uncategorized',
					props: {
						'media-folder': 0,
					},
					priority: 5,
				};

				filters.all = {
					text: 'All collections',
					props: {
						'media-folder': -1,
					},
					priority: 10,
				};
				this.filters = filters;
			},

			addOption( e ) {
				console.log( 'New folder created:', e.detail );
			},
		} );

		// Extend and override wp.media.view.AttachmentsBrowser to include our new filter
		const AttachmentsBrowser = wp.media.view.AttachmentsBrowser;
		wp.media.view.AttachmentsBrowser = wp.media.view.AttachmentsBrowser.extend( {
			createToolbar() {
				// Make sure to load the original toolbar
				AttachmentsBrowser.prototype.createToolbar.call( this );
				this.toolbar.set(
					'MediaLibraryTaxonomyFilter',
					new MediaLibraryTaxonomyFilter( {
						controller: this.controller,
						model: this.collection.props,
						priority: -75,
					} ).render(),
				);

				// this.toolbar.unset( 'MediaLibraryTaxonomyFilter' );
			},
		} );
	}() );
}

// Add Button to Dynamically Add Terms

