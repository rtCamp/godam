/**
 * External dependencies
 */
import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { TextControl, Button, Modal } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { closeModal, renameFolder, updateSnackbar } from '../../redux/slice/folders';
import { useUpdateFolderMutation } from '../../redux/api/folders';
import './scss/modal.scss';

const RenameModal = () => {
	const [ folderName, setFolderName ] = useState( '' );
	const [ isLoading, setIsLoading ] = useState( false );
	const inputRef = useRef( null ); // Create ref

	const dispatch = useDispatch();

	const isOpen = useSelector( ( state ) => state.FolderReducer.modals.rename );
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.currentContextMenuFolder );

	const [ updateFolder ] = useUpdateFolderMutation();

	useEffect( () => {
		if ( isOpen ) {
			setFolderName( selectedFolder.name );
			setIsLoading( false );
			// Focus the input field after render
			setTimeout( () => {
				inputRef.current?.focus();
			}, 0 );
		}
	}, [ isOpen, selectedFolder ] );

	const handleSubmit = async () => {
		if ( ! folderName.trim() || isLoading ) {
			return;
		}

		setIsLoading( true );

		try {
			await updateFolder( { id: selectedFolder.id, name: folderName } ).unwrap();

			dispatch( renameFolder( { name: folderName } ) );

			dispatch( updateSnackbar(
				{
					message: __( 'Folder renamed successfully', 'godam' ),
					type: 'success',
				},
			) );
		} catch ( error ) {
			dispatch( updateSnackbar(
				{
					message: __( 'Failed to rename folder', 'godam' ),
					type: 'fail',
				},
			) );
		} finally {
			setIsLoading( false );
			dispatch( closeModal( 'rename' ) );
		}
	};

	const handleKeyDown = ( e ) => {
		if ( e.key === 'Enter' && folderName.trim() ) {
			handleSubmit();
		}
	};

	return (
		( isOpen && selectedFolder ) && (
			<Modal
				title={ __( 'Rename folder', 'godam' ) }
				onRequestClose={ () => dispatch( closeModal( 'rename' ) ) }
				className="modal__container"
				data-testid="godam-rename-modal"
			>
				<TextControl
					label={ __( 'Folder Name', 'godam' ) }
					value={ folderName }
					onChange={ ( value ) => setFolderName( value ) }
					ref={ inputRef }
					onKeyDown={ handleKeyDown }
					data-testid="godam-rename-folder-input"
				/>

				<div className="modal__button-group" data-testid="godam-rename-modal-buttons">
					<Button
						isBusy={ isLoading }
						text={ __( 'Rename', 'godam' ) }
						variant="primary"
						onClick={ () => handleSubmit() }
						disabled={ ! folderName }
						data-testid="godam-rename-folder-button"
					/>
					<Button
						text={ __( 'Cancel', 'godam' ) }
						onClick={ () => dispatch( closeModal( 'rename' ) ) }
						isDestructive
						data-testid="godam-rename-cancel-button"
					/>
				</div>
			</Modal>
		)
	);
};

export default RenameModal;
