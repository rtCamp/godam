/**
 * External dependencies
 */
import React, { useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, ButtonGroup } from '@wordpress/components';

/**
 * Internal dependencies
 */
import './index.css';
import FolderTree from './components/folder-tree/FolderTree.jsx';

import { openModal, clearSelectedFolder } from './redux/slice/folders';

import FolderCreationModal from './components/modal/FolderCreationModal.jsx';
import RenameModal from './components/modal/RenameModal.jsx';
import DeleteModal from './components/modal/DeleteModal.jsx';

const App = () => {
	const dispatch = useDispatch();
	const modals = useSelector( ( state ) => state.FolderReducer.modals );

	const folderRef = useRef( null );

	// /**
	//  * This logic does work, but I am not a fan of this one, so I will refactor it.
	//  */
	// useEffect( () => {
	// 	const handleClickOutside = ( event ) => {
	// 		if ( folderRef.current && ! folderRef.current.contains( event.target ) ) {
	// 			if ( ! Object.values( modals ).some( ( modal ) => modal ) ) {
	// 				dispatch( clearSelectedFolder() );
	// 			}
	// 		}
	// 	};

	// 	document.addEventListener( 'mousedown', handleClickOutside );

	// 	return () => {
	// 		document.removeEventListener( 'mousedown', handleClickOutside );
	// 	};
	// }, [ dispatch, modals ] );

	return (
		<div ref={ folderRef }>
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
				/>
				<Button
					icon="trash"
					__next40pxDefaultSize
					variant="primary"
					text="Delete"
					className="w-1/2"
					isDestructive={ true }
					onClick={ () => dispatch( openModal( 'delete' ) ) }
				/>
			</ButtonGroup>

			<div className="w-full flex flex-col gap-2 mb-2">
				<button className="flex justify-between items-center w-full">
					<p className="text-sm text-black">All Media</p>
					<span className="text-sm text-gray-500 p-1 rounded bg-gray-300">
						1,000
					</span>
				</button>

				<button className="flex justify-between items-center w-full">
					<p className="text-sm text-black">Uncategorized</p>
					<span className="text-sm text-gray-500 p-1 rounded bg-gray-300">
						55
					</span>
				</button>
			</div>

			<FolderTree />

			<FolderCreationModal />
			<RenameModal />
			<DeleteModal />
		</div>
	);
};

export default App;
