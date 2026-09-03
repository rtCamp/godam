/**
 * External dependencies
 */
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { openMoveToFolder, updateSnackbar } from '../redux/slice/folders';
import { MOVE_TO_FOLDER_OPEN_EVENT } from '../data/move-to-folder-bridge';
import { useSidebarRoot } from '../context/sidebar-root.jsx';

/**
 * Open the "Move to folder" picker when a wp.media-side trigger asks for it.
 *
 * The grid toolbar button, the list-view bulk action and the attachment details
 * field all live in the Backbone bundle and reach the sidebar through a document
 * event. They ship the attachment ids in the payload, so this app never has to
 * observe the `selection` collection itself.
 */
const useMoveToFolderBridge = () => {
	const dispatch = useDispatch();
	const sidebarRoot = useSidebarRoot();

	useEffect( () => {
		const handleMoveRequest = ( event ) => {
			const { root, attachmentIds = [], source } = event.detail || {};

			// Only the app owning this frame's sidebar responds, so a click in one
			// media frame can't open a picker in every mounted app.
			if ( root && sidebarRoot && root !== sidebarRoot ) {
				return;
			}

			if ( ! attachmentIds.length ) {
				dispatch( updateSnackbar( {
					message: __( 'Select one or more media items to move.', 'godam' ),
					type: 'fail',
				} ) );
				return;
			}

			dispatch( openMoveToFolder( { attachmentIds, source } ) );
		};

		document.addEventListener( MOVE_TO_FOLDER_OPEN_EVENT, handleMoveRequest );

		return () => {
			document.removeEventListener( MOVE_TO_FOLDER_OPEN_EVENT, handleMoveRequest );
		};
	}, [ dispatch, sidebarRoot ] );
};

export default useMoveToFolderBridge;
