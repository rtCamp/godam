/* global jQuery */

/**
 * Internal dependencies
 */
import ListViewTranscodingStatus from './transcoding-status/list-view-transcoding-status';
import GridViewTranscodingStatus from './transcoding-status/grid-view-transcoding-status';

import { checkMediaLibraryView } from './utility';

if ( 'list' === checkMediaLibraryView() ) {
	new ListViewTranscodingStatus();
} else {
	let gridView;

	const initGridView = () => {
		if ( ! gridView ) {
			gridView = new GridViewTranscodingStatus();
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

	if ( wp?.Uploader ) {
		( function( $ ) {
			$.extend( wp.Uploader.prototype, {
				success() {
					// Add this new attachment to the collection.
					gridView.reAttachEvent();
				},
			} );
		}( jQuery ) );
	}
}
