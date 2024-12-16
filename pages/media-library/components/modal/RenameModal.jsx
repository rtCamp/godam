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
import { closeModal, renameFolder } from '../../redux/slice/folders';

const RenameModal = () => {
	const [ folderName, setFolderName ] = useState( '' );
	const [ error, setError ] = useState( '' );

	const dispatch = useDispatch();

	const isOpen = useSelector( ( state ) => state.FolderReducer.modals.rename );

	const handleSubmit = () => {
		if ( ! folderName.trim() ) {
			setError( 'Folder name cannot be empty' );
		}

		dispatch( renameFolder( { name: folderName } ) );
		dispatch( closeModal( 'rename' ) );
	};

	return (
		isOpen && (
			<Modal
				title="Rename folder"
				onRequestClose={ () => dispatch( closeModal( 'rename' ) ) }
			>
				<TextControl
					label="Folder Name"
					value={ folderName }
					onChange={ ( value ) => setFolderName( value ) }
				/>

				{ error && <p className="text-red-500 text-sm mt-2">{ error }</p> }

				<ButtonGroup className="w-full flex gap-2 mt-4">
					<Button
						text="Rename"
						variant="primary"
						onClick={ () => handleSubmit() }
					/>
					<Button
						text="Cancel"
						onClick={ () => dispatch( closeModal( 'rename' ) ) }
						isDestructive
					/>
				</ButtonGroup>
			</Modal>
		)
	);
};

export default RenameModal;
