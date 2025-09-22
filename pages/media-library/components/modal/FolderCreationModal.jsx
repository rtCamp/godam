/**
 * External dependencies
 */
import React, { useState, useEffect, useRef, useMemo } from 'react';
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
import { __ } from '@wordpress/i18n';

const FolderCreationModal = () => {
	const [ folderName, setFolderName ] = useState( '' );
	const [ isLoading, setIsLoading ] = useState( false );

	const [ createFolderMutation ] = useCreateFolderMutation();
	const inputRef = useRef( null ); // Create ref

	const dispatch = useDispatch();

	const isOpen = useSelector( ( state ) => state.FolderReducer.modals.folderCreation );
	const selectedFolder = useSelector( ( state ) => state.FolderReducer.currentContextMenuFolder );

	const allFolders = useSelector( ( state ) => state.FolderReducer.folders );
	const currentFolder = useMemo( () => {
		return allFolders.find( ( folder ) => folder.id === selectedFolder?.id );
	}, [ allFolders, selectedFolder ] );

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
			let parent = selectedFolder?.id;

			if ( selectedFolder?.id === -1 || ! selectedFolder?.id ) {
				parent = 0;
			}

			if ( currentFolder?.meta?.locked ) {
				parent = 0;
			}

			const response = await createFolderMutation( { name: folderName, parent } ).unwrap();

			dispatch( updateSnackbar(
				{
					message: __( 'Folder created successfully', 'godam' ),
					type: 'success',
				},
			) );

			dispatch( createFolder( { name: folderName, id: response.id, parent: response.parent } ) );

			updateSelectDropdown( response.id, folderName );
		} catch ( error ) {
			if ( error?.status === 400 ) {
				dispatch( updateSnackbar(
					{
						message: __( 'Folder with that name already exists.', 'godam' ),
						type: 'fail',
					},
				) );
			} else {
				dispatch( updateSnackbar(
					{
						message: __( 'Failed to create folder', 'godam' ),
						type: 'fail',
					},
				) );
			}
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
				title={ __( 'Create a new folder', 'godam' ) }
				onRequestClose={ () => dispatch( closeModal( 'folderCreation' ) ) }
				className="modal__container"
			>
				<TextControl
					ref={ inputRef }
					onKeyDown={ handleKeyDown }
					label={ __( 'Folder Name', 'godam' ) }
					value={ folderName }
					onChange={ ( value ) => setFolderName( value ) }
				/>

				<div className="modal__button-group">
					<Button
						isBusy={ isLoading }
						text={ __( 'Create', 'godam' ) }
						variant="primary"
						onClick={ () => handleSubmit() }
						disabled={ ! folderName }
					/>
					<Button
						text={ __( 'Cancel', 'godam' ) }
						onClick={ () => dispatch( closeModal( 'folderCreation' ) ) }
						isDestructive
					/>
				</div>
			</Modal>
		)
	);
};

export default FolderCreationModal;
