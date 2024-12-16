/**
 * External dependencies
 */
import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

/**
 * WordPress dependencies
 */
import { TextControl, Button, ButtonGroup, Modal } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { closeModal, createFolder } from '../../redux/slice/folders';

const FolderCreationModal = () => {
	const [ folderName, setFolderName ] = useState( '' );
	const [ error, setError ] = useState( '' );

	const dispatch = useDispatch();

	const isOpen = useSelector( ( state ) => state.FolderReducer.modals.folderCreation );

	const handleSubmit = () => {
		if ( ! folderName.trim() ) {
			setError( 'Folder name cannot be empty' );
		}

		dispatch( createFolder( { name: folderName } ) );
		dispatch( closeModal( 'folderCreation' ) );
	};

	return (
		isOpen && (
			<Modal
				title="Create a new folder"
				onRequestClose={ () => dispatch( closeModal( 'folderCreation' ) ) }
			>
				<TextControl
					label="Folder Name"
					value={ folderName }
					onChange={ ( value ) => setFolderName( value ) }
				/>

				{ error && <p className="text-red-500 text-sm mt-2">{ error }</p> }

				<ButtonGroup className="w-full flex gap-2 mt-4">
					<Button
						text="Create"
						variant="primary"
						onClick={ () => handleSubmit() }
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
