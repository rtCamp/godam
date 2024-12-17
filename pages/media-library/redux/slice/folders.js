/**
 * External dependencies
 */
import { createSlice } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import data from '../../data/treeArray';
import { tree } from '../../data/utilities';
import { arrayMove } from '@dnd-kit/sortable';

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
			const newItem = {
				id: Math.floor( Math.random() * 1000 ), // Refactor this later to use actual taxonomy ID.
				name: action.payload.name,
				isOpen: false,
				children: [],
				parent: 0,
			};

			if ( ! state.selectedFolder ) {
				state.folders.push( newItem );
				return;
			}

			const newChildItem = {
				...newItem,
				parent: state.selectedFolder.id,
			};

			state.folders.push( newChildItem );
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
		handleDrop: ( state, action ) => {
			const { active, over } = action.payload;

			const activeIndex = state.folders.findIndex(
				( item ) => item.id === active.id,
			);
			const overIndex = state.folders.findIndex( ( item ) => item.id === over.id );

			state.folders = arrayMove( state.folders, activeIndex, overIndex );
		},
		setTree: ( state, action ) => {
			state.folders = action.payload;
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
	handleDrop,
	setTree,
} = slice.actions;

export default slice.reducer;
