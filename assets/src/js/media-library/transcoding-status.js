/* global jQuery */

/**
 * Internal dependencies
 */
import ListViewTranscodingStatus from './transcoding-status/list-view-transcoding-status';
import GridViewTranscodingStatus from './transcoding-status/grid-view-transcoding-status';

import { checkMediaLibraryView } from './utility';

// Set up upload success handler for both list and grid views
if ( wp?.Uploader ) {
	( function( $ ) {
		$.extend( wp.Uploader.prototype, {
			success() {
				// Trigger count refresh for React components - works for both list and grid views
				const event = new CustomEvent( 'godam-attachment-browser:changed' );
				document.dispatchEvent( event );

				// For grid view, also re-attach transcoding events
				if ( 'list' !== checkMediaLibraryView() && window.gridView ) {
					window.gridView.reAttachEvent();
				}
			},
		} );
	}( jQuery ) );
}

if ( 'list' === checkMediaLibraryView() ) {
	new ListViewTranscodingStatus();
} else {
	let gridView;

	const initGridView = () => {
		if ( ! gridView ) {
			gridView = new GridViewTranscodingStatus();
			// Make gridView accessible globally for the upload success handler
			window.gridView = gridView;
		}
	};

	document.addEventListener( 'godam-attachment-browser:changed', () => {
		initGridView();

		const checkInterval = setInterval( () => {
			const statusItems = document.querySelectorAll( '.transcoding-status' );
			if ( statusItems.length > 0 ) {
				clearInterval( checkInterval );
				gridView.reAttachEvent();
			}
		}, 100 );
	} );

	document.addEventListener( 'media-frame-opened', () => {
		initGridView();
		gridView.reAttachEvent();
	} );
}
