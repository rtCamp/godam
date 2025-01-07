/**
 * External dependencies
 */
import { configureStore } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import StorageReducer from './slice/storage';
import { storageAPI } from './api/storage';

export default configureStore( {
	reducer: {
		storage: StorageReducer,
		[ storageAPI.reducerPath ]: storageAPI.reducer,
	},
	middleware: ( getDefaultMiddleware ) => getDefaultMiddleware().concat( storageAPI.middleware ),
} );
