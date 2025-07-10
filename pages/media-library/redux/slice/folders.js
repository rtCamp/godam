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
		},

		snackbar: {
			message: '',
			type: 'success',
		},
		isMultiSelecting: false,
		multiSelectedFolderIds: [],

		sortOrder: 'name-asc',
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
			if ( ! state.selectedFolder ) {
				return;
			}

			const folder = state.folders.find( ( item ) => item.id === state.selectedFolder.id );

			if ( folder ) {
				folder.name = action.payload.name;
			}
		},
		deleteFolder: ( state ) => {
			if ( ! state.selectedFolder && ! state.isMultiSelecting ) {
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

			if ( state.isMultiSelecting ) {
				state.multiSelectedFolderIds.forEach( ( id ) => {
					findChildren( id );
				} );
			} else {
				findChildren( state.selectedFolder.id );
			}

			state.folders = state.folders.filter( ( item ) => ! idsToDelete.has( item.id ) );

			state.selectedFolder = {
				id: -1,
			};

			state.isMultiSelecting = false;
			state.multiSelectedFolderIds = [];
		},
		setTree: ( state, action ) => {
			state.folders = action.payload;
		},
		toggleMultiSelectMode: ( state ) => {
			state.isMultiSelecting = ! state.isMultiSelecting;
			if ( ! state.isMultiSelecting ) {
				state.multiSelectedFolderIds = [];
			}
		},
		addMultiSelectedFolder: ( state, action ) => {
			const folderIdToAdd = action.payload.id;
			if ( ! state.multiSelectedFolderIds.includes( folderIdToAdd ) ) {
				state.multiSelectedFolderIds.push( folderIdToAdd );
			}
		},
		removeMultiSelectedFolder: ( state, action ) => {
			const folderIdToRemove = action.payload.id;
			state.multiSelectedFolderIds = state.multiSelectedFolderIds.filter(
				( id ) => id !== folderIdToRemove,
			);
		},
		toggleMultiSelectedFolder: ( state, action ) => {
			const folderIdToToggle = action.payload.id;
			if ( state.multiSelectedFolderIds.includes( folderIdToToggle ) ) {
				state.multiSelectedFolderIds = state.multiSelectedFolderIds.filter(
					( id ) => id !== folderIdToToggle,
				);
			} else {
				state.multiSelectedFolderIds.push( folderIdToToggle );
			}
		},
		clearMultiSelectedFolders: ( state ) => {
			state.multiSelectedFolderIds = [];
		},
		setSortOrder: ( state, action ) => {
			state.sortOrder = action.payload;
			state.folders.sort( ( a, b ) => {
				if ( state.sortOrder === 'name-asc' ) {
					return a.name.localeCompare( b.name );
				} else if ( state.sortOrder === 'name-desc' ) {
					return b.name.localeCompare( a.name );
				}
				return 0;
			} );
		},
		lockFolder: ( state, action ) => {
			const { ids, status } = action.payload;

			if ( ! Array.isArray( ids ) ) {
				const folder = state.folders.find( ( item ) => item.id === action.payload );

				if ( folder ) {
					if ( ! folder.meta ) {
						folder.meta = {};
					}

					folder.meta.locked = ! Boolean( folder.meta?.locked );
				}
			} else {
				ids.forEach( ( id ) => {
					const folder = state.folders.find( ( item ) => item.id === id );
					if ( folder ) {
						if ( ! folder.meta ) {
							folder.meta = {};
						}
						folder.meta.locked = status;
					}
				} );
			}
		},
		addBookmark: ( state, action ) => {
			const { ids, status } = action.payload;

			if ( ! Array.isArray( ids ) ) {
				const folder = state.folders.find( ( item ) => item.id === action.payload );

				if ( folder ) {
					if ( ! folder.meta ) {
						folder.meta = {};
					}

					folder.meta.bookmark = ! Boolean( folder.meta?.bookmark );
				}
			} else {
				ids.forEach( ( id ) => {
					const folder = state.folders.find( ( item ) => item.id === id );
					if ( folder ) {
						if ( ! folder.meta ) {
							folder.meta = {};
						}
						folder.meta.bookmark = status;
					}
				} );
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
	toggleMultiSelectMode,
	addMultiSelectedFolder,
	removeMultiSelectedFolder,
	toggleMultiSelectedFolder,
	clearMultiSelectedFolders,
	setSortOrder,
	lockFolder,
	addBookmark,
} = slice.actions;

export default slice.reducer;
