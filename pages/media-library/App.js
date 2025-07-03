/**
 * External dependencies
 */
import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, ButtonGroup, SelectControl } from '@wordpress/components';
const { __ } = wp.i18n;
/**
 * Internal dependencies
 */
import FolderTree from './components/folder-tree/FolderTree.jsx';

import {
	changeSelectedFolder,
	openModal,
	toggleMultiSelectMode,
	clearMultiSelectedFolders,
	setSortOrder,
} from './redux/slice/folders';
import { FolderCreationModal, RenameModal, DeleteModal } from './components/modal/index.jsx';
import { triggerFilterChange } from './data/media-grid.js';
import BookmarkTab from './components/folder-tree/BookmarkTab.jsx';

const App = () => {
	const dispatch = useDispatch();
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );
	const isMultiSelecting = useSelector( ( state ) => state.FolderReducer.isMultiSelecting );
	const currentSortOrder = useSelector( ( state ) => state.FolderReducer.sortOrder );

	const handleClick = useCallback( ( id ) => {
		if ( isMultiSelecting ) {
			dispatch( clearMultiSelectedFolders() );
		}

		if ( id === -1 ) {
			triggerFilterChange( 'all' );
		} else if ( id === 0 ) {
			triggerFilterChange( 'uncategorized' );
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
		const mediaToggleButton = document.getElementById( 'media-folder-toggle-button' );
		if ( mediaToggleButton ) {
			mediaToggleButton.innerHTML = mediaToggleButton.innerHTML.replace( /Hide/g, 'Show' );
		}
	};

	return (
		<>
			<div className="control-buttons">
				<Button
					icon="plus-alt2"
					__next40pxDefaultSize
					variant="primary"
					text={ __( 'New Folder', 'godam' ) }
					className="button--full mb-spacing new-folder-button"
					onClick={ () => dispatch( openModal( 'folderCreation' ) ) }
				/>

				<Button
					icon="plus-alt2"
					__next40pxDefaultSize
					variant="secondary"
					className="button--full close-folder-menu-mobile"
					onClick={ () => closeFolderMenu() }
				/>

				<ButtonGroup className="button-group mb-spacing">
					<Button
						__next40pxDefaultSize
						variant="secondary"
						text={ ! isMultiSelecting ? __( 'Select', 'godam' ) : __( 'Cancel', 'godam' ) }
						onClick={ () => dispatch( toggleMultiSelectMode() ) }
					/>
					<SelectControl
						value={ currentSortOrder }
						className="folder-sort-select"
						options={ [
							{ label: __( 'By Name (A-Z)', 'godam' ), value: 'name-asc' },
							{ label: __( 'By Name (Z-A)', 'godam' ), value: 'name-desc' },
						] }
						onChange={ ( newOrder ) => dispatch( setSortOrder( newOrder ) ) }
					/>
				</ButtonGroup>
			</div>

			<div className="folder-list">
				<button
					className={ `folder-list__item all-media ${
						selectedFolder.id === -1 ? 'folder-list__item--active' : ''
					}` }
					onClick={ () => handleClick( -1 ) }
				>
					<p className="folder-list__text">{ __( 'All Media', 'godam' ) }</p>
				</button>

				<button
					className={ `folder-list__item tree-item ${
						selectedFolder.id === 0 ? 'folder-list__item--active' : ''
					}` }
					onClick={ () => handleClick( 0 ) }
					data-id={ 0 }
				>
					<p className="folder-list__text">{ __( 'Uncategorized', 'godam' ) }</p>
				</button>
			</div>

			<BookmarkTab />
			<FolderTree />

			<FolderCreationModal />
			<RenameModal />
			<DeleteModal />
		</>
	);
};

export default App;
