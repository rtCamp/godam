/**
 * External dependencies
 */
import { configureStore } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import StorageReducer from './slice/storage';

import { storageAPI } from './api/storage';
import { generalAPI } from './api/general';

export default configureStore( {
	reducer: {
		storage: StorageReducer,
		[ storageAPI.reducerPath ]: storageAPI.reducer,
		[ generalAPI.reducerPath ]: generalAPI.reducer,
	},
	middleware: ( getDefaultMiddleware ) => getDefaultMiddleware().concat( storageAPI.middleware, generalAPI.middleware ),
} );
