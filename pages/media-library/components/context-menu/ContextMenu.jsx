/**
 * External dependencies
 */
import React, { useEffect, useRef, useMemo, useCallback, useState, useLayoutEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { openModal, updateSnackbar, updateBookmarks, lockFolder } from '../../redux/slice/folders';
import { useDownloadZipMutation, useUpdateFolderMutation, useBulkLockFoldersMutation, useBulkBookmarkFoldersMutation } from '../../redux/api/folders';
import {
	BookmarkStarIcon,
	DeleteIcon,
	DownloadZipIcon,
	LockFolderIcon,
	NewFolderIcon,
	RenameFolderIcon,
} from '../icons';

import './css/context-menu.scss';

const ContextMenu = ( { x, y, folderId, onClose } ) => {
	const dispatch = useDispatch();
	const menuRef = useRef( null );
	const [ position, setPosition ] = useState( { top: y, left: x } );

	const allFolders = useSelector( ( state ) => state.FolderReducer.folders );
	const currentFolder = useMemo( () => {
		return allFolders.find( ( folder ) => folder.id === folderId );
	}, [ allFolders, folderId ] );

	const isMultiSelecting = useSelector( ( state ) => state.FolderReducer.isMultiSelecting );
	const multiSelectedFolderIds = useSelector( ( state ) => state.FolderReducer.multiSelectedFolderIds );
	const targetFolderIds = useMemo( () => {
		if ( isMultiSelecting && multiSelectedFolderIds.length > 0 ) {
			return multiSelectedFolderIds;
		}

		return [ folderId ];
	}, [ isMultiSelecting, multiSelectedFolderIds, folderId ] );
	const isSpecialFolder = targetFolderIds.some( ( id ) => [ -1, 0 ].includes( id ) );

	const areAllTargetFoldersLocked = useMemo( () => {
		const targets = allFolders.filter( ( folder ) => targetFolderIds.includes( folder.id ) );
		return targets.length > 0 && targets.every( ( folder ) => folder?.meta?.locked );
	}, [ allFolders, targetFolderIds ] );

	const areAllTargetFoldersBookmarked = useMemo( () => {
		const targets = allFolders.filter( ( folder ) => targetFolderIds.includes( folder.id ) );
		return targets.length > 0 && targets.every( ( folder ) => folder?.meta?.bookmark );
	}, [ allFolders, targetFolderIds ] );

	const [ updateFolderMutation ] = useUpdateFolderMutation();
	const [ downloadZipMutation ] = useDownloadZipMutation();
	const [ bulkLockFoldersMutation ] = useBulkLockFoldersMutation();
	const [ bulkBookmarkFoldersMutation ] = useBulkBookmarkFoldersMutation();

	// Close menu if clicked outside.
	useEffect( () => {
		const handleClickOutside = ( event ) => {
			if ( menuRef.current && ! menuRef.current.contains( event.target ) ) {
				onClose();
			}
		};

		document.addEventListener( 'mousedown', handleClickOutside );
		return () => {
			document.removeEventListener( 'mousedown', handleClickOutside );
		};
	}, [ onClose ] );

	useLayoutEffect( () => {
		if ( ! menuRef.current ) {
			return;
		}

		const menu = menuRef.current;
		const menuWidth = menu.offsetWidth;
		const menuHeight = menu.offsetHeight;

		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		let newX = x;
		let newY = y;

		const padding = 10; // Small padding from the edge

		if ( x + menuWidth + padding > viewportWidth ) {
			newX = viewportWidth - menuWidth - padding;
		}
		if ( newX < padding ) {
			newX = padding;
		}

		if ( y + menuHeight + padding > viewportHeight ) {
			newY = viewportHeight - menuHeight - padding;
		}
		if ( newY < padding ) {
			newY = padding;
		}

		setPosition( { top: newY, left: newX } );
	}, [ x, y ] );

	/**
	 * Triggers a file download by creating a temporary anchor element and programmatically clicking it.
	 *
	 * This approach creates a temporary link element, sets the download URL and filename,
	 * adds it to the DOM, triggers the download, and then cleans up by removing the element.
	 * This is considered standard practice for downloading files in browsers as it's the
	 * easiest method to implement, though alternative approaches could be explored if needed.
	 *
	 * TODO: Consider moving this function to a utility file if it will be reused elsewhere.
	 *
	 * ref - https://stackoverflow.com/questions/11620698/how-to-trigger-a-file-download-when-clicking-an-html-button-or-javascript
	 *
	 * @param {string}  url                 - The URL of the file to download
	 * @param {string}  [filename]          - Optional filename for the downloaded file. If not provided, browser will use default from URL
	 * @param {boolean} [openInNewTab=true] - Whether to set target="_blank" as fallback
	 *
	 */
	const downloadFile = useCallback( ( url, filename = null, openInNewTab = true ) => {
		const link = document.createElement( 'a' );
		link.href = url;

		if ( filename ) {
			link.download = filename;
		}

		if ( openInNewTab ) {
			link.setAttribute( 'target', '_blank' );
		}

		document.body.appendChild( link );
		link.click();
		document.body.removeChild( link );
	}, [] );

	/**
	 * Downloads the folder as a ZIP file.
	 *
	 * @param {number} id - The ID of the folder to download.
	 */
	const downloadZip = useCallback( async () => {
		const id = currentFolder.id;
		if ( ! id ) {
			dispatch( updateSnackbar( {
				message: __( 'Folder ID is missing for download.', 'godam' ),
				type: 'fail',
			} ) );
			return;
		}

		try {
			dispatch(
				updateSnackbar( {
					message: __( 'Preparing ZIP file…', 'godam' ),
					type: 'info',
				} ),
			);

			const response = await downloadZipMutation( { folderId: id } ).unwrap();

			if ( ! response?.success ) {
				throw new Error( response?.message || __( 'Failed to create ZIP file', 'godam' ) );
			}

			const { data } = response;

			if ( ! data?.zip_url ) {
				throw new Error( __( 'Invalid response: missing ZIP URL', 'godam' ) );
			}

			downloadFile(
				data.zip_url,
				data.zip_name || `${ currentFolder?.name || 'folder' }.zip`,
				true,
			);

			const successMessage = data?.message;

			dispatch(
				updateSnackbar( {
					message: successMessage,
					type: 'success',
				} ),
			);
		} catch ( error ) {
			let errorMessage = __( 'Failed to download folder', 'godam' );

			if ( error?.message ) {
				errorMessage = error.message;
			} else if ( error?.data?.message ) {
				errorMessage = error.data.message;
			}

			dispatch(
				updateSnackbar( {
					message: errorMessage,
					type: 'fail',
				} ),
			);
		}
	}, [ dispatch, downloadZipMutation, downloadFile, currentFolder ] );

	/**
	 * Function to toggle bookmark status of a folder
	 *
	 * @param {Object} folder - The folder object to toggle bookmark status.
	 */
	const toggleBookmark = useCallback( async () => {
		if ( ( multiSelectedFolderIds.length <= 0 ) && ! currentFolder?.id ) {
			dispatch( updateSnackbar( {
				message: __( 'Invalid folder for bookmark.', 'godam' ),
				type: 'fail',
			} ) );
		} else {
			const folder = currentFolder;
			const isBookmarked = folder?.meta?.bookmark;
			const updatedFolder = {
				...folder,
				meta: {
					...folder?.meta,
					bookmark: ! isBookmarked,
					locked: Boolean( folder?.meta?.locked ?? false ), // Ensure locked status remains unchanged
				},
			};

			try {
				if ( multiSelectedFolderIds.length <= 0 ) {
					await updateFolderMutation( updatedFolder ).unwrap();

					dispatch( updateBookmarks( folder.id ) );

					dispatch( updateSnackbar( {
						message: isBookmarked
							? __( 'Bookmark removed successfully', 'godam' )
							: __( 'Bookmark added successfully', 'godam' ),
						type: 'success',
					} ) );
				} else {
					const areBookmarked = ! areAllTargetFoldersBookmarked;
					const response = await bulkBookmarkFoldersMutation( { folderIds: multiSelectedFolderIds, bookmarkStatus: areBookmarked } ).unwrap();

					dispatch( updateBookmarks( { ids: response.updated_ids, status: areBookmarked } ) );

					dispatch( updateSnackbar( {
						message: __( 'Bookmarks added successfully', 'godam' ),
						type: 'success',
					} ) );
				}
			} catch ( error ) {
				dispatch( updateSnackbar( {
					message: __( 'Failed to update bookmark status', 'godam' ),
					type: 'fail',
				} ) );
			}
		}
	}, [ dispatch, updateFolderMutation, bulkBookmarkFoldersMutation, currentFolder, multiSelectedFolderIds, areAllTargetFoldersBookmarked ] );

	/**
	 * Function to lock or unlock a folder
	 *
	 * @param {Object} folder - The folder object to be locked or unlocked.
	 * @return {void}
	 */
	const toggleFolderLock = useCallback( async () => {
		if ( ( multiSelectedFolderIds.length <= 0 ) && ! currentFolder?.id ) {
			dispatch( updateSnackbar( {
				message: __( 'Invalid folder to lock.', 'godam' ),
				type: 'fail',
			} ) );
		} else {
			const folder = currentFolder;
			const isCurrentlyLocked = folder?.meta?.locked;
			const updatedFolder = {
				...folder,
				meta: {
					...folder?.meta,
					locked: ! isCurrentlyLocked,
					bookmark: Boolean( folder?.meta?.bookmark ?? false ), // Ensure bookmark status remains unchanged
				},
			};

			try {
				if ( multiSelectedFolderIds.length <= 0 ) {
					await updateFolderMutation( updatedFolder ).unwrap();

					dispatch( lockFolder( updatedFolder.id ) );

					dispatch(
						updateSnackbar( {
							message: isCurrentlyLocked
								? __( 'Folder unlocked successfully', 'godam' )
								: __( 'Folder locked successfully', 'godam' ),
							type: 'success',
						} ),
					);
				} else {
					const areLocked = ! areAllTargetFoldersLocked;
					const response = await bulkLockFoldersMutation( { folderIds: multiSelectedFolderIds, lockedStatus: areLocked } ).unwrap();

					dispatch( lockFolder( { ids: response.updated_ids, status: areLocked } ) );

					dispatch( updateSnackbar( {
						message: __( 'Folders locked successfully', 'godam' ),
						type: 'success',
					} ) );
				}
			} catch ( error ) {
				dispatch(
					updateSnackbar( {
						message: __( 'Failed to update folder lock status', 'godam' ),
						type: 'fail',
					} ),
				);
			}
		}
	}, [ dispatch, updateFolderMutation, bulkLockFoldersMutation, currentFolder, multiSelectedFolderIds, areAllTargetFoldersLocked ] );

	const handleMenuItemClick = ( actionType ) => {
		switch ( actionType ) {
			case 'newSubFolder':
				dispatch( openModal( 'folderCreation', { parentId: folderId } ) );
				break;
			case 'rename':
				dispatch( openModal( 'rename', { folderId: currentFolder.id } ) );
				break;
			case 'lockFolder':
				toggleFolderLock();
				break;
			case 'addBookmark':
				toggleBookmark();
				break;
			case 'downloadZip':
				downloadZip();
				break;
			case 'delete':
				if ( isMultiSelecting && multiSelectedFolderIds.length > 0 ) {
					dispatch( openModal( 'delete', { folderIds: multiSelectedFolderIds } ) );
				} else {
					dispatch( openModal( 'delete', { folderId: currentFolder.id } ) );
				}
				break;
			default:
				break;
		}
		onClose(); // Close the menu after an action is performed
	};

	return (
		<div
			className="folder-context-menu"
			ref={ menuRef }
			style={ { top: position.top, left: position.left } }
		>
			<Button
				icon={ NewFolderIcon }
				onClick={ () => handleMenuItemClick( 'newSubFolder' ) }
				className="folder-context-menu__item"
				disabled={ ( isMultiSelecting && multiSelectedFolderIds.length > 1 ) || isSpecialFolder || currentFolder?.meta?.locked }
			>
				{ __( 'New Sub-folder', 'godam' ) }
			</Button>
			<Button
				icon={ RenameFolderIcon }
				onClick={ () => handleMenuItemClick( 'rename' ) }
				className="folder-context-menu__item"
				disabled={ ( isMultiSelecting && multiSelectedFolderIds.length > 1 ) || isSpecialFolder }
			>
				{ __( 'Rename', 'godam' ) }
			</Button>
			<Button
				icon={ LockFolderIcon }
				onClick={ () => handleMenuItemClick( 'lockFolder' ) }
				className="folder-context-menu__item"
				disabled={ isSpecialFolder }
			>
				{ ! currentFolder?.meta?.locked || ( isMultiSelecting && ! areAllTargetFoldersLocked ) ? __( 'Lock Folder', 'godam' ) : __( 'Unlock Folder', 'godam' ) }
			</Button>
			<Button
				icon={ BookmarkStarIcon }
				onClick={ () => handleMenuItemClick( 'addBookmark' ) }
				className="folder-context-menu__item"
				disabled={ isSpecialFolder }
			>
				{ ! currentFolder?.meta?.bookmark || ( isMultiSelecting && ! areAllTargetFoldersBookmarked ) ? __( 'Add Bookmark', 'godam' ) : __( 'Remove Bookmark', 'godam' ) }
			</Button>
			<Button
				icon={ DownloadZipIcon }
				onClick={ () => handleMenuItemClick( 'downloadZip' ) }
				className="folder-context-menu__item"
				disabled={ ( isMultiSelecting && multiSelectedFolderIds.length > 1 ) || isSpecialFolder }
			>
				{ __( 'Download Zip', 'godam' ) }
			</Button>
			<Button
				icon={ DeleteIcon }
				onClick={ () => handleMenuItemClick( 'delete' ) }
				className="folder-context-menu__item"
				disabled={ isSpecialFolder }
			>
				{ __( 'Delete', 'godam' ) }
			</Button>
		</div>
	);
};

export default ContextMenu;
