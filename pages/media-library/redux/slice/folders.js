/**
 * External dependencies
 */
import { createSlice } from '@reduxjs/toolkit';

let selectedFolderId = -1;

const urlParams = new URLSearchParams( window.location.search );
const folderId = urlParams.get( 'media-folder' );

if ( folderId ) {
	switch ( folderId.toLowerCase() ) {
		case 'all':
			selectedFolderId = -1;
			break;
		case 'uncategorized':
			selectedFolderId = 0;
			break;
		default:
			selectedFolderId = parseInt( folderId );
			break;
	}
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

			item: null,
		},

		snackbar: {
			message: '',
			type: 'success',
		},

		contextMenu: {
			isOpen: false,
			position: {
				x: 0,
				y: 0,
			},
			item: null,
		},
	},
	reducers: {
		changeSelectedFolder: ( state, action ) => {
			state.selectedFolder = action.payload.item;
		},
		openModal: ( state, action ) => {
			const { type, item } = action.payload;

			if ( type in state.modals ) {
				state.modals[ type ] = true;
			}

			if ( item ) {
				state.modals.item = item;
			}
		},
		closeModal: ( state, action ) => {
			const modalName = action.payload;
			if ( state.modals.hasOwnProperty( modalName ) ) {
				state.modals[ modalName ] = false;
			}

			state.modals.item = null;
		},
		updateSnackbar: ( state, action ) => {
			state.snackbar.message = action.payload.message;
			state.snackbar.type = action.payload.type;
		},
		toggleOpenClose: ( state, action ) => {
			const folder = state.folders.find( ( item ) => item.id === action.payload.id );

			if ( folder ) {
				folder.isOpen = ! folder.isOpen;
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
			if ( ! state.modals.item ) {
				return;
			}

			const folder = state.folders.find( ( item ) => item.id === state.modals.item.id );

			if ( folder ) {
				folder.name = action.payload.name;
			}
		},
		deleteFolder: ( state ) => {
			if ( ! state.modals.item ) {
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

			findChildren( state.modals.item.id );

			state.folders = state.folders.filter( ( item ) => ! idsToDelete.has( item.id ) );

			state.modals.item = {
				id: -1,
			};
		},
		setTree: ( state, action ) => {
			state.folders = action.payload;
		},
		showContextMenu: ( state, action ) => {
			state.contextMenu.isOpen = true;
			state.contextMenu.position = action.payload.position;
			state.contextMenu.item = action.payload.item;
		},
		hideContextMenu: ( state ) => {
			state.contextMenu.isOpen = false;
			state.contextMenu.position = { x: 0, y: 0 };
			state.contextMenu.item = null;
		},
		lockFolder: ( state, action ) => {
			const folder = state.folders.find( ( item ) => item.id === action.payload.id );

			if ( folder ) {
				folder.meta.locked = ! folder.meta.locked;
			}
		},
		addBookmark: ( state, action ) => {
			const folder = state.folders.find( ( item ) => item.id === action.payload.id );

			if ( folder ) {
				if ( ! folder.meta ) {
					folder.meta = {};
				}

				folder.meta.bookmark = ! folder.meta.bookmark;
			}
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
	showContextMenu,
	hideContextMenu,
	lockFolder,
	addBookmark,
} = slice.actions;

export default slice.reducer;
