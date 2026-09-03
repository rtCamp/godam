/**
 * External dependencies
 */
import { useCallback, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { setTree, updateSnackbar } from '../redux/slice/folders';
import { useAssignFolderMutation } from '../redux/api/folders';
import { utilities } from '../data/utilities';
import { refreshAfterMove } from '../data/media-grid';

/**
 * Folder id standing for the "All Media" view. It is a filter, not a real term,
 * so it can never be a move destination and says nothing about where the
 * selected items currently live.
 */
const ALL_MEDIA_ID = -1;

/**
 * Folder id standing for "Uncategorized" — the endpoint reads it as "strip every
 * `media-folder` term from these attachments". It is a valid destination, so the
 * picker must distinguish it from "nothing chosen yet".
 */
const UNCATEGORIZED_ID = 0;

/**
 * Move attachments between media folders.
 *
 * Single source of truth for the guard → mutate → recount → refresh sequence, so
 * the drag-and-drop path and every button path behave identically. Before this
 * existed the logic lived inline in FolderTree's jQuery UI `drop` handler and was
 * unreachable from anywhere else.
 *
 * @return {{ moveAttachments: Function, canMoveTo: Function, isMoving: boolean }} Move helpers.
 */
const useMoveAttachments = () => {
	const dispatch = useDispatch();
	const folders = useSelector( ( state ) => state.FolderReducer.folders );
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );

	const [ assignFolderMutation ] = useAssignFolderMutation();
	const [ isMoving, setIsMoving ] = useState( false );

	/**
	 * Whether a move is allowed, and why not when it isn't.
	 *
	 * These checks only ever race ahead of the server, which re-validates
	 * everything (and does so per attachment, walking folder ancestors). They
	 * exist to give instant feedback and to grey out impossible destinations.
	 *
	 * @param {number} targetFolderId Destination folder id.
	 * @param {number} sourceFolderId Folder currently being viewed.
	 * @return {{ allowed: boolean, reason: string }} Verdict plus a translated reason.
	 */
	const canMoveTo = useCallback( ( targetFolderId, sourceFolderId ) => {
		const target = Number( targetFolderId );
		const currentFolder = Number( sourceFolderId );

		if ( target === currentFolder ) {
			return { allowed: false, reason: __( 'These items are already in that folder.', 'godam' ) };
		}

		// From "All Media" the selection can span folders, so there is no single
		// source to validate — leave it to the server's per-attachment check.
		if ( currentFolder > UNCATEGORIZED_ID ) {
			const sourceFolder = folders.find( ( folder ) => folder.id === currentFolder );

			if ( sourceFolder?.meta?.locked || utilities.isAnyParentLocked( currentFolder, folders ) ) {
				return { allowed: false, reason: __( 'Currently opened folder is locked and cannot be modified', 'godam' ) };
			}
		}

		// Uncategorized is not a term, so it has no lock of its own.
		if ( target !== UNCATEGORIZED_ID ) {
			const targetFolder = folders.find( ( folder ) => folder.id === target );

			if ( targetFolder?.meta?.locked || utilities.isAnyParentLocked( target, folders ) ) {
				return { allowed: false, reason: __( 'This folder is locked and cannot be modified', 'godam' ) };
			}
		}

		return { allowed: true, reason: '' };
	}, [ folders ] );

	/**
	 * Adjust the cached attachment counts either side of a move so the tree reads
	 * correctly before the authoritative refetch lands.
	 *
	 * @param {number} sourceFolderId Folder the items came from.
	 * @param {number} targetFolderId Folder the items went to.
	 * @param {number} count          How many items moved.
	 */
	const updateFolderCounts = useCallback( ( sourceFolderId, targetFolderId, count ) => {
		const updatedFolders = folders.map( ( folder ) => {
			// Only debit a real source folder: from "All Media" the items came from
			// several folders at once, and Uncategorized keeps its count in a
			// separate query.
			if ( folder.id === sourceFolderId && sourceFolderId > UNCATEGORIZED_ID ) {
				return { ...folder, attachmentCount: ( Number( folder.attachmentCount ) || 0 ) - count };
			}

			if ( folder.id === targetFolderId ) {
				return { ...folder, attachmentCount: ( Number( folder.attachmentCount ) || 0 ) + count };
			}

			return folder;
		} );

		dispatch( setTree( updatedFolders ) );
	}, [ folders, dispatch ] );

	/**
	 * Move attachments into a folder.
	 *
	 * @param {Object} options                Move options.
	 * @param {Array}  options.attachmentIds  Attachment ids to move.
	 * @param {number} options.targetFolderId Destination folder id (0 = Uncategorized).
	 * @param {number} options.sourceFolderId Folder being viewed; defaults to the sidebar's selection.
	 * @return {Promise<{ success: boolean }>} Whether the server accepted the move.
	 */
	const moveAttachments = useCallback( async ( {
		attachmentIds,
		targetFolderId,
		sourceFolderId = selectedFolder?.id,
	} ) => {
		const ids = [ ...new Set( ( attachmentIds || [] ).map( Number ) ) ]
			.filter( ( id ) => Number.isInteger( id ) && id > 0 );

		if ( ! ids.length ) {
			dispatch( updateSnackbar( {
				message: __( 'Select one or more media items to move.', 'godam' ),
				type: 'fail',
			} ) );
			return { success: false };
		}

		const target = Number( targetFolderId );

		if ( target === ALL_MEDIA_ID || Number.isNaN( target ) ) {
			dispatch( updateSnackbar( {
				message: __( 'Choose a folder to move these items into.', 'godam' ),
				type: 'fail',
			} ) );
			return { success: false };
		}

		const { allowed, reason } = canMoveTo( target, sourceFolderId );

		if ( ! allowed ) {
			// Being already in the destination is a no-op, not a failure — the drag
			// path reaches it just by dropping an item back where it started.
			if ( target !== Number( sourceFolderId ) ) {
				dispatch( updateSnackbar( { message: reason, type: 'fail' } ) );
			}
			return { success: false };
		}

		setIsMoving( true );

		try {
			// `.unwrap()` is required: RTK Query mutations RESOLVE on HTTP 4xx/5xx, so
			// without it a rejection would fall through to the success path and report
			// a move that never happened.
			await assignFolderMutation( {
				attachmentIds: ids,
				folderTermId: target,
			} ).unwrap();

			const notice = {
				/* translators: %d: number of media items moved. */
				message: sprintf( _n( '%d item moved.', '%d items moved.', ids.length, 'godam' ), ids.length ),
				type: 'success',
			};

			updateFolderCounts( Number( sourceFolderId ), target, ids.length );
			dispatch( updateSnackbar( notice ) );
			refreshAfterMove( { notice } );

			return { success: true };
		} catch ( error ) {
			// Surface the server's own wording: it distinguishes a locked folder from
			// an ownership failure, and a generic string would hide which one it was.
			dispatch( updateSnackbar( {
				message: error?.data?.message || error?.message || __( 'Failed to move items', 'godam' ),
				type: 'fail',
			} ) );

			// The assign loop is not transactional — a mid-loop failure can leave some
			// items already moved — so re-read the view rather than leaving it stale.
			refreshAfterMove();

			return { success: false };
		} finally {
			setIsMoving( false );
		}
	}, [ assignFolderMutation, canMoveTo, dispatch, selectedFolder, updateFolderCounts ] );

	return { moveAttachments, canMoveTo, isMoving };
};

export default useMoveAttachments;
export { ALL_MEDIA_ID, UNCATEGORIZED_ID };
