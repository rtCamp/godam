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
import { closeModal, createFolder, updateSnackbar } from '../../redux/slice/folders';
import { useCreateFolderMutation } from '../../redux/api/folders';
import { updateSelectDropdown } from '../../data/media-grid';
import './scss/modal.scss';

const FolderCreationModal = () => {
	const [ folderName, setFolderName ] = useState( '' );

	const [ createFolderMutation ] = useCreateFolderMutation();

	const dispatch = useDispatch();

	const isOpen = useSelector( ( state ) => state.FolderReducer.modals.folderCreation );
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );

	useEffect( () => {
		if ( isOpen ) {
			setFolderName( '' );
		}
	}, [ isOpen ] );

	const handleSubmit = async () => {
		try {
			let parent = selectedFolder.id;

			if ( selectedFolder.id === -1 || ! selectedFolder.id ) {
				parent = 0;
			}

			const response = await createFolderMutation( { name: folderName, parent } ).unwrap();

			dispatch( updateSnackbar(
				{
					message: 'Folder created successfully',
					type: 'success',
				},
			) );

			dispatch( createFolder( { name: folderName, id: response.id, parent: response.parent } ) );

			updateSelectDropdown( response.id, folderName );
		} catch ( error ) {
			dispatch( updateSnackbar(
				{
					message: 'Failed to create folder',
					type: 'error',
				},
			) );
		}

		dispatch( closeModal( 'folderCreation' ) );
	};

	return (
		isOpen && (
			<Modal
				title="Create a new folder"
				onRequestClose={ () => dispatch( closeModal( 'folderCreation' ) ) }
				className="modal__container"
			>
				<TextControl
					label="Folder Name"
					value={ folderName }
					onChange={ ( value ) => setFolderName( value ) }
				/>

				<ButtonGroup className="modal__button-group">
					<Button
						text="Create"
						variant="primary"
						onClick={ () => handleSubmit() }
						disabled={ ! folderName }
					/>
					<Button
						text="Cancel"
						onClick={ () => dispatch( closeModal( 'folderCreation' ) ) }
						isDestructive
					/>
				</ButtonGroup>
			</Modal>
		)
	);
};

export default FolderCreationModal;
