/**
 * External dependencies
 */
import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
/**
 * Internal dependencies
 */
import { hideContextMenu, openModal } from '../../redux/slice/folders';

/*
 * Internal dependencies
 */
import './css/context-menu.scss';

const ContextMenu = () => {
	const dispatch = useDispatch();
	const contextMenuRef = useRef( null );
	const { isOpen, position, item: targetItem } = useSelector( ( state ) => state.FolderReducer.contextMenu );

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
			default:
				dispatch( hideContextMenu() );
				break;
		}
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
					Rename Folder
				</button>
				<button
					className="context-menu__item"
					onClick={ () => handleMenuAction( 'newFolder' ) }
				>
					New Subfolder
				</button>
				<button
					className="context-menu__item context-menu__item--danger"
					onClick={ () => handleMenuAction( 'delete' ) }
				>
					Delete Folder
				</button>
			</ul>
		</div>
	);
};

export default ContextMenu;
