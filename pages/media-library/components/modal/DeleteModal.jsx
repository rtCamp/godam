/**
 * External dependencies
 */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { Button, ButtonGroup, Modal } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { closeModal, deleteFolder, updateSnackbar } from '../../redux/slice/folders';
import { useDeleteFolderMutation } from '../../redux/api/folders';

const DeleteModal = () => {
	const dispatch = useDispatch();

	const isOpen = useSelector( ( state ) => state.FolderReducer.modals.delete );
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.selectedFolder );

	const [ deleteFolderMutation ] = useDeleteFolderMutation();

	const handleSubmit = async () => {
		try {
			await deleteFolderMutation( selectedFolder.id );

			dispatch( deleteFolder() );

			dispatch( updateSnackbar(
				{
					message: 'Folder deleted successfully',
					type: 'success',
				},
			) );
		} catch ( error ) {
			dispatch( updateSnackbar(
				{
					message: 'Failed to delete folder',
					type: 'error',
				},
			) );
		}

		dispatch( closeModal( 'delete' ) );
	};

	return (
		isOpen && (
			<Modal
				title="Confirm Delete"
				onRequestClose={ () => dispatch( closeModal( 'delete' ) ) }
			>
				<p className="text-sm text-gray-700">
					Deleting the folder <span className="font-semibold">{ selectedFolder.name }</span> will remove it and all its subfolders, but <span className="font-semibold">media associated with it will not be deleted</span>.
				</p>
				<p className="text-sm text-gray-600 mt-2">
					Are you sure you want to proceed? This action cannot be undone.
				</p>

				<ButtonGroup className="w-full flex gap-2 mt-4">
					<Button
						text="Delete"
						variant="primary"
						onClick={ () => handleSubmit() }
						isDestructive
					/>
					<Button
						text="Cancel"
						onClick={ () => dispatch( closeModal( 'delete' ) ) }
						isDestructive
					/>
				</ButtonGroup>
			</Modal>
		)
	);
};

export default DeleteModal;
