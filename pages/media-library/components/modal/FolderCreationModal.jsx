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
import { closeModal, createFolder } from '../../redux/slice/folders';

const FolderCreationModal = () => {
	const [ folderName, setFolderName ] = useState( '' );

	const dispatch = useDispatch();

	const isOpen = useSelector( ( state ) => state.FolderReducer.modals.folderCreation );

	useEffect( () => {
		if ( isOpen ) {
			setFolderName( '' );
		}
	}, [ isOpen ] );

	const handleSubmit = () => {
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

				<ButtonGroup className="w-full flex gap-2 mt-4">
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
