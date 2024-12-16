/**
 * External dependencies
 */
import { createSlice } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import data from '../../data/treeArray';
import { tree } from '../../data/utilities';

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
		clearSelectedFolder: ( state ) => {
			state.selectedFolder = null;
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
			state.folders = state.folders.map( ( item ) =>
				tree.findAndUpdate( item,
					( item ) => item.id === action.payload.id,
					( item ) => ( { ...item, isOpen: ! item.isOpen } ),
				),
			);
		},
		createFolder: ( state, action ) => {
			const newItem = {
				id: Math.floor( Math.random() * 1000 ), // Refactor this later to use actual taxonomy ID.
				name: action.payload.name,
				isOpen: false,
				children: [],
			};

			if ( ! state.selectedFolder ) {
				state.folders.push( newItem );
				return;
			}

			state.folders = state.folders.map( ( item ) =>
				tree.findAndUpdate( item,
					( item ) => item.id === state.selectedFolder.id,
					( item ) => ( { ...item, children: [ ...item.children, newItem ] } ),
				),
			);
		},
		renameFolder: ( state, action ) => {
			if ( ! state.selectedFolder ) {
				return;
			}

			state.folders = state.folders.map( ( item ) =>
				tree.findAndUpdate( item,
					( item ) => item.id === state.selectedFolder.id,
					( item ) => ( { ...item, name: action.payload.name } ),
				),
			);
		},
		deleteFolder: ( state ) => {
			if ( ! state.selectedFolder ) {
				return;
			}

			state.folders = state.folders.filter( ( item ) => tree.delete( item, state.selectedFolder.id ) );
		},
	},
} );

export const {
	openModal,
	closeModal,
	createFolder,
	renameFolder,
	changeSelectedFolder,
	clearSelectedFolder,
	toggleOpenClose,
	deleteFolder,
} = slice.actions;

export default slice.reducer;
