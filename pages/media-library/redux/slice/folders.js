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
		bookmarks: [],
		lockedFolders: [],
		selectedFolder: {
			id: selectedFolderId,
		},

		page: {
			current: 1,
			hasNext: true,
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
			window.godam = window.godam || {};
			window.godam.selectedFolder = action.payload.item;
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
			const newFolders = action.payload;

			if ( state.folders.length > 0 ) {
				const folderMap = new Map( state.folders.map( ( folder ) => [ folder.id, folder ] ) );

				newFolders.forEach( ( folder ) => {
					if ( folderMap.has( folder.id ) ) {
						// Update existing folder
						Object.assign( folderMap.get( folder.id ), folder );
					} else {
						// Add new folder
						state.folders.push( folder );
					}
				} );
			} else {
				// No existing folders, just set
				state.folders = newFolders;
			}
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

					if ( state.selectedFolder && state.selectedFolder.id === folder.id ) {
						window.godam = window.godam || {};
						window.godam.selectedFolder = { ...state.selectedFolder, meta: { ...state.selectedFolder.meta, locked: folder.meta.locked } };
					}

					if ( state?.selectedFolder?.meta ) {
						state.selectedFolder.meta.locked = folder.meta.locked;
					}

					if ( ! folder.meta.locked ) {
						state.lockedFolders = state.lockedFolders.filter( ( item ) => item.id !== folder.id );
					} else {
						state.lockedFolders.push( folder );
					}
				}
			} else {
				ids.forEach( ( id ) => {
					const folder = state.folders.find( ( item ) => item.id === id );
					if ( folder ) {
						if ( ! folder.meta ) {
							folder.meta = {};
						}
						folder.meta.locked = status;

						if ( state.selectedFolder && state.selectedFolder.id === folder.id ) {
							window.godam = window.godam || {};
							window.godam.selectedFolder = { ...state.selectedFolder, meta: { ...state.selectedFolder.meta, locked: folder.meta.locked } };
						}

						if ( status ) {
							state.lockedFolders.push( folder );
						} else {
							state.lockedFolders = state.lockedFolders.filter( ( item ) => item.id !== folder.id );
						}
					}
				} );
			}
		},
		updateBookmarks: ( state, action ) => {
			const { ids, status } = action.payload;

			if ( ! Array.isArray( ids ) ) {
				const folder = state.folders.find( ( item ) => item.id === action.payload );

				if ( folder ) {
					if ( ! folder.meta ) {
						folder.meta = {};
					}

					folder.meta.bookmark = ! Boolean( folder.meta?.bookmark );

					if ( ! folder.meta.bookmark ) {
						state.bookmarks = state.bookmarks.filter( ( item ) => item.id !== folder.id );
					} else {
						state.bookmarks.push( folder );
					}
				}
			} else {
				ids.forEach( ( id ) => {
					const folder = state.folders.find( ( item ) => item.id === id );
					if ( folder ) {
						if ( ! folder.meta ) {
							folder.meta = {};
						}
						folder.meta.bookmark = status;

						if ( status ) {
							state.bookmarks.push( folder );
						} else {
							state.bookmarks = state.bookmarks.filter( ( item ) => item.id !== folder.id );
						}
					}
				} );
			}
		},
		initializeBookmarks: ( state, action ) => {
			const bookmarks = action.payload || [];
			state.bookmarks = bookmarks;
		},
		initializeLockedFolders: ( state, action ) => {
			const lockedFolders = action.payload || [];
			state.lockedFolders = lockedFolders;
		},
		updatePage: ( state, action ) => {
			const { current, total, hasNext, perPage } = action.payload;
			state.page = {
				current: current ?? state.page.current,
				total: total ?? state.page.total,
				hasNext: hasNext ?? state.page.hasNext,
				perPage: perPage ?? state.page.perPage,
			};
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
	updateBookmarks,
	initializeBookmarks,
	initializeLockedFolders,
	updatePage,
} = slice.actions;

export default slice.reducer;
