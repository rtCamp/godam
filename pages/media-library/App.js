/**
 * External dependencies
 */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, ButtonGroup } from '@wordpress/components';
const { __ } = wp.i18n;
/**
 * Internal dependencies
 */
import './index.css';
import FolderTree from './components/folder-tree/FolderTree.jsx';

import { changeSelectedFolder, openModal } from './redux/slice/folders';

import { FolderCreationModal, RenameModal, DeleteModal } from './components/modal/index.jsx';

const App = () => {
	const dispatch = useDispatch();
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );

	return (
		<>
			<Button
				icon="plus"
				__next40pxDefaultSize
				variant="primary"
				text="New Folder"
				className="w-full flex mb-2"
				onClick={ () => dispatch( openModal( 'folderCreation' ) ) }
			/>

			<ButtonGroup className="w-full flex gap-2 mb-2">
				<Button
					icon="edit"
					__next40pxDefaultSize
					variant="secondary"
					text="Rename"
					className="w-1/2"
					onClick={ () => dispatch( openModal( 'rename' ) ) }
					disabled={ selectedFolder === null }
				/>
				<Button
					icon="trash"
					__next40pxDefaultSize
					variant="primary"
					text="Delete"
					className="w-1/2"
					isDestructive={ true }
					onClick={ () => dispatch( openModal( 'delete' ) ) }
					disabled={ selectedFolder === null }
				/>
			</ButtonGroup>

			<div className="w-full flex flex-col gap-2 mb-2">
				<button
					className="flex justify-between items-center w-full p-2"
					onClick={ () => dispatch( changeSelectedFolder( { item: -1 } ) ) }
				>
					<p className="text-sm text-black">{ __( 'All Media', 'transcoder' ) }</p>
				</button>

				<button
					className="flex justify-between items-center w-full p-2 rounded-md bg-gray-200"
					onClick={ () => dispatch( changeSelectedFolder( { item: 0 } ) ) }
				>
					<p className="text-sm text-black">{ __( 'Uncategorized', 'transcoder' ) }</p>
				</button>
			</div>

			<FolderTree />

			<FolderCreationModal />
			<RenameModal />
			<DeleteModal />
		</>
	);
};

export default App;
