/**
 * External dependencies
 */
import { configureStore } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import StorageReducer from './slice/storage';
import MediaSettingsReducer from './slice/media-settings';

import { storageAPI } from './api/storage';
import { generalAPI } from './api/media-settings';

export default configureStore( {
	reducer: {
		storage: StorageReducer,
		mediaSettings: MediaSettingsReducer,
		[ storageAPI.reducerPath ]: storageAPI.reducer,
		[ generalAPI.reducerPath ]: generalAPI.reducer,
	},
	middleware: ( getDefaultMiddleware ) => getDefaultMiddleware().concat( storageAPI.middleware, generalAPI.middleware ),
} );
