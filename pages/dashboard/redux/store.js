/**
 * External dependencies
 */
import { configureStore } from '@reduxjs/toolkit';
/**
 * Internal dependencies
 */
import { dashboardAnalyticsApi } from './api/dashboardAnalyticsApi';

export default configureStore( {
	reducer: {
		[ dashboardAnalyticsApi.reducerPath ]: dashboardAnalyticsApi.reducer,
	},
	middleware: ( getDefaultMiddleware ) =>
		getDefaultMiddleware().concat( dashboardAnalyticsApi.middleware ),
} );
