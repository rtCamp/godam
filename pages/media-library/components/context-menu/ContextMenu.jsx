/**
 * External dependencies
 */
import React, { useEffect, useRef } from 'react';
import { useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { openModal } from '../../redux/slice/folders';
import {
	DeleteIcon,
	NewFolderIcon,
	RenameFolderIcon,
	// BookmarkStarIcon,
	// CopyIcon,
	// CutIcon,
	// DownloadZipIcon,
	// DuplicateFolderIcon,
	// LockFolderIcon,
} from '../icons';

import './css/context-menu.scss';

const ContextMenu = ( { x, y, folderId, onClose } ) => {
	const dispatch = useDispatch();
	const menuRef = useRef( null );

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

	const handleMenuItemClick = ( actionType ) => {
		switch ( actionType ) {
			case 'newSubFolder':
				dispatch( openModal( 'folderCreation', { parentId: folderId } ) );
				break;
			case 'rename':
				dispatch( openModal( 'rename', { folderId } ) );
				break;
			// case 'duplicate':
			// 	// Implement duplication logic
			// 	console.log( `Duplicate folder ${ folderId }` );
			// 	break;
			// case 'lockFolder':
			// 	// Implement lock logic
			// 	console.log( `Lock folder ${ folderId }` );
			// 	break;
			// case 'addBookmark':
			// 	// Implement bookmark logic
			// 	console.log( `Add folder ${ folderId } to bookmark` );
			// 	break;
			// case 'cut':
			// 	// Implement cut logic
			// 	console.log( `Cut folder ${ folderId }` );
			// 	break;
			// case 'copy':
			// 	// Implement copy logic
			// 	console.log( `Copy folder ${ folderId }` );
			// 	break;
			// case 'downloadZip':
			// 	// Implement download logic
			// 	console.log( `Download folder ${ folderId } as zip` );
			// 	break;
			case 'delete':
				dispatch( openModal( 'delete', { folderId } ) );
				break;
			default:
				break;
		}
		onClose(); // Close the menu after an action is performed
	};

	// Determine if the folder can be deleted/renamed (same logic as App.js)
	const isSpecialFolder = [ -1, 0 ].includes( folderId ); // -1 for All Media, 0 for Uncategorized

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
				disabled={ isSpecialFolder }
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
			<Button
				icon={ LockFolderIcon }
				onClick={ () => handleMenuItemClick( 'lockFolder' ) }
				className="folder-context-menu__item"
				disabled={ isSpecialFolder }
			>
				{ __( 'Lock Folder', 'godam' ) }
			</Button>
			<Button
				icon={ BookmarkStarIcon }
				onClick={ () => handleMenuItemClick( 'addBookmark' ) }
				className="folder-context-menu__item"
				disabled={ isSpecialFolder }
			>
				{ __( 'Add to Bookmark', 'godam' ) }
			</Button>
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
			</Button>
			<Button
				icon={ DownloadZipIcon }
				onClick={ () => handleMenuItemClick( 'downloadZip' ) }
				className="folder-context-menu__item"
				disabled={ isSpecialFolder }
			>
				{ __( 'Download Zip', 'godam' ) }
			</Button> */ }
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
