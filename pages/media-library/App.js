/**
 * External dependencies
 */
import React, { useCallback, useState, useMemo, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, SelectControl } from '@wordpress/components';
const { __ } = wp.i18n;
/**
 * Internal dependencies
 */
import FolderTree from './components/folder-tree/FolderTree.jsx';
import ContextMenu from './components/context-menu/ContextMenu.jsx';

import {
	changeSelectedFolder,
	openModal,
	toggleMultiSelectMode,
	clearMultiSelectedFolders,
	setSortOrder,
	setCurrentContextMenuFolder,
} from './redux/slice/folders';
import { FolderCreationModal, RenameModal, DeleteModal } from './components/modal/index.jsx';
import { triggerFilterChange } from './data/media-grid.js';
import BookmarkTab from './components/folder-tree/BookmarkTab.jsx';
import LockedTab from './components/folder-tree/LockedTab.jsx';
import { useGetAllMediaCountQuery, useGetCategoryMediaCountQuery } from './redux/api/folders.js';
import SearchBar from './components/search-bar/SearchBar.jsx';

const App = () => {
	const dispatch = useDispatch();
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );
	const contextSelectedFolder = useSelector( ( state ) => state.FolderReducer.currentContextMenuFolder );
	const isMultiSelecting = useSelector( ( state ) => state.FolderReducer.isMultiSelecting );
	const currentSortOrder = useSelector( ( state ) => state.FolderReducer.sortOrder );
	const { data: allMediaCount } = useGetAllMediaCountQuery();
	const { data: uncategorizedCount } = useGetCategoryMediaCountQuery( { folderId: 0 } );

	const allFolders = useSelector( ( state ) => state.FolderReducer.folders );
	const currentFolder = useMemo( () => {
		return allFolders.find( ( folder ) => folder.id === selectedFolder?.id );
	}, [ allFolders, selectedFolder ] );

	const [ contextMenu, setContextMenu ] = useState( {
		visible: false,
		x: 0,
		y: 0,
		folderId: null,
	} );
	const [ isSidebarHidden, setIsSidebarHidden ] = useState( false );

	const handleClick = useCallback( ( id ) => {
		if ( isMultiSelecting ) {
			dispatch( clearMultiSelectedFolders() );
		}

		if ( id === -1 ) {
			triggerFilterChange( 'all' );
			dispatch( setCurrentContextMenuFolder( null ) );
		} else if ( id === 0 ) {
			triggerFilterChange( 'uncategorized' );
			dispatch( setCurrentContextMenuFolder( null ) );
		} else {
			triggerFilterChange( id );
		}

		dispatch( changeSelectedFolder( { item: { id } } ) );
	}, [ dispatch, isMultiSelecting ] );

	const closeFolderMenu = () => {
		const sidebar = document.getElementById( 'rt-transcoder-media-library-root' );
		if ( sidebar ) {
			sidebar.classList.add( 'hide-sidebar' );
		}
		const mediaModal = document.querySelector( '.media-modal-content' );
		if ( mediaModal ) {
			mediaModal.classList.add( 'hide-sidebar' );
		}
		setIsSidebarHidden( true );
	};

	// Call closeFolderMenu on mount when window width is less than 900px so that folder sidebar remains closed by default.
	useEffect( () => {
		if ( typeof window !== 'undefined' && window.innerWidth < 900 ) {
			closeFolderMenu();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	const toggleSidebar = () => {
		const sidebar = document.getElementById( 'rt-transcoder-media-library-root' );
		const mediaModal = document.querySelector( '.media-modal-content' );
		const newHidden = ! isSidebarHidden;

		if ( sidebar ) {
			sidebar.classList.toggle( 'hide-sidebar', newHidden );
		}
		if ( mediaModal ) {
			mediaModal.classList.toggle( 'hide-sidebar', newHidden );
		}

		setIsSidebarHidden( newHidden );
	};

	const handleContextMenu = ( e, folderId, folder ) => {
		e.preventDefault(); // Prevent default browser context menu

		setContextMenu( {
			visible: true,
			x: e.clientX,
			y: e.clientY,
			folderId,
		} );

		dispatch( setCurrentContextMenuFolder( folder ) );
	};

	const handleCloseContextMenu = () => {
		setContextMenu( { ...contextMenu, visible: false } );
	};

	return (
		<>
			<Button
				icon="plus-alt2"
				__next40pxDefaultSize
				variant="secondary"
				className="button--full close-folder-menu-mobile"
				onClick={ () => closeFolderMenu() }
				data-testid="godam-close-folder-menu-button"
			/>
			<Button
				id="media-folder-toggle-button"
				__next40pxDefaultSize
				variant="secondary"
				className="button--full toggle-folder-button"
				onClick={ () => toggleSidebar() }
				icon={ isSidebarHidden ? 'arrow-right-alt2' : 'arrow-left-alt2' }
				data-testid="godam-toggle-folder-button"
			/>
			<div className="control-buttons" data-testid="godam-control-buttons">
				<div className="button-group mb-spacing" data-testid="godam-search-button-group">
					<SearchBar />
					<Button
						icon="plus-alt2"
						__next40pxDefaultSize
						variant="primary"
						text={ __( 'New Folder', 'godam' ) }
						className="button--full mb-spacing new-folder-button"
						onClick={ () => dispatch( openModal( 'folderCreation' ) ) }
						disabled={ selectedFolder?.meta?.locked || currentFolder?.meta?.locked || contextSelectedFolder?.meta?.locked }
						data-testid="godam-new-folder-button"
					/>
				</div>
				<div className="button-group mb-spacing" data-testid="godam-bulk-select-group">
					<Button
						__next40pxDefaultSize
						className="multiselect-button"
						variant="secondary"
						text={ ! isMultiSelecting ? __( 'Bulk Select', 'godam' ) : __( 'Cancel', 'godam' ) }
						onClick={ () => dispatch( toggleMultiSelectMode() ) }
						data-testid="godam-bulk-select-button"
					/>
					<SelectControl
						value={ currentSortOrder }
						className="folder-sort-select"
						options={ [
							{ label: __( 'By Name (A-Z)', 'godam' ), value: 'name-asc' },
							{ label: __( 'By Name (Z-A)', 'godam' ), value: 'name-desc' },
						] }
						onChange={ ( newOrder ) => dispatch( setSortOrder( newOrder ) ) }
						data-testid="godam-sort-select"
					/>
				</div>
			</div>

			<div className="folder-container" data-testid="godam-folder-container">
				<div className="folder-list" data-testid="godam-folder-list">
					<button
						className={ `folder-list__item all-media ${
							selectedFolder.id === -1 ? 'folder-list__item--active' : ''
						}` }
						onClick={ () => handleClick( -1 ) }
						data-testid="godam-all-media-button"
					>
						<p className="folder-list__text" data-testid="godam-all-media-text">{ __( 'All Media', 'godam' ) }
							<span className="folder-list__count" data-testid="godam-all-media-count">{ allMediaCount ?? 0 }</span>
						</p>
					</button>

					<button
						className={ `folder-list__item tree-item ${
							selectedFolder.id === 0 ? 'folder-list__item--active' : ''
						}` }
						onClick={ () => handleClick( 0 ) }
						data-id={ 0 }
						data-testid="godam-uncategorized-button"
					>
						<p className="folder-list__text" data-testid="godam-uncategorized-text">{ __( 'Uncategorized', 'godam' ) }
							<span className="folder-list__count" data-testid="godam-uncategorized-count">{ uncategorizedCount?.count ?? 0 }</span>
						</p>
					</button>
				</div>

				<div className="folder-tabs" data-testid="godam-folder-tabs">
					<BookmarkTab handleContextMenu={ handleContextMenu } />
					<LockedTab handleContextMenu={ handleContextMenu } />
				</div>

				<FolderTree handleContextMenu={ handleContextMenu } />
			</div>

			{ contextMenu.visible && (
				<ContextMenu
					x={ contextMenu.x }
					y={ contextMenu.y }
					folderId={ contextMenu.folderId }
					onClose={ handleCloseContextMenu }
				/>
			) }

			<FolderCreationModal />
			<RenameModal />
			<DeleteModal />
		</>
	);
};

export default App;
