/**
 * External dependencies
 */
import { createSlice } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import { checkIfListSelected } from '../../data/media-grid';

let selectedFolderId = -1;

if ( checkIfListSelected() ) {
	const localStorageData = JSON.parse( localStorage.getItem( 'easyDam' ) ) || {
		selectedItem: -1,
		openItems: [],
	};

	selectedFolderId = localStorageData.selectedItem;
}

const slice = createSlice( {
	name: 'folder',
	initialState: {
		folders: [],
		selectedFolder: {
			id: selectedFolderId,
		},

		modals: {
			folderCreation: false,
			rename: false,
			delete: false,
		},

		snackbar: {
			message: '',
			type: 'success',
		},
	},
	reducers: {
		changeSelectedFolder: ( state, action ) => {
			state.selectedFolder = action.payload.item;

			const appState = JSON.parse( localStorage.getItem( 'easyDam' ) ) || {};
			appState.selectedItem = state.selectedFolder.id;
			localStorage.setItem( 'easyDam', JSON.stringify( appState ) );
		},
		openModal: ( state, action ) => {
			const modalName = action.payload;
			if ( state.modals.hasOwnProperty( modalName ) ) {
				state.modals[ modalName ] = true;
			}
		},
		closeModal: ( state, action ) => {
			const modalName = action.payload;
			if ( state.modals.hasOwnProperty( modalName ) ) {
				state.modals[ modalName ] = false;
			}
		},
		updateSnackbar: ( state, action ) => {
			state.snackbar.message = action.payload.message;
			state.snackbar.type = action.payload.type;
		},
		toggleOpenClose: ( state, action ) => {
			const folder = state.folders.find( ( item ) => item.id === action.payload.id );

			if ( folder ) {
				folder.isOpen = ! folder.isOpen;

				const appState = JSON.parse( localStorage.getItem( 'easyDam' ) ) || {};
				let openFolders = appState.openItems || [];

				if ( folder.isOpen ) {
					// Add the folder ID to the list if it's opened
					if ( ! openFolders.includes( folder.id ) ) {
						openFolders.push( folder.id );
					}
				} else {
					// Remove the folder ID from the list if it's closed
					openFolders = openFolders.filter( ( id ) => id !== folder.id );
				}

				appState.openItems = openFolders;

				localStorage.setItem( 'easyDam', JSON.stringify( appState ) );
			}
		},
		createFolder: ( state, action ) => {
			const { name } = action.payload;
			const newItem = {
				id: action.payload.id,
				name,
				isOpen: false,
				children: [],
				parent: action.payload.parent,
			};

			state.folders.push( newItem );
		},
		renameFolder: ( state, action ) => {
			if ( ! state.selectedFolder ) {
				return;
			}

			const folder = state.folders.find( ( item ) => item.id === state.selectedFolder.id );

			if ( folder ) {
				folder.name = action.payload.name;
			}
		},
		deleteFolder: ( state ) => {
			if ( ! state.selectedFolder ) {
				return;
			}

			const idsToDelete = new Set();

			function findChildren( id ) {
				idsToDelete.add( id );
				state.folders.forEach( ( item ) => {
					if ( item.parent === id ) {
						findChildren( item.id );
					}
				} );
			}

			findChildren( state.selectedFolder.id );

			state.folders = state.folders.filter( ( item ) => ! idsToDelete.has( item.id ) );

			state.selectedFolder = {
				id: -1,
			};
		},
		setTree: ( state, action ) => {
			state.folders = action.payload;
		},
	},
} );

export const {
	changeSelectedFolder,
	openModal,
	closeModal,
	updateSnackbar,
	toggleOpenClose,
	createFolder,
	renameFolder,
	deleteFolder,
	setTree,
} = slice.actions;

export default slice.reducer;
