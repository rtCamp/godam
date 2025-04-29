/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute.url || '';

export const dashboardAnalyticsApi = createApi( {
	reducerPath: 'dashboardAnalyticsApi',
	baseQuery: fetchBaseQuery( {
		baseUrl: restURL,
		prepareHeaders: ( headers ) => {
			headers.set( 'Content-Type', 'application/json' );
			headers.set( 'X-WP-Nonce', window.wpApiSettings.nonce );
			return headers;
		},
	} ),
	endpoints: ( builder ) => ( {
		// Fetch All-Time Dashboard Metrics
		fetchDashboardMetrics: builder.query( {
			query: ( { siteUrl } ) => ( {
				url: 'godam/v1/dashboard-analytics/fetch',
				params: {
					site_url: siteUrl,
				},
			} ),
			transformResponse: ( response ) => {
				if ( response.status === 'error' ) {
					throw new Error( response.message );
				}
				return response.dashboard_metrics || {};
			},
		} ),
		// Fetch Dashboard Metrics History
		fetchDashboardMetricsHistory: builder.query( {
			query: ( { siteUrl, days } ) => ( {
				url: 'godam/v1/dashboard-analytics/history',
				params: {
					site_url: siteUrl,
					days,
				},
			} ),
			transformResponse: ( response ) => {
				if ( response.status === 'error' ) {
					throw new Error( response.message );
				}
				return response.dashboard_metrics_history || [];
			},
		} ),
		// Fetch Top Videos
		fetchTopVideos: builder.query( {
			query: ( { siteUrl, page = 1, limit = 10 } ) => ( {
				url: 'godam/v1/dashboard-analytics/top-videos',
				params: {
					site_url: siteUrl,
					page,
					limit,
				},
			} ),
			transformResponse: ( response ) => {
				if ( response.status === 'error' ) {
					throw new Error( response.message );
				}
				return response.top_videos || [];
			},
		} ),
	} ),
} );

export const {
	useFetchDashboardMetricsQuery,
	useFetchDashboardMetricsHistoryQuery,
	useFetchTopVideosQuery,
} = dashboardAnalyticsApi;
