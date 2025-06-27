/**
 * External dependencies
 */
import { configureStore } from '@reduxjs/toolkit';
/**
 * Internal dependencies
 */
import { analyticsApi } from './api/analyticsApi';
import { dashboardAnalyticsApi } from '../../dashboard/redux/api/dashboardAnalyticsApi';

export default configureStore( {
	reducer: {
		[ analyticsApi.reducerPath ]: analyticsApi.reducer,
		[ dashboardAnalyticsApi.reducerPath ]: dashboardAnalyticsApi.reducer,
	},
	middleware: ( getDefaultMiddleware ) =>
		getDefaultMiddleware().concat(
			analyticsApi.middleware,
			dashboardAnalyticsApi.middleware,
		),
} );
