/**
 * External dependencies
 */
import { configureStore } from '@reduxjs/toolkit';

/**
 * Internal dependencies
 */
import SettingsReducer from './slice/settings';
import { settingsApi } from './api/settings';

export default configureStore( {
	reducer: {
		settings: SettingsReducer,
		[ settingsApi.reducerPath ]: settingsApi.reducer,
	},
	middleware: ( getDefaultMiddleware ) => getDefaultMiddleware().concat( settingsApi.middleware ),
} );
