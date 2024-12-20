/**
 * External dependencies
 */
import { configureStore } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import FolderReducer from './slice/folders';
import { folderApi } from './api/folders';

export default configureStore( {
	reducer: {
		FolderReducer,
		[ folderApi.reducerPath ]: folderApi.reducer,
	},
	middleware: ( getDefaultMiddleware ) => getDefaultMiddleware().concat( folderApi.middleware ),
} );
