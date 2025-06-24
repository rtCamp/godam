/**
 * External dependencies
 */
import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useDownloadZipMutation, useUpdateFolderMutation } from '../../redux/api/folders';
import { hideContextMenu, openModal, lockFolder, updateSnackbar, addBookmark, updateContextMenuPosition } from '../../redux/slice/folders';

import './css/context-menu.scss';

const ContextMenu = () => {
	const dispatch = useDispatch();
	const contextMenuRef = useRef( null );
	const { isOpen, position, item: targetItem } = useSelector( ( state ) => state.FolderReducer?.contextMenu || {} );

	const [ updateFolderMutation ] = useUpdateFolderMutation();
	const [ downloadZipMutation ] = useDownloadZipMutation();

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
	 * @param {number} folderId - The ID of the folder to download.
	 */
	const downloadZip = useCallback( async ( folderId ) => {
		try {
			dispatch(
				updateSnackbar( {
					message: __( 'Preparing ZIP file…', 'godam' ),
					type: 'info',
				} ),
			);

			const response = await downloadZipMutation( { folderId } ).unwrap();

			if ( ! response?.success ) {
				throw new Error( response?.message || __( 'Failed to create ZIP file', 'godam' ) );
			}

			const { data } = response;

			if ( ! data?.zip_url ) {
				throw new Error( __( 'Invalid response: missing ZIP URL', 'godam' ) );
			}

			downloadFile(
				data.zip_url,
				data.zip_name || `${ targetItem?.name || 'folder' }.zip`,
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
	}, [ dispatch, downloadZipMutation, downloadFile, targetItem?.name ] );

	/**
	 * Function to toggle bookmark status of a folder
	 *
	 * @param {Object} folder - The folder object to toggle bookmark status.
	 */
	const toggleBookmark = useCallback( async ( folder ) => {
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

			dispatch( addBookmark( folder ) );

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

			dispatch( lockFolder( updatedFolder ) );

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

	const handleClickOutside = useCallback( ( event ) => {
		if ( contextMenuRef.current && ! contextMenuRef.current.contains( event.target ) ) {
			dispatch( hideContextMenu() );
		}
	}, [ dispatch ] );

	const handleEscapeKey = useCallback( ( event ) => {
		if ( event.key === 'Escape' ) {
			dispatch( hideContextMenu() );
		}
	}, [ dispatch ] );

	const handleMenuAction = useCallback( ( action ) => {
		switch ( action ) {
			case 'rename':
				dispatch( openModal( { type: 'rename', item: targetItem } ) );
				break;
			case 'delete':
				dispatch( openModal( { type: 'delete', item: targetItem } ) );
				break;
			case 'newFolder':
				dispatch( openModal( { type: 'folderCreation', item: targetItem } ) );
				break;
			case 'lockFolder':
				toggleFolderLock( targetItem );
				break;
			case 'addBookmark':
				toggleBookmark( targetItem );
				break;
			case 'downloadZip':
				downloadZip( targetItem?.id );
				break;
			default:
				break;
		}

		dispatch( hideContextMenu() );
	}, [ dispatch, targetItem, toggleFolderLock, toggleBookmark, downloadZip ] );

	const menuItems = useMemo( () => [
		{
			key: 'rename',
			label: __( 'Rename Folder', 'godam' ),
			className: 'context-menu__item',
		},
		{
			key: 'newFolder',
			label: __( 'New Folder', 'godam' ),
			className: 'context-menu__item',
		},
		{
			key: 'delete',
			label: __( 'Delete Folder', 'godam' ),
			className: 'context-menu__item context-menu__item--danger',
		},
		{
			key: 'lockFolder',
			label: targetItem?.meta?.locked ? __( 'Unlock Folder', 'godam' ) : __( 'Lock Folder', 'godam' ),
			className: 'context-menu__item',
		},
		{
			key: 'addBookmark',
			label: targetItem?.meta?.bookmark ? __( 'Remove Bookmark', 'godam' ) : __( 'Add Bookmark', 'godam' ),
			className: 'context-menu__item',
		},
		{
			key: 'downloadZip',
			label: __( 'Download as ZIP', 'godam' ),
			className: 'context-menu__item',
		},
	], [ targetItem?.meta?.locked, targetItem?.meta?.bookmark ] );

	useEffect( () => {
		if ( isOpen ) {
			document.addEventListener( 'mousedown', handleClickOutside );
			document.addEventListener( 'keydown', handleEscapeKey );
		}

		return () => {
			document.removeEventListener( 'mousedown', handleClickOutside );
			document.removeEventListener( 'keydown', handleEscapeKey );
		};
	}, [ isOpen, handleClickOutside, handleEscapeKey ] );

	useEffect( () => {
		if ( ! isOpen || ! contextMenuRef.current ) {
			return;
		}

		const menuRect = contextMenuRef.current.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;

		let newX = position?.x || 0;
		let newY = position?.y || 0;

		if ( menuRect.right > viewportWidth ) {
			newX = viewportWidth - menuRect.width - 10;
		}
		if ( menuRect.bottom > viewportHeight ) {
			newY = viewportHeight - menuRect.height - 10;
		}

		if ( newX !== position?.x || newY !== position?.y ) {
			dispatch( updateContextMenuPosition( { x: newX, y: newY } ) );
		}
	}, [ dispatch, position?.x, position?.y, isOpen ] );

	if ( ! isOpen || ! targetItem ) {
		return null;
	}

	return (
		<div
			ref={ contextMenuRef }
			className="context-menu"
			style={ {
				position: 'fixed',
				top: position?.y || 0,
				left: position?.x || 0,
				zIndex: 9999,
			} }
		>
			<ul className="context-menu__list">
				{ menuItems.map( ( item ) => (
					<button
						key={ item.key }
						className={ item.className }
						onClick={ () => handleMenuAction( item.key ) }
					>
						{ item.label }
					</button>
				) ) }
			</ul>
		</div>
	);
};

export default ContextMenu;
