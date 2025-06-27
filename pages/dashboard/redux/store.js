/**
 * External dependencies
 */
import { configureStore } from '@reduxjs/toolkit';
/**
 * Internal dependencies
 */
import { dashboardAnalyticsApi } from './api/dashboardAnalyticsApi';
import { analyticsApi } from '../../analytics/redux/api/analyticsApi';

export default configureStore( {
	reducer: {
		[ dashboardAnalyticsApi.reducerPath ]: dashboardAnalyticsApi.reducer,
		[ analyticsApi.reducerPath ]: analyticsApi.reducer,
	},
	middleware: ( getDefaultMiddleware ) =>
		getDefaultMiddleware().concat(
			dashboardAnalyticsApi.middleware,
			analyticsApi.middleware,
		),
} );
