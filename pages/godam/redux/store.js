/**
 * External dependencies
 */
import { configureStore } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import MediaSettingsReducer from './slice/media-settings';

import { generalAPI } from './api/media-settings';

export default configureStore( {
	reducer: {
		mediaSettings: MediaSettingsReducer,
		[ generalAPI.reducerPath ]: generalAPI.reducer,
	},
	middleware: ( getDefaultMiddleware ) => getDefaultMiddleware().concat( generalAPI.middleware ),
} );
