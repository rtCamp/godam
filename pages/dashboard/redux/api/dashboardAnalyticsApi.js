/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

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
				url: 'godam/v1/analytics/dashboard-metrics',
				params: {
					site_url: siteUrl,
				},
			} ),
			transformResponse: ( response ) => {
				if ( response.status === 'error' ) {
					return {
						errorType: response.errorType || 'unknown_error',
						message: response.message || 'An unknown error occurred.',
					};
				}

				return response.dashboard_metrics || {};
			},
		} ),
		// Fetch Dashboard Metrics History
		fetchDashboardMetricsHistory: builder.query( {
			query: ( { siteUrl, days } ) => ( {
				url: 'godam/v1/analytics/dashboard-history',
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
			query: ( { siteUrl, page = 1, limit = 10, search = '', hideDeleted = true } ) => ( {
				url: 'godam/v1/analytics/top-videos',
				params: {
					site_url: siteUrl,
					page,
					limit,
					hide_deleted: hideDeleted ? 1 : 0,
					// Only send `search` when set so the proxy can skip the WP_Query.
					...( search ? { search } : {} ),
				},
			} ),
			transformResponse: ( response ) => {
				if ( response.status === 'error' ) {
					throw new Error( response.message );
				}
				return {
					videos: response.top_videos || [],
					totalPages: response.total_pages || 1,
					totalItems: response.total_items || 0,
				};
			},
		} ),
	} ),
} );

export const {
	useFetchDashboardMetricsQuery,
	useFetchDashboardMetricsHistoryQuery,
	useFetchTopVideosQuery,
} = dashboardAnalyticsApi;
