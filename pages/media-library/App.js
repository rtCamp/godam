/**
 * External dependencies
 */
import React, { useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
const { __ } = wp.i18n;
/**
 * Internal dependencies
 */
import FolderTree from './components/folder-tree/FolderTree.jsx';

import { changeSelectedFolder, openModal } from './redux/slice/folders';
import { FolderCreationModal, RenameModal, DeleteModal } from './components/modal/index.jsx';
import { triggerFilterChange } from './data/media-grid.js';
import BookmarkTab from './components/folder-tree/BookmarkTab.jsx';

const App = () => {
	const dispatch = useDispatch();
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );

	const handleClick = useCallback( ( id ) => {
		if ( id === -1 ) {
			triggerFilterChange( 'all' );
		} else if ( id === 0 ) {
			triggerFilterChange( 'uncategorized' );
		} else {
			triggerFilterChange( id );
		}

		dispatch( changeSelectedFolder( { item: { id } } ) );
	}, [ dispatch ] );

	return (
		<>
			<Button
				icon="plus"
				__next40pxDefaultSize
				variant="primary"
				text={ __( 'New Folder', 'godam' ) }
				className="button--full mb-spacing"
				onClick={ () => dispatch( openModal( { type: 'folderCreation', item: selectedFolder } ) ) }
			/>

			<div className="button-group mb-spacing">
				<Button
					icon="edit"
					__next40pxDefaultSize
					variant="secondary"
					text={ __( 'Rename', 'godam' ) }
					className="button--half"
					onClick={ () => dispatch( openModal( { type: 'rename', item: selectedFolder } ) ) }
					disabled={ [ -1, 0 ].includes( selectedFolder.id ) }
				/>
				<Button
					icon="trash"
					__next40pxDefaultSize
					variant="primary"
					text={ __( 'Delete', 'godam' ) }
					className="button--half"
					isDestructive={ true }
					onClick={ () => dispatch( openModal( { type: 'delete', item: selectedFolder } ) ) }
					disabled={ [ -1, 0 ].includes( selectedFolder.id ) }
				/>
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
