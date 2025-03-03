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
import './scss/modal.scss';

const RenameModal = () => {
	const [ folderName, setFolderName ] = useState( '' );

	const dispatch = useDispatch();

	const isOpen = useSelector( ( state ) => state.FolderReducer.modals.rename );
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );

	const [ updateFolder ] = useUpdateFolderMutation();

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
				className="modal__container"
			>
				<TextControl
					label="Folder Name"
					value={ folderName }
					onChange={ ( value ) => setFolderName( value ) }
				/>

				<div className="modal__button-group">
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
				</div>
			</Modal>
		)
	);
};

export default RenameModal;
