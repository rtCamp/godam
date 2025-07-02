/**
 * External dependencies
 */
import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, Modal } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

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
	const isMultiSelecting = useSelector( ( state ) => state.FolderReducer.isMultiSelecting );
	const multiSelectedFolderIds = useSelector( ( state ) => state.FolderReducer.multiSelectedFolderIds );

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
			if ( ! isMultiSelecting ) {
				await deleteFolderMutation( selectedFolder.id );
			} else if ( multiSelectedFolderIds && multiSelectedFolderIds.length ) {
				await Promise.all(
					multiSelectedFolderIds.map( ( id ) => deleteFolderMutation( id ) ),
				);
			}

			dispatch( deleteFolder() );

			dispatch( updateSnackbar(
				{
					message: isMultiSelecting ? __( 'Folders deleted successfully', 'godam' ) : __( 'Folder deleted successfully', 'godam' ),
					type: 'success',
				},
			) );

			triggerFilterChange( 'all' );
		} catch ( error ) {
			dispatch( updateSnackbar(
				{
					message: __( 'Failed to delete folder', 'godam' ),
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
				title={ __( 'Confirm Delete', 'godam' ) }
				onRequestClose={ () => dispatch( closeModal( 'delete' ) ) }
				className="modal__container"
			>
				<p className="modal__description">
					{ isMultiSelecting ? (
						<>
							Deleting <span className="modal__highlight">these { multiSelectedFolderIds && multiSelectedFolderIds.length } folders</span> will remove them and all its subfolders, but <span className="modal__highlight">media associated with them will not be deleted</span>.
						</>
					) : (
						<>
							Deleting the folder <span className="modal__highlight">{ selectedFolder.name }</span> will remove it and all its subfolders, but <span className="modal__highlight">media associated with it will not be deleted</span>.
						</>
					) }
				</p>
				<p className="modal__warning">
					{ __( 'Are you sure you want to proceed? This action cannot be undone.', 'godam' ) }
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
