/**
 * External dependencies
 */
import { configureStore } from '@reduxjs/toolkit';
/**
 * Internal dependencies
 */
import { analyticsApi } from './api/analyticsApi';

export default configureStore( {
	reducer: {
		[ analyticsApi.reducerPath ]: analyticsApi.reducer,
	},
	middleware: ( getDefaultMiddleware ) =>
		getDefaultMiddleware().concat( analyticsApi.middleware ),
} );
