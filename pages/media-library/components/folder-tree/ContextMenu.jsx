/**
 * External dependencies
 */
import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { useUpdateFolderMutation } from '../../redux/api/folders';
import { hideContextMenu, openModal, lockFolder, updateSnackbar, addBookmark } from '../../redux/slice/folders';

import './css/context-menu.scss';

const ContextMenu = () => {
	const dispatch = useDispatch();
	const contextMenuRef = useRef( null );
	const { isOpen, position, item: targetItem } = useSelector( ( state ) => state.FolderReducer.contextMenu );

	const [ updateFolderMutation ] = useUpdateFolderMutation();

	/**
	 * Function to toggle bookmark status of a folder
	 *
	 * @param {Object} folder - The folder object to toggle bookmark status.
	 */
	const toggleBookmark = async ( folder ) => {
		const isBookmarked = folder?.meta?.bookmark;
		const updatedFolder = {
			...folder,
			meta: {
				...folder.meta,
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
				type: 'error',
			} ) );
		}
	};

	/**
	 * Function to lock or unlock a folder
	 *
	 * @param {Object} folder - The folder object to be locked or unlocked.
	 * @return {void}
	 */
	const toggleFolderLock = async ( folder ) => {
		const isCurrentlyLocked = folder?.meta?.locked;
		const updatedFolder = {
			...folder,
			meta: {
				...folder.meta,
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
					type: 'error',
				} ),
			);
		}
	};

	useEffect( () => {
		const handleClickOutside = ( event ) => {
			if ( contextMenuRef.current && ! contextMenuRef.current.contains( event.target ) ) {
				dispatch( hideContextMenu() );
			}
		};

		const handleEscapeKey = ( event ) => {
			if ( event.key === 'Escape' ) {
				dispatch( hideContextMenu() );
			}
		};

		if ( isOpen ) {
			document.addEventListener( 'mousedown', handleClickOutside );
			document.addEventListener( 'keydown', handleEscapeKey );
		}

		return () => {
			document.removeEventListener( 'mousedown', handleClickOutside );
			document.removeEventListener( 'keydown', handleEscapeKey );
		};
	}, [ isOpen, dispatch ] );

	const handleMenuAction = ( action ) => {
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
			default:
				break;
		}

		dispatch( hideContextMenu() );
	};

	if ( ! isOpen || ! targetItem ) {
		return null;
	}

	return (
		<div
			ref={ contextMenuRef }
			className="context-menu"
			style={ {
				position: 'fixed',
				top: position.y,
				left: position.x,
				zIndex: 9999,
			} }
		>
			<ul className="context-menu__list">
				<button
					className="context-menu__item"
					onClick={ () => handleMenuAction( 'rename' ) }
				>
					{ __( 'Rename Folder', 'godam' ) }
				</button>
				<button
					className="context-menu__item"
					onClick={ () => handleMenuAction( 'newFolder' ) }
				>
					{ __( 'New Folder', 'godam' ) }
				</button>
				<button
					className="context-menu__item context-menu__item--danger"
					onClick={ () => handleMenuAction( 'delete' ) }
				>
					{ __( 'Delete Folder', 'godam' ) }
				</button>
				<button
					className="context-menu__item"
					onClick={ () => handleMenuAction( 'lockFolder' ) }
				>
					{ targetItem.meta.locked ? __( 'Unlock Folder', 'godam' ) : __( 'Lock Folder', 'godam' ) }
				</button>
				<button
					className="context-menu__item"
					onClick={ () => handleMenuAction( 'addBookmark' ) }
				>
					{ targetItem.meta?.bookmark ? __( 'Remove Bookmark', 'godam' ) : __( 'Add Bookmark', 'godam' ) }
				</button>
			</ul>
		</div>
	);
};

export default ContextMenu;
