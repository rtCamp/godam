/**
 * Media Table Row Drag Handler
 *
 * A modular, class-based solution for making WordPress media library table rows
 * draggable with multi-selection support and visual feedback.
 *
 * Features:
 * - Drag and drop functionality for media table rows
 * - Multi-selection support for list view
 */

/* global jQuery */

/**
 * Internal dependencies
 */
import { isFolderOrgDisabled } from '../utility';

/**
 * MediaListViewTableDragHandler Class
 *
 * Handles drag and drop functionality for WordPress media library list view items.
 */
class MediaListViewTableDragHandler {
	/**
	 * Constructor
	 *
	 * @param {Object} $ - jQuery instance (optional, defaults to global jQuery)
	 */
	constructor( $ = jQuery ) {
		this.$ = $;
		this.tableRows = null;

		this.init();
	}

	/**
	 * Initialize the drag handler
	 *
	 * Sets up drag functionality for all media table rows if folder organization is enabled.
	 */
	init() {
		if ( isFolderOrgDisabled() ) {
			return;
		}

		this.tableRows = document.querySelectorAll( '.wp-list-table.media tbody tr' );
		window.addEventListener( 'godam:lockedFolderLoaded', ( e ) => {
			const { ids } = e.detail;
			const params = new URLSearchParams( window.location.search );
			const mediaFolderId = parseInt( params.get( 'media-folder' ) );

			if ( ids && ids.length > 0 && mediaFolderId && ! ids.includes( mediaFolderId ) ) {
				this.setupDragHandlers();
			} else if ( ids.includes( mediaFolderId ) ) {
				jQuery( '#wpbody-content .page-title-action' ).prop( 'disabled', true )
					.css( {
						'pointer-events': 'none',
						opacity: '0.5',
					} );
			}
		} );

		// This check is done here to ensure drag handlers are set up on initial load if applicable.
		const params = new URLSearchParams( window.location.search );
		const mediaFolderId = parseInt( params.get( 'media-folder' ) );
		if ( ! mediaFolderId ) { // Only set up if no media folder is currently selected in the URL (for all media and uncategorized pages)
			this.setupDragHandlers();
		}
	}

	/**
	 * Set up drag handlers for all table rows
	 *
	 * Iterates through each table row and applies drag functionality.
	 */
	setupDragHandlers() {
		this.tableRows?.forEach( ( row ) => {
			this.setupRowDragHandler( this.$( row ) );
		} );
	}

	/**
	 * Set up drag handler for a single table row
	 *
	 * @param {jQuery} $row - jQuery object representing the table row
	 */
	setupRowDragHandler( $row ) {
		this.addDragHandle( $row );
		this.makeDraggable( $row );
	}

	/**
	 * Add drag handle icon to the check column
	 *
	 * @param {jQuery} $row - jQuery object representing the table row
	 */
	addDragHandle( $row ) {
		const checkColumn = $row.find( '.check-column' );

		if ( checkColumn?.length === 0 ) {
			return;
		}

		const dragHandle = this.createDragHandle();
		checkColumn?.append?.( dragHandle );
	}

	/**
	 * Create drag handle element
	 *
	 * @return {jQuery} jQuery object representing the drag handle
	 */
	createDragHandle() {
		return this.$( '<span>', {
			class: 'drag-handle',
			html: '⋮⋮',
			css: {
				cursor: 'grab',
				padding: '5px',
				color: '#666',
				fontSize: '14px',
				display: 'inline-block',
				marginLeft: '5px',
				verticalAlign: 'middle',
			},
			title: 'Drag to move',
		} );
	}

	/**
	 * Make a table row draggable
	 *
	 * @param {jQuery} $row - jQuery object representing the table row
	 */
	makeDraggable( $row ) {
		$row?.draggable?.( {
			cursor: 'move',
			helper: () => this.createDragHelper( $row ),
			opacity: 0.7,
			appendTo: 'body',
			cursorAt: { top: 5, left: 5 },
		} );
	}

	/**
	 * Create drag helper element
	 *
	 * @param {jQuery} $row - jQuery object representing the current row being dragged
	 * @return {jQuery} jQuery object representing the drag helper
	 */
	createDragHelper( $row ) {
		const draggedItems = this.getDraggedItems( $row );
		const itemCount = draggedItems?.length ?? 0;
		const helperText = `Moving ${ itemCount } item${ itemCount > 1 ? 's' : '' }`;

		$row?.data?.( 'draggedItems', draggedItems );

		return this.$( '<div>', {
			text: helperText,
			css: {
				background: '#333',
				color: '#fff',
				padding: '8px 12px',
				borderRadius: '4px',
				fontSize: '14px',
				fontWeight: 'bold',
				boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
				zIndex: 160001,
				pointerEvents: 'none',
				position: 'relative',
				whiteSpace: 'nowrap',
			},
		} );
	}

	/**
	 * Get array of item IDs being dragged
	 *
	 * @param {jQuery} $row - jQuery object representing the current row
	 * @return {Array} Array of item IDs being dragged
	 */
	getDraggedItems( $row ) {
		const selectedCheckboxes = this.$( '.wp-list-table.media tbody input[type="checkbox"]:checked' );
		let draggedItemIds = [];

		selectedCheckboxes?.each?.( ( index, checkbox ) => {
			const itemId = this.$( checkbox )?.val?.();
			if ( itemId ) {
				draggedItemIds.push( itemId );
			}
		} );

		// If no items are selected, use the current row's item ID
		if ( draggedItemIds.length === 0 ) {
			const currentCheckbox = $row.find( 'input[type="checkbox"]' );
			const currentItemId = currentCheckbox?.val?.();
			if ( currentItemId ) {
				draggedItemIds = [ currentItemId ];
			}
		}

		return draggedItemIds;
	}

	/**
	 * Refresh drag handlers
	 *
	 * Useful when new rows are added dynamically to the table.
	 *
	 * Note: not used in the current implementation, but can be useful
	 */
	refresh() {
		this.destroy();
		this.init();
	}

	/**
	 * Destroy drag handlers
	 *
	 * Removes all drag functionality.
	 *
	 * Note: not used in the current implementation, but can be useful
	 */
	destroy() {
		this.tableRows?.forEach( ( row ) => {
			const $row = this.$( row );
			if ( $row?.hasClass?.( 'ui-draggable' ) ) {
				$row?.draggable?.( 'destroy' );
			}
			$row?.find?.( '.drag-handle' )?.remove?.();
		} );
	}

	/**
	 * Get dragged items data from a row
	 *
	 * Note: not used in the current implementation, but can be useful
	 *
	 * @param {jQuery} $row - jQuery object representing the table row
	 * @return {Array} Array of dragged item IDs
	 */
	getDraggedItemsData( $row ) {
		return $row?.data?.( 'draggedItems' ) ?? [];
	}
}

export default MediaListViewTableDragHandler;
