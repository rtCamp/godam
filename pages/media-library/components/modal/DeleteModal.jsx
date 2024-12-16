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
import { closeModal, deleteFolder } from '../../redux/slice/folders';

const DeleteModal = () => {
	const dispatch = useDispatch();

	const isOpen = useSelector( ( state ) => state.FolderReducer.modals.delete );

	const handleSubmit = () => {
		dispatch( deleteFolder() );
		dispatch( closeModal( 'delete' ) );
	};

	return (
		isOpen && (
			<Modal
				title="Confirm Delete"
				onRequestClose={ () => dispatch( closeModal( 'delete' ) ) }
			>

				<p>Are you sure you want to delete this folder?</p>

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
