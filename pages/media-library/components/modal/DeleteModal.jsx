/**
 * External dependencies
 */
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Modal } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { closeModal, deleteFolder, updateSnackbar } from '../../redux/slice/folders';
import { useDeleteFolderMutation } from '../../redux/api/folders';
import './scss/modal.scss';
import { triggerFilterChange } from '../../data/media-grid';

const DeleteModal = () => {
	const [ isLoading, setIsLoading ] = useState( false );

	const dispatch = useDispatch();

	const isOpen = useSelector( ( state ) => state.FolderReducer.modals.delete );
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );

	const [ deleteFolderMutation ] = useDeleteFolderMutation();
	const ref = useRef( null );

	useEffect( () => {
		if ( isOpen ) {
			setIsLoading( false );
			// Focus the button after render
			setTimeout( () => {
				ref.current?.focus();
			}, 0 );
		}
	}, [ isOpen ] );

	const handleSubmit = async () => {
		if ( isLoading ) {
			return;
		}

		setIsLoading( true );

		try {
			await deleteFolderMutation( selectedFolder.id );

			dispatch( deleteFolder() );

			dispatch( updateSnackbar(
				{
					message: 'Folder deleted successfully',
					type: 'success',
				},
			) );

			triggerFilterChange( 'all' );
		} catch ( error ) {
			dispatch( updateSnackbar(
				{
					message: 'Failed to delete folder',
					type: 'error',
				},
			) );
		} finally {
			setIsLoading( false );
			dispatch( closeModal( 'delete' ) );
		}
	};

	const handleKeyDown = ( e ) => {
		if ( e.key === 'Enter' ) {
			handleSubmit();
		}
	};

	return (
		isOpen && (
			<Modal
				title="Confirm Delete"
				onRequestClose={ () => dispatch( closeModal( 'delete' ) ) }
				className="modal__container"
			>
				<p className="modal__description">
					Deleting the folder <span className="modal__highlight">{ selectedFolder.name }</span> will remove it and all its subfolders, but <span className="modal__highlight">media associated with it will not be deleted</span>.
				</p>
				<p className="modal__warning">
					Are you sure you want to proceed? This action cannot be undone.
				</p>

				<div className="modal__button-group">
					<Button
						isBusy={ isLoading }
						ref={ ref }
						text="Delete"
						variant="primary"
						onClick={ () => handleSubmit() }
						isDestructive
						onKeyDown={ handleKeyDown }
					/>
					<Button
						text="Cancel"
						onClick={ () => dispatch( closeModal( 'delete' ) ) }
						isDestructive
					/>
				</div>
			</Modal>
		)
	);
};

export default DeleteModal;
