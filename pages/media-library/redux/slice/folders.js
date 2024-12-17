/**
 * External dependencies
 */
import { createSlice } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import data from '../../data/treeArray';

const slice = createSlice( {
	name: 'folder',
	initialState: {
		folders: data,
		selectedFolder: null,

		modals: {
			folderCreation: false,
			rename: false,
			delete: false,
		},
	},
	reducers: {
		changeSelectedFolder: ( state, action ) => {
			state.selectedFolder = action.payload.item;
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
		toggleOpenClose: ( state, action ) => {
			state.folders = state.folders.map( ( item ) => {
				if ( item.id === action.payload.id ) {
					return {
						...item,
						isOpen: ! item.isOpen,
					};
				}
				return item;
			} );
		},
		createFolder: ( state, action ) => {
			const { name } = action.payload;
			const newItem = {
				id: state.folders.length + 1,
				name,
				isOpen: false,
				children: [],
				parent: state.selectedFolder ? state.selectedFolder.id : 0,
			};

			state.folders = [ ...state.folders, newItem ];
		},
		renameFolder: ( state, action ) => {
			if ( ! state.selectedFolder ) {
				return;
			}

			state.folders.map( ( item ) => {
				if ( item.id === state.selectedFolder.id ) {
					item.name = action.payload.name;
				}
				return item;
			} );
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
	toggleOpenClose,
	createFolder,
	renameFolder,
	deleteFolder,
	setTree,
} = slice.actions;

export default slice.reducer;
