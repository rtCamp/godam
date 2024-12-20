/**
 * External dependencies
 */
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { TextControl, Button, ButtonGroup, Modal } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { closeModal, renameFolder, updateSnackbar } from '../../redux/slice/folders';
import { useUpdateFolderMutation } from '../../redux/api/folders';

const RenameModal = () => {
	const [ folderName, setFolderName ] = useState( '' );

	const dispatch = useDispatch();

	const isOpen = useSelector( ( state ) => state.FolderReducer.modals.rename );
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );

	const [ updateFolder, { isError, isLoading } ] = useUpdateFolderMutation();

	useEffect( () => {
		if ( isOpen ) {
			setFolderName( selectedFolder.name );
		}
	}, [ isOpen, selectedFolder ] );

	const handleSubmit = async () => {
		try {
			await updateFolder( { id: selectedFolder.id, name: folderName } ).unwrap();
			dispatch( renameFolder( { name: folderName } ) );

			dispatch( updateSnackbar(
				{
					message: 'Folder renamed successfully',
					type: 'success',
				},
			) );
		} catch ( error ) {
			dispatch( updateSnackbar(
				{
					message: 'Failed to rename folder',
					type: 'error',
				},
			) );
		}

		dispatch( closeModal( 'rename' ) );
	};

	return (
		isOpen && (
			<Modal
				title="Rename folder"
				onRequestClose={ () => dispatch( closeModal( 'rename' ) ) }
			>
				<TextControl
					label="Folder Name"
					value={ folderName }
					onChange={ ( value ) => setFolderName( value ) }
				/>

				<ButtonGroup className="w-full flex gap-2 mt-4">
					<Button
						text="Rename"
						variant="primary"
						onClick={ () => handleSubmit() }
						disabled={ ! folderName }
					/>
					<Button
						text="Cancel"
						onClick={ () => dispatch( closeModal( 'rename' ) ) }
						isDestructive
					/>
				</ButtonGroup>
			</Modal>
		)
	);
};

export default RenameModal;
