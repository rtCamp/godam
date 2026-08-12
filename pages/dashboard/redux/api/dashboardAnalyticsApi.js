/**
 * External dependencies
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const restURL = window.godamRestRoute?.url || window.wpApiSettings?.root || '/wp-json/';

/**
 * Build the optional date-range query params. Only includes `start_date` /
 * `end_date` when set, so all-time requests keep their existing shape (and
 * cache key). Dates are ISO `YYYY-MM-DD` strings; `null`/`undefined` = all-time.
 *
 * @param {Object} range             Selected range.
 * @param {string} [range.startDate] ISO start date.
 * @param {string} [range.endDate]   ISO end date.
 * @return {Object} Params object with start_date/end_date when present.
 */
const rangeParams = ( { startDate, endDate } = {} ) => ( {
	...( startDate ? { start_date: startDate } : {} ),
	...( endDate ? { end_date: endDate } : {} ),
} );

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
		// Fetch Dashboard Metrics (all-time by default; range-scoped when
		// startDate/endDate are supplied).
		fetchDashboardMetrics: builder.query( {
			query: ( { siteUrl, startDate, endDate } ) => ( {
				url: 'godam/v1/analytics/dashboard-metrics',
				params: {
					site_url: siteUrl,
					...rangeParams( { startDate, endDate } ),
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
			query: ( { siteUrl, days, startDate, endDate } ) => ( {
				url: 'godam/v1/analytics/dashboard-history',
				params: {
					site_url: siteUrl,
					// Explicit range wins over `days` (the microservice enforces
					// the same precedence); only send `days` when no range is set.
					// Guarded on a real value so an undefined `days` never
					// serializes to `days=undefined` and trips proxy validation.
					...( ! startDate && ! endDate && days !== undefined ? { days } : {} ),
					...rangeParams( { startDate, endDate } ),
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
			query: ( { siteUrl, page = 1, limit = 10, search = '', hideDeleted = true, startDate, endDate } ) => ( {
				url: 'godam/v1/analytics/top-videos',
				params: {
					site_url: siteUrl,
					page,
					limit,
					hide_deleted: hideDeleted ? 1 : 0,
					// Only send `search` when set so the proxy can skip the WP_Query.
					...( search ? { search } : {} ),
					...rangeParams( { startDate, endDate } ),
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
		// Fetch Top Products
		fetchTopProducts: builder.query( {
			query: ( { siteUrl, page = 1, limit = 10, search = '', sortBy = 'product_views', order = 'desc', startDate, endDate } ) => ( {
				url: 'godam/v1/analytics/top-products',
				params: {
					site_url: siteUrl,
					page,
					limit,
					sort_by: sortBy,
					order,
					// Only send `search` when set so the proxy can skip the WP_Query.
					...( search ? { search } : {} ),
					...rangeParams( { startDate, endDate } ),
				},
			} ),
			transformResponse: ( response ) => {
				if ( response.status === 'error' ) {
					throw new Error( response.message );
				}
				return {
					products: response.top_products || [],
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
	useLazyFetchTopVideosQuery,
	useFetchTopProductsQuery,
	useLazyFetchTopProductsQuery,
} = dashboardAnalyticsApi;
