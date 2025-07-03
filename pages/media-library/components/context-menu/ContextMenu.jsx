/**
 * External dependencies
 */
import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { openModal, updateSnackbar, addBookmark, lockFolder } from '../../redux/slice/folders';
import { useDownloadZipMutation, useUpdateFolderMutation } from '../../redux/api/folders';
import {
	BookmarkStarIcon,
	DeleteIcon,
	DownloadZipIcon,
	LockFolderIcon,
	NewFolderIcon,
	RenameFolderIcon,
	// CopyIcon,
	// CutIcon,
	// DuplicateFolderIcon,
} from '../icons';

import './css/context-menu.scss';

const ContextMenu = ( { x, y, folderId, onClose } ) => {
	const dispatch = useDispatch();
	const menuRef = useRef( null );

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

	const [ updateFolderMutation ] = useUpdateFolderMutation();
	const [ downloadZipMutation ] = useDownloadZipMutation();

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
	const downloadZip = useCallback( async ( id ) => {
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
	const toggleBookmark = useCallback( async ( folder ) => {
		if ( ! folder || ! folder.id ) {
			dispatch( updateSnackbar( {
				message: __( 'Invalid folder for bookmark.', 'godam' ),
				type: 'fail',
			} ) );
			return;
		}

		const isBookmarked = folder?.meta?.bookmark;
		const updatedFolder = {
			...folder,
			meta: {
				...folder?.meta,
				bookmark: ! isBookmarked,
			},
		};

		try {
			await updateFolderMutation( updatedFolder ).unwrap();

			dispatch( addBookmark( folder.id ) );

			dispatch( updateSnackbar( {
				message: isBookmarked
					? __( 'Bookmark removed successfully', 'godam' )
					: __( 'Bookmark added successfully', 'godam' ),
				type: 'success',
			} ) );
		} catch ( error ) {
			dispatch( updateSnackbar( {
				message: __( 'Failed to update bookmark status', 'godam' ),
				type: 'fail',
			} ) );
		}
	}, [ dispatch, updateFolderMutation ] );

	/**
	 * Function to lock or unlock a folder
	 *
	 * @param {Object} folder - The folder object to be locked or unlocked.
	 * @return {void}
	 */
	const toggleFolderLock = useCallback( async ( folder ) => {
		if ( ! folder || ! folder.id ) {
			dispatch( updateSnackbar( {
				message: __( 'Invalid folder to lock.', 'godam' ),
				type: 'fail',
			} ) );
			return;
		}

		const isCurrentlyLocked = folder?.meta?.locked;
		const updatedFolder = {
			...folder,
			meta: {
				...folder?.meta,
				locked: ! isCurrentlyLocked,
			},
		};

		try {
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
		} catch ( error ) {
			dispatch(
				updateSnackbar( {
					message: __( 'Failed to update folder lock status', 'godam' ),
					type: 'fail',
				} ),
			);
		}
	}, [ dispatch, updateFolderMutation ] );

	const handleMenuItemClick = ( actionType ) => {
		switch ( actionType ) {
			case 'newSubFolder':
				dispatch( openModal( 'folderCreation', { parentId: folderId } ) );
				break;
			case 'rename':
				dispatch( openModal( 'rename', { folderId: currentFolder.id } ) );
				break;
			// case 'duplicate':
			// 	// Implement duplication logic
			// 	console.log( `Duplicate folder ${ folderId }` );
			// 	break;
			// case 'cut':
			// 	// Implement cut logic
			// 	console.log( `Cut folder ${ folderId }` );
			// 	break;
			// case 'copy':
			// 	// Implement copy logic
			// 	console.log( `Copy folder ${ folderId }` );
			// 	break;
			case 'lockFolder':
				toggleFolderLock( currentFolder );
				break;
			case 'addBookmark':
				toggleBookmark( currentFolder );
				break;
			case 'downloadZip':
				downloadZip( currentFolder.id );
				break;
			case 'delete':
				dispatch( openModal( 'delete', { folderId: currentFolder.id } ) );
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
			style={ { top: y, left: x } }
		>
			<Button
				icon={ NewFolderIcon }
				onClick={ () => handleMenuItemClick( 'newSubFolder' ) }
				className="folder-context-menu__item"
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
			{ /* <Button
				icon={ DuplicateFolderIcon }
				onClick={ () => handleMenuItemClick( 'duplicate' ) }
				className="folder-context-menu__item"
				disabled={ isSpecialFolder }
			>
				{ __( 'Duplicate', 'godam' ) }
			</Button>
			 */ }
			<Button
				icon={ LockFolderIcon }
				onClick={ () => handleMenuItemClick( 'lockFolder' ) }
				className="folder-context-menu__item"
				disabled={ isSpecialFolder }
			>
				{ currentFolder?.meta?.locked ? __( 'Unlock Folder', 'godam' ) : __( 'Lock Folder', 'godam' ) }
			</Button>
			<Button
				icon={ BookmarkStarIcon }
				onClick={ () => handleMenuItemClick( 'addBookmark' ) }
				className="folder-context-menu__item"
				disabled={ isSpecialFolder }
			>
				{ currentFolder?.meta?.bookmark ? __( 'Remove Bookmark', 'godam' ) : __( 'Add Bookmark', 'godam' ) }
			</Button>
			{ /*
			<Button
				icon={ CutIcon }
				onClick={ () => handleMenuItemClick( 'cut' ) }
				className="folder-context-menu__item"
				disabled={ isSpecialFolder }
			>
				{ __( 'Cut', 'godam' ) }
			</Button>
			<Button
				icon={ CopyIcon }
				onClick={ () => handleMenuItemClick( 'copy' ) }
				className="folder-context-menu__item"
				disabled={ isSpecialFolder }
			>
				{ __( 'Copy', 'godam' ) }
			</Button> */ }
			<Button
				icon={ DownloadZipIcon }
				onClick={ () => handleMenuItemClick( 'downloadZip' ) }
				className="folder-context-menu__item"
				disabled={ isSpecialFolder }
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
