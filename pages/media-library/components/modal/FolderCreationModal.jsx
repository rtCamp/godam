/**
 * External dependencies
 */
import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { TextControl, Button, Modal } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { closeModal, createFolder, updateSnackbar } from '../../redux/slice/folders';
import { useCreateFolderMutation } from '../../redux/api/folders';
import { updateSelectDropdown } from '../../data/media-grid';
import './scss/modal.scss';

const FolderCreationModal = () => {
	const [ folderName, setFolderName ] = useState( '' );
	const [ isLoading, setIsLoading ] = useState( false );

	const [ createFolderMutation ] = useCreateFolderMutation();
	const inputRef = useRef( null ); // Create ref

	const dispatch = useDispatch();

	const isOpen = useSelector( ( state ) => state.FolderReducer.modals.folderCreation );
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );

	useEffect( () => {
		if ( isOpen ) {
			setFolderName( '' );
			setIsLoading( false );
			// Focus the input field after render
			setTimeout( () => {
				inputRef.current?.focus();
			}, 0 );
		}
	}, [ isOpen ] );

	const handleSubmit = async () => {
		if ( ! folderName.trim() || isLoading ) {
			return;
		}

		setIsLoading( true );

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
		} finally {
			setIsLoading( false );
			dispatch( closeModal( 'folderCreation' ) );
		}
	};

	const handleKeyDown = ( e ) => {
		if ( e.key === 'Enter' && folderName.trim() ) {
			handleSubmit();
		}
	};

	return (
		isOpen && (
			<Modal
				title="Create a new folder"
				onRequestClose={ () => dispatch( closeModal( 'folderCreation' ) ) }
				className="modal__container"
			>
				<TextControl
					ref={ inputRef }
					onKeyDown={ handleKeyDown }
					label="Folder Name"
					value={ folderName }
					onChange={ ( value ) => setFolderName( value ) }
				/>

				<div className="modal__button-group">
					<Button
						isBusy={ isLoading }
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
				</div>
			</Modal>
		)
	);
};

export default FolderCreationModal;
