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
import { useDeleteFolderMutation, useBulkDeleteFoldersMutation } from '../../redux/api/folders';
import './scss/modal.scss';
import { triggerFilterChange } from '../../data/media-grid';

const DeleteModal = () => {
	const [ isLoading, setIsLoading ] = useState( false );

	const dispatch = useDispatch();

	const isOpen = useSelector( ( state ) => state.FolderReducer.modals.delete );
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.currentContextMenuFolder );
	const isMultiSelecting = useSelector( ( state ) => state.FolderReducer.isMultiSelecting );
	const multiSelectedFolderIds = useSelector( ( state ) => state.FolderReducer.multiSelectedFolderIds );

	const [ deleteFolderMutation ] = useDeleteFolderMutation();
	const [ bulkDeleteFoldersMutation ] = useBulkDeleteFoldersMutation();
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
				await bulkDeleteFoldersMutation( multiSelectedFolderIds );
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
					type: 'fail',
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
		( isOpen && selectedFolder ) && (
			<Modal
				title={ __( 'Confirm Delete', 'godam' ) }
				onRequestClose={ () => dispatch( closeModal( 'delete' ) ) }
				className="modal__container"
				data-testid="godam-delete-modal"
			>
				<p className="modal__description" data-testid="godam-delete-modal-description">
					{ isMultiSelecting ? (
						<>
							{ __( 'Deleting', 'godam' ) } <span className="modal__highlight" data-testid="godam-delete-modal-folders-count">{ __( 'these', 'godam' ) } { multiSelectedFolderIds && multiSelectedFolderIds.length } { __( 'folders', 'godam' ) }</span> { __( 'will remove them and all its subfolders, but', 'godam' ) } <span className="modal__highlight" data-testid="godam-delete-modal-media-warning">{ __( 'media associated with them will not be deleted', 'godam' ) }</span>.
						</>
					) : (
						<>
							{ __( 'Deleting the folder', 'godam' ) } <span className="modal__highlight" data-testid="godam-delete-modal-folder-name">{ selectedFolder.name }</span> { __( 'will remove it and all its subfolders, but', 'godam' ) } <span className="modal__highlight" data-testid="godam-delete-modal-media-warning">{ __( 'media associated with it will not be deleted', 'godam' ) }</span>.
						</>
					) }
				</p>
				<p className="modal__warning" data-testid="godam-delete-modal-warning">
					{ __( 'Are you sure you want to proceed? This action cannot be undone.', 'godam' ) }
				</p>

				<div className="modal__button-group" data-testid="godam-delete-modal-buttons">
					<Button
						isBusy={ isLoading }
						ref={ ref }
						text={ __( 'Delete', 'godam' ) }
						variant="primary"
						onClick={ () => handleSubmit() }
						isDestructive
						onKeyDown={ handleKeyDown }
						data-testid="godam-delete-folder-button"
					/>
					<Button
						text={ __( 'Cancel', 'godam' ) }
						onClick={ () => dispatch( closeModal( 'delete' ) ) }
						isDestructive
						data-testid="godam-delete-cancel-button"
					/>
				</div>
			</Modal>
		)
	);
};

export default DeleteModal;
